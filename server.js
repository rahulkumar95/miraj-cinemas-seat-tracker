const express = require("express");
const cors = require("cors");
const cron = require("node-cron");
const fetch = require("node-fetch");
const admin = require("firebase-admin");

const app = express();

app.use(cors({
  origin: "https://rahulkumar95.github.io"
}));

app.use(express.json());

// 🔥 In-memory storage (simple version)
let trackers = []; 
// Each item: { token, movieId, row }

// 🔑 Firebase Admin Setup
const serviceAccount = require("/etc/secrets/serviceAccount.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// 🚀 API: Start tracking
app.post("/track", (req, res) => {
  const { token, movieId, row } = req.body;

  if (!token || !movieId || !row) {
    return res.status(400).send("Missing fields");
  }

  // Avoid duplicates
  const exists = trackers.find(
    t => t.token === token && t.movieId === movieId && t.row === row
  );

  if (!exists) {
    trackers.push({ token, movieId, row });
  }

  console.log("Current trackers:", trackers);

  res.send("✅ Tracking started");
});

// ⏰ Cron job: runs every 5 minutes
cron.schedule("*/1 * * * *", async () => {
  console.log("⏰ Checking seats...");

  for (let t of trackers) {
    try {
      const res = await fetch(
        `https://mirajcinemas.com/api/v1.0/webapp/seat_layout/${t.movieId}/0210`
      );

      const data = await res.json();

      const areas = data?.data?.seatLayout?.result?.seats?.area;

      if (!areas) {
        console.log("No seat data found");
        continue;
      }

      let availableSeats = [];

      for (let area of areas) {
        for (let row of area.rows) {
          if (row.strRowPhyID === t.row) {
            for (let seat of row.seats) {
              if (
                seat.strSeatStatus === "0" && 
                seat.strSeatNumber !== "0"
              ) {
                availableSeats.push(seat.strSeatNumber);
              }
            }
          }
        }
      }

      if (availableSeats.length > 0) {
        console.log(`🎉 Seats found for Row ${t.row}:`, availableSeats);

        await admin.messaging().send({
          notification: {
            title: "🎉 Seats Available!",
            body: `Row ${t.row}: ${availableSeats.join(", ")}`
          },
          token: t.token
        });

      } else {
        console.log(`❌ No seats for Row ${t.row}`);
      }

    } catch (err) {
      console.error("Error checking seats:", err.message);
    }
  }
});

// 🟢 Health check
app.get("/", (req, res) => {
  res.send("Server is running 🚀");
});

// 🚀 Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});