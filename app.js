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

    img.onerror = () => {
      img.src = "https://via.placeholder.com/150";
    };

    const title = document.createElement("div");
    title.className = "movie-title";
    title.innerText = movie.Film_strTitle;

    card.appendChild(img);
    card.appendChild(title);

    card.onclick = () => loadDates(movie.Film_strCode);

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
      headers: {
        "city-id": "4"
      }
    }
  );

  const data = await res.json();
  const sessions = data?.data?.sessionsArr || [];

  const container = document.getElementById("timings");
  container.innerHTML = "";

  let foundTiming = false;

  // 🔍 Loop through sessions
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

  // 🚨 No timings found
  if (!foundTiming) {
    alert("⚠️ No shows opened yet");

    const msg = document.createElement("div");
    msg.innerText = "No shows available for this date";
    msg.style.color = "red";

    container.appendChild(msg);
  }
}

// 🔔 Start Tracking
async function startTracking() {
  if (!selectedSessionId) {
    alert("Select movie, date, timing");
    return;
  }

  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    alert("Permission denied");
    return;
  }

  const registration = await navigator.serviceWorker.register(
    "firebase-messaging-sw.js"
  );

  await navigator.serviceWorker.ready;

  const token = await messaging.getToken({
    vapidKey: "BJdiJWaKqtqkqJXywj1rGC9PQ4QoZbzwsuNsUUGjGAPR3SQF6TqZrIPIDIInTEUJPvSxdaWBCKLvHBpU2gmuZFM",
    serviceWorkerRegistration: registration
  });

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

  alert("✅ Tracking started!");
}

// 🚀 init
loadMovies();