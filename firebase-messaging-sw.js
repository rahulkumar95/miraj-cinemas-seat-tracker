importScripts("https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js");
importScripts("https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js");

// 🔥 SAME config as app.js
firebase.initializeApp({
  apiKey: "AIzaSyCXqXv-YG802yzBwPItL4MLdP1LtfwYdrc",
  authDomain: "miraj-cinemas-seat-tracker.firebaseapp.com",
  projectId: "miraj-cinemas-seat-tracker",
  storageBucket: "miraj-cinemas-seat-tracker.firebasestorage.app",
  messagingSenderId: "1052153141275",
  appId: "1:1052153141275:web:5efb211370fb6c8e19c0be",
  measurementId: "G-Y3R222RVED"
});

const messaging = firebase.messaging();

// Background notification handler
messaging.setBackgroundMessageHandler(function (payload) {
  console.log("Background message:", payload);

  const title = payload.data?.title || "Seat Alert";
  const body = payload.data?.body || "";
  const tag = payload.data?.tag || "seat-alert";

  return self.registration.showNotification(title, {
    body: body,
    icon: "icon.png",
    tag: tag, // Now this is the ONLY notification that will show
    renotify: true,
    vibrate: [200, 100, 200],
    requireInteraction: true,
    data: payload.data
  });
});