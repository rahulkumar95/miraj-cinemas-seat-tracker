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

    // Ask permission
    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      alert("Permission denied");
      return;
    }

    // ✅ Register Service Worker (FIXED PATH + SCOPE)
    const registration = await navigator.serviceWorker.register(
      "firebase-messaging-sw.js",
      {
        scope: "./"
      }
    );

    // ✅ WAIT for activation (VERY IMPORTANT)
    await navigator.serviceWorker.ready;

    console.log("Service Worker Ready");

    // ✅ Get token
    const token = await messaging.getToken({
      vapidKey: "BJdiJWaKqtqkqJXywj1rGC9PQ4QoZbzwsuNsUUGjGAPR3SQF6TqZrIPIDIInTEUJPvSxdaWBCKLvHBpU2gmuZFM",
      serviceWorkerRegistration: registration
    });

    console.log("TOKEN:", token);

    alert("✅ Notifications enabled!");

  } catch (err) {
    console.error(err);
    alert("Error: " + err.message);
  }
}