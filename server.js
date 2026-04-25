const express = require("express");
const cron = require("node-cron");
const fetch = require("node-fetch");
const admin = require("firebase-admin");

const app = express();
app.use(express.json());

let tokens = [];
let trackers = [];

// 🔥 Firebase setup
const serviceAccount = require("./serviceAccount.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Save device token
app.post("/save-token", (req, res) => {
  tokens.push(req.body.token);
  res.send("Token saved");
});

// Save tracking request
app.post("/track", (req, res) => {
  trackers.push(req.body); // { movieId, row }
  res.send("Tracking started");
});

// ⏰ Runs every 5 mins
cron.schedule("*/5 * * * *", async () => {
  console.log("Checking seats...");

  for (let t of trackers) {
    const res = await fetch(
      `https://mirajcinemas.com/api/v1.0/webapp/seat_layout/${t.movieId}/0210`
    );
    const data = await res.json();

    const seats = data.data.SeatLayout;

    const available = seats.filter(
      s => s.RowName === t.row && s.IsAvailable
    );

    if (available.length > 0 && tokens.length > 0) {
      await admin.messaging().send({
        notification: {
          title: "🎉 Seats Available!",
          body: `Row ${t.row} has seats`
        },
        token: tokens[0]
      });
    }
  }
});

app.listen(3000, () => console.log("Server running"));