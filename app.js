/* FamilieKring — een Life360-achtige familie-locatie-app.
   Volledig client-side: ledenposities worden gesimuleerd, je eigen
   positie kan via de browser-geolocatie worden gebruikt. */

(() => {
  "use strict";

  // ---------- Gegevens ----------

  const MAASTRICHT = [50.8514, 5.6910];
  const TICK_MS = 2000;
  const TRAIL_LENGTH = 60;

  const CIRCLES = {
    familie: {
      name: "👨‍👩‍👧‍👦 Familie",
      members: [
        { id: "peter", name: "Peter (jij)", color: "#6b3fa0", isSelf: true,  battery: 82, pos: [50.8514, 5.6910] },
        { id: "anna",  name: "Anna",        color: "#2eb872", isSelf: false, battery: 64, pos: [50.8460, 5.7050] },
        { id: "max",   name: "Max",         color: "#3b82d4", isSelf: false, battery: 38, pos: [50.8580, 5.6800] },
        { id: "oma",   name: "Oma",         color: "#f29e38", isSelf: false, battery: 91, pos: [50.8410, 5.6760] },
      ],
    },
    vrienden: {
      name: "🎉 Vrienden",
      members: [
        { id: "peter2", name: "Peter (jij)", color: "#6b3fa0", isSelf: true,  battery: 82, pos: [50.8514, 5.6910] },
        { id: "lisa",   name: "Lisa",        color: "#d44a8a", isSelf: false, battery: 55, pos: [50.8550, 5.7000] },
        { id: "tom",    name: "Tom",         color: "#13a3a3", isSelf: false, battery: 17, pos: [50.8440, 5.6900] },
      ],
    },
  };

  const DEFAULT_PLACES = [
    { id: "thuis",  name: "Thuis",  icon: "🏠", pos: [50.8514, 5.6910], radius: 200 },
    { id: "school", name: "School", icon: "🏫", pos: [50.8585, 5.6795], radius: 250 },
    { id: "werk",   name: "Werk",   icon: "💼", pos: [50.8420, 5.7080], radius: 250 },
  ];

  // ---------- Toestand ----------

  let circleId = "familie";
  let places = loadPlaces();
  let alerts = [];
  let unreadAlerts = 0;
  let addingPlace = false;
  let sosActive = false;
  let usingRealLocation = false;
  let selectedMemberId = null;

  // Per lid: simulatie- en kaartstatus
  const sim = new Map(); // id -> { target, speedKmh, trail, marker, trailLine, insidePlaces:Set }

  // ---------- Kaart ----------

  const map = L.map("map", { zoomControl: true }).setView(MAASTRICHT, 14);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);

  const placeLayer = L.layerGroup().addTo(map);
  const memberLayer = L.layerGroup().addTo(map);

  // ---------- Hulpfuncties ----------

  function members() {
    return CIRCLES[circleId].members;
  }

  function self() {
    return members().find((m) => m.isSelf);
  }

  function distanceM(a, b) {
    return map.distance(L.latLng(a), L.latLng(b));
  }

  function randomNearbyPoint([lat, lng]) {
    // Willekeurig doel binnen ±1,5 km, ruwweg binnen Maastricht
    const r = () => (Math.random() - 0.5) * 0.02;
    return [
      Math.min(50.875, Math.max(50.83, lat + r())),
      Math.min(5.73, Math.max(5.655, lng + r())),
    ];
  }

  function timeNow() {
    return new Date().toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
  }

  function nearestPlace(pos) {
    let best = null;
    for (const p of places) {
      const d = distanceM(pos, p.pos);
      if (d <= p.radius && (!best || d < best.d)) best = { place: p, d };
    }
    return best ? best.place : null;
  }

  function loadPlaces() {
    try {
      const raw = localStorage.getItem("familiekring-places");
      if (raw) return JSON.parse(raw);
    } catch (_) { /* negeer corrupte opslag */ }
    return DEFAULT_PLACES.map((p) => ({ ...p }));
  }

  function savePlaces() {
    localStorage.setItem("familiekring-places", JSON.stringify(places));
  }

  // ---------- Meldingen ----------

  function addAlert(text, type = "info") {
    alerts.unshift({ text, type, time: timeNow() });
    if (alerts.length > 50) alerts.pop();
    unreadAlerts++;
    renderAlerts();
    showBanner(text, type === "sos");
  }

  let bannerTimer = null;
  function showBanner(text, isSos) {
    const banner = document.getElementById("map-banner");
    banner.textContent = text;
    banner.classList.toggle("sos", isSos);
    banner.classList.remove("hidden");
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => banner.classList.add("hidden"), 5000);
  }

  // ---------- Simulatie ----------

  function initSim() {
    sim.clear();
    memberLayer.clearLayers();
    for (const m of members()) {
      const state = {
        target: randomNearbyPoint(m.pos),
        speedKmh: 0,
        trail: [m.pos.slice()],
        insidePlaces: new Set(places.filter((p) => distanceM(m.pos, p.pos) <= p.radius).map((p) => p.id)),
        marker: null,
        trailLine: null,
      };
      state.marker = L.marker(m.pos, { icon: memberIcon(m) })
        .addTo(memberLayer)
        .on("click", () => selectMember(m.id));
      sim.set(m.id, state);
    }
  }

  function memberIcon(m) {
    const initials = m.name.trim().charAt(0).toUpperCase();
    const sosClass = sosActive && m.isSelf ? " sos-active" : "";
    return L.divIcon({
      className: "",
      html: `<div class="member-marker${sosClass}" style="background:${m.color}">${initials}</div>`,
      iconSize: [38, 38],
      iconAnchor: [19, 19],
    });
  }

  function tick() {
    for (const m of members()) {
      const s = sim.get(m.id);
      if (!s) continue;

      if (!(m.isSelf && usingRealLocation)) {
        // Beweeg richting het doel; kies een nieuw doel als het bereikt is
        const stepDeg = 0.00035 + Math.random() * 0.00045; // ± wandel-/fietstempo
        const dLat = s.target[0] - m.pos[0];
        const dLng = s.target[1] - m.pos[1];
        const dist = Math.hypot(dLat, dLng);
        if (dist < stepDeg) {
          // Pauzeer soms even op een plek
          if (Math.random() < 0.3) s.target = randomNearbyPoint(m.pos);
          s.speedKmh = 0;
        } else {
          const prev = m.pos.slice();
          m.pos = [m.pos[0] + (dLat / dist) * stepDeg, m.pos[1] + (dLng / dist) * stepDeg];
          s.speedKmh = Math.round((distanceM(prev, m.pos) / (TICK_MS / 1000)) * 3.6);
        }
        // Batterij loopt langzaam leeg
        if (Math.random() < 0.05 && m.battery > 1) m.battery--;
      }

      s.trail.push(m.pos.slice());
      if (s.trail.length > TRAIL_LENGTH) s.trail.shift();
      s.marker.setLatLng(m.pos);

      checkGeofences(m, s);
    }
    updateTrail();
    renderMembers();
  }

  function checkGeofences(m, s) {
    for (const p of places) {
      const inside = distanceM(m.pos, p.pos) <= p.radius;
      const was = s.insidePlaces.has(p.id);
      if (inside && !was) {
        s.insidePlaces.add(p.id);
        addAlert(`${p.icon} ${m.name} is aangekomen bij ${p.name}`);
      } else if (!inside && was) {
        s.insidePlaces.delete(p.id);
        addAlert(`${p.icon} ${m.name} is vertrokken van ${p.name}`);
      }
    }
  }

  // ---------- Weergave: leden ----------

  function renderMembers() {
    const panel = document.getElementById("tab-members");
    panel.innerHTML = "";
    for (const m of members()) {
      const s = sim.get(m.id);
      const place = nearestPlace(m.pos);
      const card = document.createElement("div");
      card.className = "member-card";
      card.innerHTML = `
        <div class="avatar" style="background:${m.color}">${m.name.charAt(0)}</div>
        <div class="member-info">
          <div class="member-name">${m.name} <span class="status-dot"></span></div>
          <div class="member-place">${place ? `${place.icon} Bij ${place.name}` : "🚶 Onderweg"}</div>
        </div>
        <div class="member-meta">
          <div class="battery${m.battery <= 20 ? " low" : ""}">🔋 ${m.battery}%</div>
          <div class="speed-chip">${s ? s.speedKmh : 0} km/u</div>
        </div>`;
      card.addEventListener("click", () => selectMember(m.id));
      panel.appendChild(card);
    }
  }

  function selectMember(id) {
    selectedMemberId = id;
    const m = members().find((x) => x.id === id);
    const s = sim.get(id);
    if (!m || !s) return;
    map.flyTo(m.pos, 16, { duration: 0.8 });
    const place = nearestPlace(m.pos);
    s.marker
      .bindPopup(
        `<div class="marker-popup"><b>${m.name}</b><br>
         ${place ? `${place.icon} Bij ${place.name}` : "🚶 Onderweg"}<br>
         🔋 Batterij: ${m.battery}% &nbsp;·&nbsp; ${s.speedKmh} km/u<br>
         🕐 Laatst gezien: ${timeNow()}</div>`
      )
      .openPopup();
    updateTrail();
  }

  function updateTrail() {
    for (const [id, s] of sim) {
      if (id === selectedMemberId) {
        const m = members().find((x) => x.id === id);
        if (!s.trailLine) {
          s.trailLine = L.polyline(s.trail, { color: m.color, weight: 4, opacity: 0.6, dashArray: "6 8" }).addTo(memberLayer);
        } else {
          s.trailLine.setLatLngs(s.trail);
        }
      } else if (s.trailLine) {
        memberLayer.removeLayer(s.trailLine);
        s.trailLine = null;
      }
    }
  }

  // ---------- Weergave: plaatsen ----------

  function renderPlaces() {
    placeLayer.clearLayers();
    for (const p of places) {
      L.circle(p.pos, {
        radius: p.radius,
        color: "#6b3fa0",
        fillColor: "#6b3fa0",
        fillOpacity: 0.12,
        weight: 2,
      }).addTo(placeLayer);
      L.marker(p.pos, {
        icon: L.divIcon({ className: "", html: `<div style="font-size:22px">${p.icon}</div>`, iconSize: [24, 24], iconAnchor: [12, 12] }),
      })
        .addTo(placeLayer)
        .bindTooltip(p.name);
    }

    const list = document.getElementById("places-list");
    list.innerHTML = "";
    for (const p of places) {
      const card = document.createElement("div");
      card.className = "place-card";
      card.innerHTML = `
        <span class="place-icon">${p.icon}</span>
        <span class="place-name">${p.name}</span>
        <span class="place-radius">${p.radius} m</span>
        <button class="place-delete" title="Verwijderen">✕</button>`;
      card.querySelector(".place-name").addEventListener("click", () => map.flyTo(p.pos, 16));
      card.querySelector(".place-delete").addEventListener("click", () => {
        places = places.filter((x) => x.id !== p.id);
        savePlaces();
        renderPlaces();
      });
      list.appendChild(card);
    }
  }

  // ---------- Weergave: meldingen ----------

  function renderAlerts() {
    const list = document.getElementById("alerts-list");
    if (alerts.length === 0) {
      list.innerHTML = '<p class="hint">Nog geen meldingen.</p>';
    } else {
      list.innerHTML = alerts
        .map((a) => `<div class="alert-item ${a.type}">${a.text}<span class="alert-time">${a.time}</span></div>`)
        .join("");
    }
    const badge = document.getElementById("alert-badge");
    badge.textContent = unreadAlerts;
    badge.classList.toggle("hidden", unreadAlerts === 0);
  }

  // ---------- Tabbladen & cirkels ----------

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const name = tab.dataset.tab;
      for (const panel of document.querySelectorAll(".tab-panel")) {
        panel.classList.toggle("hidden", panel.id !== `tab-${name}`);
      }
      if (name === "alerts") {
        unreadAlerts = 0;
        renderAlerts();
      }
    });
  });

  const circleSelect = document.getElementById("circle-select");
  for (const [id, c] of Object.entries(CIRCLES)) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = c.name;
    circleSelect.appendChild(opt);
  }
  circleSelect.addEventListener("change", () => {
    circleId = circleSelect.value;
    selectedMemberId = null;
    initSim();
    renderMembers();
    map.flyTo(MAASTRICHT, 14);
  });

  // ---------- Plaats toevoegen ----------

  document.getElementById("add-place-btn").addEventListener("click", () => {
    addingPlace = true;
    showBanner("Klik op de kaart om de nieuwe plaats te markeren", false);
  });

  map.on("click", (e) => {
    if (!addingPlace) return;
    addingPlace = false;
    const name = prompt("Naam van deze plaats:", "Nieuwe plaats");
    if (!name) return;
    places.push({
      id: "p" + Date.now(),
      name,
      icon: "📌",
      pos: [e.latlng.lat, e.latlng.lng],
      radius: 200,
    });
    savePlaces();
    renderPlaces();
    addAlert(`📌 Nieuwe plaats toegevoegd: ${name}`);
  });

  // ---------- Inchecken ----------

  document.getElementById("checkin-btn").addEventListener("click", () => {
    const me = self();
    const place = nearestPlace(me.pos);
    const where = place ? `bij ${place.name}` : `op ${me.pos[0].toFixed(4)}, ${me.pos[1].toFixed(4)}`;
    addAlert(`✓ ${me.name} heeft ingecheckt ${where}`, "checkin");
  });

  // ---------- SOS ----------

  const sosOverlay = document.getElementById("sos-overlay");
  const sosCountdown = document.getElementById("sos-countdown");
  let sosTimer = null;

  document.getElementById("sos-btn").addEventListener("click", () => {
    sosOverlay.classList.remove("hidden");
    sosCountdown.classList.add("hidden");
  });

  document.getElementById("sos-cancel").addEventListener("click", () => {
    clearInterval(sosTimer);
    sosOverlay.classList.add("hidden");
    if (sosActive) {
      sosActive = false;
      refreshSelfMarker();
      addAlert("✅ SOS geannuleerd — alles is in orde");
    }
  });

  document.getElementById("sos-confirm").addEventListener("click", () => {
    let count = 5;
    sosCountdown.textContent = count;
    sosCountdown.classList.remove("hidden");
    clearInterval(sosTimer);
    sosTimer = setInterval(() => {
      count--;
      if (count > 0) {
        sosCountdown.textContent = count;
      } else {
        clearInterval(sosTimer);
        sosOverlay.classList.add("hidden");
        sosActive = true;
        refreshSelfMarker();
        const me = self();
        addAlert(`🚨 SOS! ${me.name} heeft een noodmelding verstuurd — locatie wordt live gedeeld`, "sos");
        selectMember(me.id);
      }
    }, 1000);
  });

  function refreshSelfMarker() {
    const me = self();
    const s = sim.get(me.id);
    if (s) s.marker.setIcon(memberIcon(me));
  }

  // ---------- Echte locatie ----------

  document.getElementById("locate-btn").addEventListener("click", () => {
    if (!navigator.geolocation) {
      showBanner("Geolocatie wordt niet ondersteund door deze browser", false);
      return;
    }
    navigator.geolocation.watchPosition(
      (pos) => {
        usingRealLocation = true;
        const me = self();
        me.pos = [pos.coords.latitude, pos.coords.longitude];
        const s = sim.get(me.id);
        if (s) {
          s.marker.setLatLng(me.pos);
          s.speedKmh = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0;
        }
        map.flyTo(me.pos, 15);
        showBanner("Je echte locatie wordt nu live gedeeld", false);
      },
      () => showBanner("Kon je locatie niet ophalen (toestemming geweigerd?)", false),
      { enableHighAccuracy: true }
    );
  });

  // ---------- Start ----------

  initSim();
  renderPlaces();
  renderMembers();
  renderAlerts();
  setInterval(tick, TICK_MS);
})();
