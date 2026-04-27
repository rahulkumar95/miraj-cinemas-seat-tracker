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

// 🔥 status stores
let currentStatus = {};
let previousStatus = {};

// 🔒 RUN LOCK
let isRunning = false;

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

// ❌ UNTRACK (WITH DELETE)
app.post("/untrack", (req, res) => {
  const { token, sessionId } = req.body;

  trackers = trackers.filter(
    t => !(t.token === token && t.sessionId === sessionId)
  );

  // 🔥 REMOVE STATUS ALSO
  delete currentStatus[sessionId];
  delete previousStatus[sessionId];

  console.log("❌ Removed tracking + cleared status:", sessionId);

  res.send("Tracking removed");
});

// ⏰ CRON WITH LOCK
cron.schedule("*/1 * * * *", async () => {
  if (isRunning) return;
  isRunning = true;

  try {
    for (let t of trackers) {

      // 🔥 CHECK AGAIN (in case removed mid-run)
      const stillExists = trackers.find(
        x => x.token === t.token && x.sessionId === t.sessionId
      );

      if (!stillExists) continue;

      try {
        const res = await fetch(
          `https://mirajcinemas.com/api/v1.0/webapp/seat_layout/${t.sessionId}/0210`
        );

        const data = await res.json();

        const rawTime = data?.data?.sessionDetails?.Session_dtmRealShow;
        const movieName = data?.data?.movieDetails?.Film_strTitle || "Movie";

        const showTime = new Date(rawTime);

        // 🔥 IST FORMAT
        const timing = showTime.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
          timeZone: "Asia/Kolkata"
        });

        const dateStr = showTime.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          timeZone: "Asia/Kolkata"
        });

        // 🔥 STOP AFTER SHOW START
        const nowIST = new Date(
          new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
        );

        if (nowIST > showTime) {
          trackers = trackers.filter(x => x.sessionId !== t.sessionId);

          delete currentStatus[t.sessionId];
          delete previousStatus[t.sessionId];

          console.log("⏹️ Auto stopped:", t.sessionId);
          continue;
        }

        const areas = data?.data?.seatLayout?.result?.seats?.area;
        if (!areas) continue;

        let result = [];

        for (let area of areas) {
          if (
            (area.strAreaDesc || "")
              .toLowerCase()
              .includes((t.area || "").toLowerCase())
          ) {
            for (let row of area.rows) {
              let seats = [];

              for (let seat of row.seats) {
                if (
                  ["0", 0, "A", "AVAILABLE"].includes(seat.strSeatStatus) &&
                  seat.strSeatNumber &&
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

        let seatSummary = "No seats";

        if (result.length > 0) {
          seatSummary = result
            .map(r => `${r.row}(${r.seats.length}): ${r.seats.join(",")}`)
            .join(" | ");
        }

        const prevSummary =
          currentStatus[t.sessionId]?.seatSummary || "No seats";

        previousStatus[t.sessionId] = currentStatus[t.sessionId];

        currentStatus[t.sessionId] = {
          movieName,
          timing,
          dateStr,
          seatSummary
        };

        const hasSeatsNow = result.length > 0;

        // 🔥 ALWAYS NOTIFY WHEN SEATS
        if (hasSeatsNow) {
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
  } finally {
    isRunning = false;
  }
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