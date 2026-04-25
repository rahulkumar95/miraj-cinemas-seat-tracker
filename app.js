// 🔥 Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCXqXv-YG802yzBwPItL4MLdP1LtfwYdrc",
  authDomain: "miraj-cinemas-seat-tracker.firebaseapp.com",
  projectId: "miraj-cinemas-seat-tracker",
  storageBucket: "miraj-cinemas-seat-tracker.firebasestorage.app",
  messagingSenderId: "1052153141275",
  appId: "1:1052153141275:web:5efb211370fb6c8e19c0be",
  measurementId: "G-Y3R222RVED"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// selections
let selectedMovie = null;
let selectedDate = null;
let selectedSessionId = null;

// 🔥 LOCAL STORAGE KEY
const TRACK_KEY = "seat_trackings";

// 🎬 Load Movies
async function loadMovies() {
  const res = await fetch("https://mirajcinemas.com/api/v1.0/webapp/movies", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "city-id": "4"
    },
    body: JSON.stringify({
      topTab: "now_showing"
    })
  });

  const data = await res.json();
  const movies = data?.data?.data || [];

  const container = document.getElementById("movies");
  container.innerHTML = "";

  movies.forEach(movie => {
    const card = document.createElement("div");
    card.className = "movie-card";

    const img = document.createElement("img");
    img.src = "https://mirajcinemas.com" + movie.image_path_1;

    const title = document.createElement("div");
    title.className = "movie-title";
    title.innerText = movie.Film_strTitle;

    card.appendChild(img);
    card.appendChild(title);

    card.onclick = () => {
      // 🔥 Highlight selected movie
      document.querySelectorAll(".movie-card").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");

      // 🔥 Reset selections
      selectedMovie = movie.Film_strCode;
      selectedDate = null;
      selectedSessionId = null;

      // 🔥 Clear UI
      document.getElementById("dates").innerHTML = "";
      document.getElementById("timings").innerHTML = "";

      // 🔥 Load dates for selected movie
      loadDates(movie.Film_strCode);

      // 🔥 Smooth scroll (mobile friendly)
      setTimeout(() => {
        document.getElementById("dates").scrollIntoView({
          behavior: "smooth"
        });
      }, 200);
    };

    container.appendChild(card);
  });
}

// 📅 Load Dates
function loadDates(movieCode) {
  selectedMovie = movieCode;

  const container = document.getElementById("dates");
  container.innerHTML = "";

  const today = new Date();

  for (let i = 0; i < 10; i++) {
    const d = new Date();
    d.setDate(today.getDate() + i);

    const dateStr = d.toISOString().split("T")[0];

    const formattedDate = new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short"
    });

    const btn = document.createElement("button");
    btn.innerText = formattedDate;

    btn.onclick = () => {
      document.querySelectorAll("#dates button").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");

      loadTimings(movieCode, dateStr);

      // 🔥 SCROLL
      document.getElementById("timings").scrollIntoView({ behavior: "smooth" });
    };

    container.appendChild(btn);
  }
}

// ⏰ Load Timings
async function loadTimings(movieCode, date) {
  selectedDate = date;

  const res = await fetch(
    `https://mirajcinemas.com/api/v1.0/webapp/session/${movieCode}/${date}`,
    {
      headers: { "city-id": "4" }
    }
  );

  const data = await res.json();
  const sessions = data?.data?.sessionsArr || [];

  const container = document.getElementById("timings");
  container.innerHTML = "";

  let foundTiming = false;

  sessions.forEach(s => {
    (s.sessionDetails || []).forEach(detail => {
      (detail.timing || []).forEach(t => {
        foundTiming = true;

        const formattedTime = new Date(t.time).toLocaleTimeString("en-IN", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true
        });

        const btn = document.createElement("button");
        btn.innerText = formattedTime;

        btn.onclick = () => {
          document.querySelectorAll("#timings button").forEach(b => b.classList.remove("selected"));
          btn.classList.add("selected");

          selectedSessionId = t.id;
        };

        container.appendChild(btn);
      });
    });
  });

  if (!foundTiming) {
    alert("⚠️ No shows opened yet");
  }
}

// 🔔 Start Tracking
async function startTracking() {
  if (!selectedSessionId) {
    alert("Select movie, date, timing");
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return;

  const registration = await navigator.serviceWorker.register(
    "firebase-messaging-sw.js"
  );

  await navigator.serviceWorker.ready;

  const token = await messaging.getToken({
    vapidKey: "BJdiJWaKqtqkqJXywj1rGC9PQ4QoZbzwsuNsUUGjGAPR3SQF6TqZrIPIDIInTEUJPvSxdaWBCKLvHBpU2gmuZFM",
    serviceWorkerRegistration: registration
  });

  // 🔥 Save locally
  let list = JSON.parse(localStorage.getItem(TRACK_KEY) || "[]");

  // 🔥 Get display values
  const movieName = document.querySelector(".movie-card.selected .movie-title")?.innerText || "Movie";

  const dateText = document.querySelector("#dates .selected")?.innerText || selectedDate;

  const timeText = document.querySelector("#timings .selected")?.innerText || "";

  // 🔥 CHECK DUPLICATE
  const exists = list.find(
    t =>
      t.movieId === selectedSessionId &&
      t.date === dateText &&
      t.time === timeText
  );

  if (exists) {
    alert("⚠️ Already tracking this show");
    return;
  }

  // ✅ ADD ONLY IF NOT EXISTS
  list.push({
    movieId: selectedSessionId,
    movieName,
    date: dateText,
    time: timeText
  });

  localStorage.setItem(TRACK_KEY, JSON.stringify(list));

  renderTrackings();

  await fetch("https://miraj-cinemas-seat-tracker.onrender.com/track", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      token,
      movieId: selectedSessionId,
      area: "SPECIAL"
    })
  });

  alert(`✅ Tracking started: ${movieName} (${dateText} ${timeText}`);
}

// 📋 Show Active Trackings
function renderTrackings() {
  const container = document.getElementById("active");
  if (!container) return;

  container.innerHTML = "";

  let list = JSON.parse(localStorage.getItem(TRACK_KEY) || "[]");

  list.forEach((t, index) => {
    const div = document.createElement("div");

    div.style.marginBottom = "10px";
    div.style.padding = "10px";
    div.style.border = "1px solid #ccc";
    div.style.borderRadius = "8px";

    div.innerHTML = `
      <div><b>🎬 ${t.movieName}</b></div>
      <div>📅 ${t.date} | ⏰ ${t.time}</div>
      <button onclick="removeTracking(${index})">❌ Untrack</button>
    `;

    container.appendChild(div);
  });
}

// ❌ Remove tracking
async function removeTracking(index) {
  let list = JSON.parse(localStorage.getItem(TRACK_KEY) || "[]");

  const item = list[index];

  try {
    // 🔥 Get token
    const registration = await navigator.serviceWorker.ready;

    const token = await messaging.getToken({
      vapidKey: "BJdiJWaKqtqkqJXywj1rGC9PQ4QoZbzwsuNsUUGjGAPR3SQF6TqZrIPIDIInTEUJPvSxdaWBCKLvHBpU2gmuZFM",
      serviceWorkerRegistration: registration
    });

    // 🔥 Call backend to stop tracking
    await fetch("https://miraj-cinemas-seat-tracker.onrender.com/untrack", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        token,
        movieId: item.movieId
      })
    });

    // 🔥 Remove locally
    list.splice(index, 1);

    localStorage.setItem(TRACK_KEY, JSON.stringify(list));

    renderTrackings();

    // ✅ SUCCESS ALERT
    alert(`✅ Untracked: ${item.movieName} (${item.date} ${item.time})`);

  } catch (err) {
    console.error(err);

    // ❌ ERROR ALERT
    alert("❌ Failed to untrack. Try again.");
  }
}

// 🚀 init
loadMovies();
renderTrackings();