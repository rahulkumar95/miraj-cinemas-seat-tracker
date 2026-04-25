// 🔥 Replace with your Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyCXqXv-YG802yzBwPItL4MLdP1LtfwYdrc",
    authDomain: "miraj-cinemas-seat-tracker.firebaseapp.com",
    projectId: "miraj-cinemas-seat-tracker",
    storageBucket: "miraj-cinemas-seat-tracker.firebasestorage.app",
    messagingSenderId: "1052153141275",
    appId: "1:1052153141275:web:5efb211370fb6c8e19c0be",
    measurementId: "G-Y3R222RVED"
  };

// Init Firebase
firebase.initializeApp(firebaseConfig);

let messaging = null;

if (firebase.messaging.isSupported()) {
  messaging = firebase.messaging();
} else {
  alert("❌ Messaging not supported");
}

async function start() {
  try {
    if (!messaging) {
      alert("Messaging not available");
      return;
    }

    const movieId = document.getElementById("movieId").value;
    const row = document.getElementById("row").value;

    if (!movieId || !row) {
      alert("Enter movieId and row");
      return;
    }

    // Ask permission
    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      alert("Permission denied");
      return;
    }

    // Register service worker
    const registration = await navigator.serviceWorker.register(
      "firebase-messaging-sw.js",
      { scope: "./" }
    );

    await navigator.serviceWorker.ready;

    // Get token
    const token = await messaging.getToken({
      vapidKey: "BJdiJWaKqtqkqJXywj1rGC9PQ4QoZbzwsuNsUUGjGAPR3SQF6TqZrIPIDIInTEUJPvSxdaWBCKLvHBpU2gmuZFM",
      serviceWorkerRegistration: registration
    });

    console.log("TOKEN:", token);

    // 🔥 IMPORTANT: send ALL in one API
    await fetch("https://miraj-cinemas-seat-tracker.onrender.com/track", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        token,
        movieId,
        row
      })
    });

    alert("✅ Tracking started!");

  } catch (err) {
    console.error(err);
    alert("Error: " + err.message);
  }
}