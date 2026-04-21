const store = {
  checkins: [],
  agenda: [],
  groceries: [],
  tasks: [],
  contacts: [],
  notes: "",
  polls: {
    dinner: {
      title: "Avondeten",
      options: ["Pasta", "Poké bowl", "Soep + brood"],
      votes: [0, 0, 0],
    },
    evening: {
      title: "Avondprogramma",
      options: ["Filmavond", "Bordspel", "Wandeling"],
      votes: [0, 0, 0],
    },
  },
};

function renderList(id, items, formatter, allowDelete = true) {
  const el = document.getElementById(id);
  el.innerHTML = "";
  items.forEach((item, index) => {
    const li = document.createElement("li");
    li.innerHTML = formatter(item);
    if (allowDelete) {
      const remove = document.createElement("button");
      remove.textContent = "✕";
      remove.title = "Verwijder";
      remove.addEventListener("click", () => {
        items.splice(index, 1);
        renderAll();
      });
      li.appendChild(remove);
    }
    el.appendChild(li);
  });
}

function renderPoll(id, pollKey) {
  const poll = store.polls[pollKey];
  const container = document.getElementById(id);
  container.innerHTML = "";

  poll.options.forEach((option, idx) => {
    const button = document.createElement("button");
    button.textContent = `${option} — ${poll.votes[idx]} stem(men)`;
    button.addEventListener("click", () => {
      poll.votes[idx] += 1;
      renderPoll(id, pollKey);
    });
    container.appendChild(button);
  });

  const total = poll.votes.reduce((a, b) => a + b, 0);
  const winnerIndex = poll.votes.indexOf(Math.max(...poll.votes));
  const status = document.createElement("div");
  status.className = "progress";
  status.textContent = total
    ? `Voorlopige winnaar: ${poll.options[winnerIndex]}`
    : "Nog geen stemmen";
  container.appendChild(status);
}

function renderAll() {
  renderList(
    "checkin-list",
    store.checkins,
    (c) => `<span><strong>${c.name}</strong> — ${c.status}</span><span class="small">${c.time}</span>`
  );

  renderList(
    "agenda-list",
    store.agenda,
    (a) => `<span>${a.title}</span><span class="small">${new Date(a.date).toLocaleString("nl-NL")}</span>`
  );

  renderList("grocery-list", store.groceries, (g) => `<span>${g}</span>`);

  const topThree = [...store.tasks]
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3);
  renderList(
    "priority-list",
    topThree,
    (t) => `<span>${t.title}</span><span class="small">Prioriteit ${t.priority}</span>`,
    false
  );

  renderList(
    "contact-list",
    store.contacts,
    (c) => `<span>${c.name}</span><span class="small">${c.phone}</span>`
  );

  renderPoll("dinner-poll", "dinner");
  renderPoll("evening-poll", "evening");
}

function addFormListener(formId, handler) {
  document.getElementById(formId).addEventListener("submit", (e) => {
    e.preventDefault();
    handler(e.target);
    renderAll();
    e.target.reset();
  });
}

addFormListener("checkin-form", (form) => {
  store.checkins.unshift({
    name: form.querySelector("#member-name").value,
    status: form.querySelector("#member-status").value,
    time: new Date().toLocaleTimeString("nl-NL"),
  });
});

addFormListener("agenda-form", (form) => {
  store.agenda.push({
    title: form.querySelector("#agenda-title").value,
    date: form.querySelector("#agenda-date").value,
  });
  store.agenda.sort((a, b) => new Date(a.date) - new Date(b.date));
});

addFormListener("grocery-form", (form) => {
  store.groceries.push(form.querySelector("#grocery-item").value);
});

addFormListener("task-form", (form) => {
  store.tasks.push({
    title: form.querySelector("#task-title").value,
    priority: Number(form.querySelector("#task-priority").value),
  });
});

addFormListener("contact-form", (form) => {
  store.contacts.push({
    name: form.querySelector("#contact-name").value,
    phone: form.querySelector("#contact-phone").value,
  });
});

document.getElementById("family-notes").addEventListener("input", (e) => {
  store.notes = e.target.value;
});

document.getElementById("photo-input").addEventListener("change", (e) => {
  const collage = document.getElementById("photo-collage");
  collage.innerHTML = "";
  Array.from(e.target.files).forEach((file) => {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.alt = file.name;
    collage.appendChild(img);
  });
});

async function loadWeather(lat, lon) {
  const output = document.getElementById("weather-output");
  output.textContent = "Weer laden...";

  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation_probability&forecast_days=1&timezone=auto`
    );
    const data = await response.json();
    const { time, temperature_2m, precipitation_probability } = data.hourly;

    const periods = {
      ochtend: [6, 11],
      middag: [12, 17],
      avond: [18, 23],
    };

    const avgFor = (start, end, arr) => {
      const values = arr.filter((_, i) => {
        const hour = Number(time[i].split("T")[1].slice(0, 2));
        return hour >= start && hour <= end;
      });
      return values.length
        ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)
        : "n/b";
    };

    output.innerHTML = Object.entries(periods)
      .map(([name, [start, end]]) => {
        const temp = avgFor(start, end, temperature_2m);
        const rain = avgFor(start, end, precipitation_probability);
        return `<div><strong>${name}</strong>: ${temp}°C, buienkans ${rain}%</div>`;
      })
      .join("");
  } catch {
    output.textContent = "Kon weerinformatie niet ophalen.";
  }
}

document.getElementById("weather-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const lat = document.getElementById("home-lat").value;
  const lon = document.getElementById("home-lon").value;
  loadWeather(lat, lon);
});

renderAll();
loadWeather(50.8514, 5.69);
