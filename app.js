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

// 🔥 Prevent duplicate renders
let isFetchingTrackings = false;

// 🔥 Track newly added (for highlight)
let lastAddedSessionId = null;

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

    card.innerHTML = `
      <img src="https://mirajcinemas.com${movie.image_path_1}" />
      <div class="movie-title">${movie.Film_strTitle}</div>
    `;

    card.onclick = () => {
      document.querySelectorAll(".movie-card").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");

      selectedMovie = movie.Film_strCode;
      selectedSessionId = null;

      document.getElementById("dates").innerHTML = "";
      document.getElementById("timings").innerHTML = "";

      document.getElementById("datesTitle").innerText =
        `📅 Dates (${movie.Film_strTitle})`;

      loadDates(movie.Film_strCode);

      setTimeout(() => {
        document.getElementById("dates").scrollIntoView({ behavior: "smooth" });
      }, 200);
    };

    container.appendChild(card);
  });
}

// 📅 Load Dates
function loadDates(movieCode) {
  const container = document.getElementById("dates");
  container.innerHTML = "";

  const today = new Date();

  for (let i = 0; i < 10; i++) {
    const d = new Date();
    d.setDate(today.getDate() + i);

    const dateStr =
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0");

    const formattedDate = d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short"
    });

    const btn = document.createElement("button");
    btn.innerText = formattedDate;

    btn.onclick = () => {
      document.querySelectorAll("#dates button").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");

      loadTimings(movieCode, dateStr);

      document.getElementById("timings").scrollIntoView({ behavior: "smooth" });
    };

    container.appendChild(btn);
  }
}

// ⏰ Load Timings
async function loadTimings(movieCode, date) {
  selectedDate = date;

  // 🔥 ALWAYS reset when loading new timings
  selectedSessionId = null;

  // 🔥 Disable button
  document.getElementById("trackBtn").disabled = true;

  const res = await fetch(
    `https://mirajcinemas.com/api/v1.0/webapp/session/${movieCode}/${date}`,
    { headers: { "city-id": "4" } }
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

          // 🔥 Enable button when timing selected
          document.getElementById("trackBtn").disabled = false;

          selectedSessionId = t.id;
        };

        container.appendChild(btn);
      });
    });
  });

  if (!foundTiming) {
    alert("⚠️ No shows opened yet");
  } else {
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

  const res = await fetch("https://miraj-cinemas-seat-tracker.onrender.com/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token,
      sessionId: selectedSessionId,
      area: "SPECIAL"
    })
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.message);
    return;
  }

  // 🔥 mark for highlight
  lastAddedSessionId = selectedSessionId;

  alert(`✅ Tracking started: ${data.movieName} (${data.dateStr} ${data.timing})`);

  // 🔥 Reset button again
  document.getElementById("trackBtn").disabled = true;
  selectedSessionId = null;

  // 🔥 slight delay to avoid race
  setTimeout(renderTrackings, 300);

  // 🔥 scroll to active tracking
  setTimeout(() => {
    document.getElementById("active").scrollIntoView({ behavior: "smooth" });
  }, 500);
}

// 📋 Active Trackings (with loader + highlight)
async function renderTrackings() {

  if (isFetchingTrackings) return;
  isFetchingTrackings = true;

  const container = document.getElementById("active");

  // 🔥 loading state
  container.innerHTML = "<div style='opacity:0.6'>⏳ Loading...</div>";

  try {
    const registration = await navigator.serviceWorker.ready;

    const token = await messaging.getToken({
      vapidKey: "BJdiJWaKqtqkqJXywj1rGC9PQ4QoZbzwsuNsUUGjGAPR3SQF6TqZrIPIDIInTEUJPvSxdaWBCKLvHBpU2gmuZFM",
      serviceWorkerRegistration: registration
    });

    const res = await fetch("https://miraj-cinemas-seat-tracker.onrender.com/my-trackings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    });

    const data = await res.json();

    const list = data.trackings || [];

    container.innerHTML = "";

    if (list.length === 0) {
      container.innerHTML = "<div>No active tracking</div>";
      return;
    }

    list.forEach(t => {
      const div = document.createElement("div");

      // 🔥 card style
      div.style.marginBottom = "10px";
      div.style.padding = "12px";
      div.style.border = "1px solid #ccc";
      div.style.borderRadius = "10px";
      div.style.background = "#f9f9f9";

      // 🔥 highlight newly added
      if (t.sessionId == lastAddedSessionId) {
        div.style.border = "2px solid green";
        div.style.background = "#eaffea";

        // remove highlight after render
        setTimeout(() => {
          lastAddedSessionId = null;
        }, 1000);
      }

      div.innerHTML = `
        <div><b>🎬 ${t.movieName}</b></div>
        <div>📅 ${t.dateStr} | ⏰ ${t.timing}</div>
        <button onclick="removeTracking('${t.sessionId}', '${t.movieName}', '${t.dateStr}', '${t.timing}')">❌ Untrack</button>
      `;

      container.appendChild(div);
    });

  } catch (err) {
    console.error("Error loading trackings:", err);
  }

  isFetchingTrackings = false;
}

// ❌ Remove Tracking
async function removeTracking(sessionId, movieName, date, time) {
  const registration = await navigator.serviceWorker.ready;

  const token = await messaging.getToken({
    vapidKey: "BJdiJWaKqtqkqJXywj1rGC9PQ4QoZbzwsuNsUUGjGAPR3SQF6TqZrIPIDIInTEUJPvSxdaWBCKLvHBpU2gmuZFM",
    serviceWorkerRegistration: registration
  });

  await fetch("https://miraj-cinemas-seat-tracker.onrender.com/untrack", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token,
      sessionId
    })
  });

  renderTrackings();

  alert(`✅ Untracked: ${movieName} (${date} ${time})`);
}

// 🔁 Auto refresh
setInterval(renderTrackings, 10000);

// 🚀 init
loadMovies();
renderTrackings();