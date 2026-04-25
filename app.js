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