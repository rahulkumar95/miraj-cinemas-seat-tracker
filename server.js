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

// 🔥 In-memory store
let trackers = [];

// 🔥 NEW: live + previous
let currentStatus = {};
let previousStatus = {};

// 🔑 Firebase
const serviceAccount = require("/etc/secrets/serviceAccount.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// 🟢 Health
app.get("/health", (req, res) => {
  res.send("OK");
});

// 📡 STATUS API
app.get("/status", (req, res) => {
  res.json({
    trackers,
    currentStatus,
    previousStatus
  });
});

// ✅ TRACK
app.post("/track", (req, res) => {
  const { token, sessionId, area } = req.body;

  if (!token || !sessionId) {
    return res.status(400).send("Missing data");
  }

  const exists = trackers.find(
    t => t.token === token && t.sessionId === sessionId
  );

  if (!exists) {
    trackers.push({ token, sessionId, area });
  }

  console.log("✅ Added tracking:", sessionId);
  res.send("✅ Tracking started");
});

// ❌ UNTRACK
app.post("/untrack", (req, res) => {
  const { token, sessionId } = req.body;

  trackers = trackers.filter(
    t => !(t.token === token && t.sessionId === sessionId)
  );

  delete currentStatus[sessionId];
  delete previousStatus[sessionId];

  console.log("❌ Removed tracking:", sessionId);
  res.send("Tracking removed");
});

// ⏱ Prevent overlap
let isRunning = false;

// ⏰ CRON
cron.schedule("*/1 * * * *", async () => {
  if (isRunning) return;
  isRunning = true;

  const now = new Date();

  for (let t of trackers) {
    try {
      const res = await fetch(
        `https://mirajcinemas.com/api/v1.0/webapp/seat_layout/${t.sessionId}/0210`
      );

      const data = await res.json();

      const rawTime = data?.data?.sessionDetails?.Session_dtmRealShow;
      const movieName = data?.data?.movieDetails?.Film_strTitle || "Movie";

      const showTime = rawTime ? new Date(rawTime) : null;

      // 🔥 STOP AFTER SHOW START
      if (showTime && now > showTime) {
        console.log("⏹️ Auto stopping:", t.sessionId);
        trackers = trackers.filter(x => x.sessionId !== t.sessionId);
        delete currentStatus[t.sessionId];
        delete previousStatus[t.sessionId];
        continue;
      }

      const timing = rawTime
        ? new Date(rawTime).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Kolkata"
        })
        : "";

      const dateStr = rawTime
        ? new Date(rawTime).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          timeZone: "Asia/Kolkata"
        })
        : "";

      const areas = data?.data?.seatLayout?.result?.seats?.area;
      if (!areas) continue;

      let result = [];

      for (let area of areas) {
        if (area.strAreaDesc === t.area) {
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
                seats
              });
            }
          }
        }
      }

      const seatSummary = result
        .map(r => `${r.row}(${r.seats.length}): ${r.seats.join(",")}`)
        .join(" | ");

      // 🔥 MOVE current → previous
      previousStatus[t.sessionId] = currentStatus[t.sessionId];

      // 🔥 UPDATE current
      currentStatus[t.sessionId] = {
        movieName,
        dateStr,
        timing,
        seatSummary
      };

      if (seatSummary) {
        await admin.messaging().send({
          notification: {
            title: `🎬 ${movieName}`,
            body: `${dateStr} ${timing} | ${seatSummary}`
          },
          android: {
            priority: "high",
            notification: {
              channelId: "seat-alerts-v1",
              sound: "default",
              tag: `${t.sessionId}`
            }
          },
          data: {
            tag: `${t.sessionId}`
          },
          token: t.token
        });

        console.log("✅ Notified:", movieName);
      }

    } catch (err) {
      console.error("Error:", err.message);
    }
  }

  isRunning = false;
});

// 🚀 Root
app.get("/", (req, res) => {
  res.send("Server running 🚀");
});

// 🚀 Start
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});