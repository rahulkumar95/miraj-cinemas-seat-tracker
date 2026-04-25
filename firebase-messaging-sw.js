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

  const title = payload.notification?.title || "Seat Alert";

  const body = payload.notification?.body || "";

  // 🔥 get tag from BOTH android + data
  const tag =
    payload.data?.tag ||
    payload.notification?.tag ||
    "seat-alert";

  return self.registration.showNotification(title, {
    body: body,
    icon: "icon.png",
    sound: "default", // 🔥 important

    // 🔥 ANDROID + WEB COMPATIBLE
    tag: tag,                 // grouping
    renotify: true,           // 🔥 re-alert on update
    vibrate: [200, 100, 200],
    requireInteraction: true,

    // 🔥 Android hint (not always respected in PWA)
    silent: false
  });
});