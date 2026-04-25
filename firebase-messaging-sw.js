importScripts("https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js");
importScripts("https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js");

// 🔥 Same config as app.js
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

// Handle background notifications
messaging.setBackgroundMessageHandler(function(payload) {
  console.log("Message received:", payload);

  return self.registration.showNotification(
    payload.notification.title,
    {
      body: payload.notification.body
    }
  );
});