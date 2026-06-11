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
        driving: false,
        distM: 0,
        maxSpeed: 0,
        hardBrakes: 0,
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
        // Wissel af en toe tussen lopen/fietsen en autorijden
        if (Math.random() < 0.015) s.driving = !s.driving;
        const baseStep = 0.00006 + Math.random() * 0.00008; // ± wandel-/fietstempo
        const stepDeg = baseStep * (s.driving ? 4 : 1);
        const dLat = s.target[0] - m.pos[0];
        const dLng = s.target[1] - m.pos[1];
        const dist = Math.hypot(dLat, dLng);
        const prevSpeed = s.speedKmh;
        if (dist < stepDeg) {
          // Pauzeer soms even op een plek
          if (Math.random() < 0.3) s.target = randomNearbyPoint(m.pos);
          s.speedKmh = 0;
        } else {
          const prev = m.pos.slice();
          m.pos = [m.pos[0] + (dLat / dist) * stepDeg, m.pos[1] + (dLng / dist) * stepDeg];
          const movedM = distanceM(prev, m.pos);
          s.speedKmh = Math.round((movedM / (TICK_MS / 1000)) * 3.6);
          s.distM += movedM;
          if (s.speedKmh > s.maxSpeed) s.maxSpeed = s.speedKmh;
        }
        // Hard remmen: grote snelheidsafname in één tik
        if (prevSpeed - s.speedKmh > 30) s.hardBrakes++;
        // Batterij loopt langzaam leeg
        if (Math.random() < 0.05 && m.battery > 1) {
          m.battery--;
          if (m.battery === 20) addAlert(`🪫 De batterij van ${m.name} is bijna leeg (20%)`);
        }
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
        </div>
        <button class="report-btn" title="Rijrapport">📊</button>`;
      card.addEventListener("click", () => selectMember(m.id));
      card.querySelector(".report-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        openReport(m);
      });
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

  // ---------- Rijrapport ----------

  const reportOverlay = document.getElementById("report-overlay");

  function openReport(m) {
    const s = sim.get(m.id);
    if (!s) return;
    const km = (s.distM / 1000).toFixed(1);
    const score = Math.max(0, Math.min(100, 100 - s.hardBrakes * 8 - Math.max(0, s.maxSpeed - 100)));
    document.getElementById("report-title").textContent = `📊 Rijrapport — ${m.name}`;
    document.getElementById("report-body").innerHTML = `
      <div class="report-stat"><span>🛣️ Afgelegde afstand</span><b>${km} km</b></div>
      <div class="report-stat"><span>🚀 Topsnelheid</span><b class="${s.maxSpeed > 100 ? "warn" : ""}">${s.maxSpeed} km/u</b></div>
      <div class="report-stat"><span>🛑 Hard remmen</span><b class="${s.hardBrakes > 2 ? "warn" : ""}">${s.hardBrakes}×</b></div>
      <div class="report-stat"><span>🔋 Batterij</span><b>${m.battery}%</b></div>
      <div class="report-grade">Rijscore<b class="${score < 70 ? "warn" : ""}">${score}</b>${
        score >= 90 ? "Uitstekend gereden! 🌟" : score >= 70 ? "Prima, let op het remmen." : "Rij voorzichtiger! ⚠️"
      }</div>`;
    reportOverlay.classList.remove("hidden");
  }

  document.getElementById("report-close").addEventListener("click", () => reportOverlay.classList.add("hidden"));
  reportOverlay.addEventListener("click", (e) => {
    if (e.target === reportOverlay) reportOverlay.classList.add("hidden");
  });

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

  // ---------- Chat ----------

  const CHAT_REPLIES = [
    "Oké! 👍", "Ben onderweg 🚗", "Tot zo!", "Goed bezig 😄",
    "Ik ben er over 10 minuten", "Zal ik iets meenemen?", "👌",
    "Haha 😂", "Is goed, ik laat het weten", "Waar spreken we af?",
  ];

  let chats = loadChats();
  let unreadChat = 0;
  let activeTab = "members";

  function loadChats() {
    try {
      const raw = localStorage.getItem("familiekring-chat");
      if (raw) return JSON.parse(raw);
    } catch (_) { /* negeer corrupte opslag */ }
    return {};
  }

  function saveChats() {
    localStorage.setItem("familiekring-chat", JSON.stringify(chats));
  }

  function circleChat() {
    if (!chats[circleId]) chats[circleId] = [];
    return chats[circleId];
  }

  function renderChat() {
    const box = document.getElementById("chat-messages");
    const msgs = circleChat();
    if (msgs.length === 0) {
      box.innerHTML = '<p class="hint">Nog geen berichten in deze cirkel. Stuur de eerste!</p>';
    } else {
      box.innerHTML = msgs
        .map((msg) => {
          const member = members().find((x) => x.id === msg.from);
          const mine = member && member.isSelf;
          return `<div class="chat-msg${mine ? " mine" : ""}">
            <span class="chat-sender" style="color:${member ? member.color : "var(--muted)"}">${member ? member.name : "Onbekend"}</span>
            ${msg.text}
            <span class="chat-time">${msg.time}</span>
          </div>`;
        })
        .join("");
    }
    box.scrollTop = box.scrollHeight;
    const badge = document.getElementById("chat-badge");
    badge.textContent = unreadChat;
    badge.classList.toggle("hidden", unreadChat === 0);
  }

  function pushChat(fromId, text) {
    circleChat().push({ from: fromId, text, time: timeNow() });
    if (circleChat().length > 100) circleChat().shift();
    saveChats();
    if (activeTab !== "chat") {
      const member = members().find((x) => x.id === fromId);
      if (member && !member.isSelf) {
        unreadChat++;
        showBanner(`💬 ${member.name}: ${text}`, false);
      }
    }
    renderChat();
  }

  function sendChat() {
    const input = document.getElementById("chat-input");
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    pushChat(self().id, text);
    // Gesimuleerd antwoord van een willekeurig ander lid
    const others = members().filter((x) => !x.isSelf);
    const replier = others[Math.floor(Math.random() * others.length)];
    const replyCircle = circleId;
    setTimeout(() => {
      if (circleId === replyCircle) {
        pushChat(replier.id, CHAT_REPLIES[Math.floor(Math.random() * CHAT_REPLIES.length)]);
      }
    }, 1500 + Math.random() * 3000);
  }

  document.getElementById("chat-send").addEventListener("click", sendChat);
  document.getElementById("chat-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendChat();
  });

  // ---------- Tabbladen & cirkels ----------

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const name = tab.dataset.tab;
      activeTab = name;
      for (const panel of document.querySelectorAll(".tab-panel")) {
        panel.classList.toggle("hidden", panel.id !== `tab-${name}`);
      }
      document.getElementById("chat-compose").classList.toggle("hidden", name !== "chat");
      if (name === "alerts") {
        unreadAlerts = 0;
        renderAlerts();
      }
      if (name === "chat") {
        unreadChat = 0;
        renderChat();
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
    renderChat();
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
  renderChat();
  setInterval(tick, TICK_MS);
})();
