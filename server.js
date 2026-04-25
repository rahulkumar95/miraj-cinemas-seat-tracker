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

// 🔥 Store trackers
// { token, movieId (sessionId) }
let trackers = [];

// 🔑 Firebase setup
const serviceAccount = require("/etc/secrets/serviceAccount.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// 🚀 API to start tracking
app.post("/track", (req, res) => {
  const { token, movieId } = req.body;

  if (!token || !movieId) {
    return res.status(400).send("Missing token/movieId");
  }

  const exists = trackers.find(
    t => t.token === token && t.movieId === movieId
  );

  if (!exists) {
    trackers.push({ token, movieId });
  }

  console.log("Trackers:", trackers);

  res.send("✅ Tracking started");
});

// ⏱ Prevent overlapping runs
let isRunning = false;

// ⏰ Run every 30 seconds
cron.schedule("*/1 * * * *", async () => {
  if (isRunning) return;
  isRunning = true;

  console.log("⏰ Checking seats...");

  for (let t of trackers) {
    try {
      const res = await fetch(
        `https://mirajcinemas.com/api/v1.0/webapp/seat_layout/${t.movieId}/0210`
      );

      const data = await res.json();

      const movieName =
        data?.data?.movieDetails?.Film_strTitle || "Movie";

      const rawTime =
        data?.data?.sessionDetails?.Session_dtmRealShow;

      const timing = rawTime
        ? new Date(rawTime).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit"
        })
        : "Time";

      const areas =
        data?.data?.seatLayout?.result?.seats?.area;

      if (!areas) continue;

      let result = [];

      // 🎯 ONLY SPECIAL AREA
      for (let area of areas) {
        if (area.strAreaDesc === "SPECIAL") {
          for (let row of area.rows) {
            let seats = [];

            for (let seat of row.seats) {
              if (
                seat.strSeatStatus === "0" &&
                seat.strSeatNumber !== "0"
              ) {
                seats.push(seat.strSeatNumber);
              }
            }

            if (seats.length > 0) {
              result.push({
                row: row.strRowPhyID,
                seats: seats
              });
            }
          }
        }
      }

      if (result.length > 0) {
        const seatSummary = result
          .map(
            r =>
              `${r.row}(${r.seats.length}): ${r.seats.join(",")}`
          )
          .join(" | ");

        console.log(
          `🎉 Seats found for ${movieName} ${timing}:`,
          seatSummary
        );

        try {
          const response = await admin.messaging().send({
            notification: {
              title: `🎬 ${movieName}`,
              body: `${timing} | ${seatSummary}`
            },
            android: {
              priority: "high",
              notification: {
                channelId: "seat-alerts-v1",
                sound: "default",
                tag: `${t.movieId}`   // ✅ grouping still works
              }
            },
            token: t.token
          });

          console.log("✅ Notification sent:", response);
        } catch (err) {
          console.error("❌ Firebase error:", err.message);

          // Remove invalid tokens
          if (
            err.code ===
            "messaging/registration-token-not-registered"
          ) {
            trackers = trackers.filter(
              x => x.token !== t.token
            );
          }
        }
      } else {
        console.log(
          `❌ No seats for ${movieName} ${timing}`
        );
      }
    } catch (err) {
      console.error("Error:", err.message);
    }
  }

  isRunning = false;
});

// 🟢 Health check
app.get("/", (req, res) => {
  res.send("Server running 🚀");
});

// 🚀 Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);