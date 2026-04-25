// 🔥 paste your firebase config here
const firebaseConfig = {
    apiKey: "AIzaSyCXqXv-YG802yzBwPItL4MLdP1LtfwYdrc",
    authDomain: "miraj-cinemas-seat-tracker.firebaseapp.com",
    projectId: "miraj-cinemas-seat-tracker",
    storageBucket: "miraj-cinemas-seat-tracker.firebasestorage.app",
    messagingSenderId: "1052153141275",
    appId: "1:1052153141275:web:5efb211370fb6c8e19c0be",
    measurementId: "G-Y3R222RVED"
  };

// init firebase
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

async function start() {
  const permission = await Notification.requestPermission();

  if (permission !== "granted") return;

  const token = await messaging.getToken({
    vapidKey: "BJdiJWaKqtqkqJXywj1rGC9PQ4QoZbzwsuNsUUGjGAPR3SQF6TqZrIPIDIInTEUJPvSxdaWBCKLvHBpU2gmuZFM"
  });

  const movieId = document.getElementById("movieId").value;
  const row = document.getElementById("row").value;

  // send token
  await fetch("https://miraj-cinemas-seat-tracker.onrender.com/save-token", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ token })
  });

  // start tracking
  await fetch("https://miraj-cinemas-seat-tracker.onrender.com/track", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ movieId, row })
  });

  alert("Tracking started!");
}