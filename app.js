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

// 🔔 Foreground notification
messaging.onMessage(payload => {
  console.log("Foreground message:", payload);

  new Notification(payload.notification.title, {
    body: payload.notification.body,
    icon: "icon.png"
  });
});

// 🎬 Load Movies
async function loadMovies() {
  const res = await fetch("https://mirajcinemas.com/api/v1.0/webapp/movies", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "city-id": "4"
    },
    body: JSON.stringify({ topTab: "now_showing" })
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

      // 🔥 Update heading
      document.getElementById("datesTitle").innerText =
        `📅 Dates (${movie.Film_strTitle})`;

      // 🔥 Load dates for selected movie
      loadDates(movie.Film_strCode);

      // 🔥 Smooth scroll (mobile friendly)
      setTimeout(() => {
        document.getElementById("dates").scrollIntoView({ behavior: "smooth" });
      }, 200);
    };

    container.appendChild(card);
  });
}

// 📅 Load Dates (IST FIXED)
function loadDates(movieCode) {
  const container = document.getElementById("dates");
  container.innerHTML = "";

  const today = new Date();

  for (let i = 0; i < 10; i++) {
    const d = new Date();
    d.setDate(today.getDate() + i);

    // 🔥 FIX: avoid GMT shift
    const dateStr =
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0");

    const formattedDate = d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      timeZone: "Asia/Kolkata"
    });

    const btn = document.createElement("button");
    btn.innerText = formattedDate;

    btn.onclick = () => {
      document.querySelectorAll("#dates button").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");

      // 🔥 Load timings
      loadTimings(movieCode, dateStr);

      // 🔥 SCROLL to timings
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
    { headers: { "city-id": "4" } }
  );

  const data = await res.json();
  const sessions = data?.data?.sessionsArr || [];

  const container = document.getElementById("timings");
  container.innerHTML = "";

  let foundTiming = false;

  // 🔥 CURRENT IST TIME
  const nowIST = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );

  sessions.forEach(s => {
    (s.sessionDetails || []).forEach(detail => {
      (detail.timing || []).forEach(t => {

        const showTime = new Date(t.time);

        // 🔥 FILTER: skip already started shows
        if (showTime <= nowIST) return;

        foundTiming = true;

        const formattedTime = showTime.toLocaleTimeString("en-IN", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
          timeZone: "Asia/Kolkata"
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
    alert("⚠️ No upcoming shows available");
  } else {
    // 🔥 SCROLL TO BOTTOM so Start Tracking button is visible
    setTimeout(() => {
      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: "smooth"
      });
    }, 200);
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

  const registration = await navigator.serviceWorker.register("firebase-messaging-sw.js");
  await navigator.serviceWorker.ready;

  const token = await messaging.getToken({
    vapidKey: "BJdiJWaKqtqkqJXywj1rGC9PQ4QoZbzwsuNsUUGjGAPR3SQF6TqZrIPIDIInTEUJPvSxdaWBCKLvHBpU2gmuZFM",
    serviceWorkerRegistration: registration
  });

  // 🔥 Save locally
  let list = JSON.parse(localStorage.getItem(TRACK_KEY) || "[]");

  // 🔥 CHECK DUPLICATE (sessionId based)
  if (list.find(t => t.sessionId === selectedSessionId)) {
    alert("⚠️ Already tracking this show");
    return;
  }

  // 🔥 Get display values
  const movieName = document.querySelector(".movie-card.selected .movie-title")?.innerText || "Movie";
  const dateText = document.querySelector("#dates .selected")?.innerText || "";
  const timeText = document.querySelector("#timings .selected")?.innerText || "";

  // ✅ ADD ONLY IF NOT EXISTS
  list.push({
    sessionId: selectedSessionId,
    movieName,
    date: dateText,
    time: timeText
  });

  localStorage.setItem(TRACK_KEY, JSON.stringify(list));

  renderTrackings();

  await fetch("https://miraj-cinemas-seat-tracker.onrender.com/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token,
      sessionId: selectedSessionId,
      area: "SPECIAL"
    })
  });

  alert(`✅ Tracking started: ${movieName} (${dateText} ${timeText})`);
}

// 📡 Fetch live status
async function fetchStatus() {
  const res = await fetch("https://miraj-cinemas-seat-tracker.onrender.com/status");
  const data = await res.json();
  updateActiveWithStatus(data);
}

// 📋 Show Active Trackings
function renderTrackings() {
  fetchStatus();

  // 🔥 Scroll back to active tracking section
  setTimeout(() => {
    document.getElementById("active").scrollIntoView({ behavior: "smooth" });
  }, 200);
}

// 🎯 Update UI with live + last data
function updateActiveWithStatus(serverData) {
  const container = document.getElementById("active");
  container.innerHTML = "";

  let list = JSON.parse(localStorage.getItem(TRACK_KEY) || "[]");

  list.forEach((t, index) => {
    const current = serverData.currentStatus?.[t.sessionId];
    const previous = serverData.previousStatus?.[t.sessionId];

    const div = document.createElement("div");

    // 🔥 Card UI
    div.style.border = "1px solid #ccc";
    div.style.padding = "10px";
    div.style.marginBottom = "10px";
    div.style.borderRadius = "10px";
    div.style.background = "#f9f9f9";

    div.innerHTML = `
      <div><b>🎬 ${t.movieName}</b></div>
      <div>📅 ${t.date} | ⏰ ${t.time}</div>
      <div>🟢 Live: ${current?.seatSummary || "No seats now"}</div>
      <div>🪑 Last: ${previous?.seatSummary || "No previous data"}</div>
      <button onclick="removeTracking(${index})">❌ Untrack</button>
    `;

    container.appendChild(div);
  });
}

// ❌ Remove Tracking
async function removeTracking(index) {
  let list = JSON.parse(localStorage.getItem(TRACK_KEY) || "[]");

  const item = list[index];

  // 🔥 Get token
  const registration = await navigator.serviceWorker.ready;

  const token = await messaging.getToken({
    vapidKey: "BJdiJWaKqtqkqJXywj1rGC9PQ4QoZbzwsuNsUUGjGAPR3SQF6TqZrIPIDIInTEUJPvSxdaWBCKLvHBpU2gmuZFM",
    serviceWorkerRegistration: registration
  });

  // 🔥 Call backend to stop tracking
  await fetch("https://miraj-cinemas-seat-tracker.onrender.com/untrack", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token,
      sessionId: item.sessionId
    })
  });

  // 🔥 Remove locally
  list.splice(index, 1);

  localStorage.setItem(TRACK_KEY, JSON.stringify(list));

  renderTrackings();

  // ✅ SUCCESS ALERT
  alert(`✅ Untracked: ${item.movieName} (${item.date} ${item.time})`);
}

// 🔁 Auto refresh
setInterval(fetchStatus, 10000);

// 🚀 init
loadMovies();
renderTrackings();