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
// key = sessionId_token
let trackers = new Map();

// 🔥 Firebase
const serviceAccount = require("/etc/secrets/serviceAccount.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// 🟢 Health
app.get("/health", (req, res) => {
  res.send("OK");
});

// ✅ TRACK
app.post("/track", (req, res) => {
  const { token, sessionId, area } = req.body;

  if (!token || !sessionId) {
    return res.status(400).json({
      success: false,
      message: "Missing data"
    });
  }

  const key = `${sessionId}_${token}`;

  // 🔥 DUPLICATE CHECK
  if (trackers.has(key)) {
    console.log("⚠️ Duplicate attempt:", key);

    return res.status(409).json({
      success: false,
      message: "⚠️ Already tracking this show"
    });
  }

  trackers.set(key, { token, sessionId, area });

  console.log("✅ Added tracking:", key);

  res.json({
    success: true,
    message: "✅ Tracking started"
  });
});

// ❌ UNTRACK
app.post("/untrack", (req, res) => {
  const { token, sessionId } = req.body;

  const key = `${sessionId}_${token}`;

  trackers.delete(key);

  console.log("❌ Removed tracking:", key);

  res.send("Tracking removed");
});

// 📋 GET TRACKINGS FOR USER
app.post("/my-trackings", (req, res) => {
  const { token } = req.body;

  let list = [];

  for (let t of trackers.values()) {
    if (t.token === token) {
      list.push(t);
    }
  }

  res.json({ trackings: list });
});

// ⏱ Prevent overlap (IMPORTANT)
let isRunning = false;

// ⏰ Check seats (OPTIMIZED)
cron.schedule("*/1 * * * *", async () => {
  if (isRunning) return;
  isRunning = true;

  try {
    // 🔥 STEP 1: Group trackers by sessionId (avoid repeated API calls)
    const sessionMap = {};

    for (let t of trackers.values()) {
      if (!sessionMap[t.sessionId]) {
        sessionMap[t.sessionId] = [];
      }
      sessionMap[t.sessionId].push(t);
    }

    // 🔥 STEP 2: Process each session only once
    for (let sessionId in sessionMap) {
      const users = sessionMap[sessionId];

      try {
        const res = await fetch(
          `https://mirajcinemas.com/api/v1.0/webapp/seat_layout/${sessionId}/0210`
        );

        const data = await res.json();

        // 🔥 Extract show details
        const rawTime =
          data?.data?.sessionDetails?.Session_dtmRealShow;

        const movieName =
          data?.data?.movieDetails?.Film_strTitle || "Movie";

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

        // 🔥 CURRENT IST TIME
        const nowIST = new Date(
          new Date().toLocaleString("en-US", {
            timeZone: "Asia/Kolkata"
          })
        );

        // 🔥 STOP TRACKING IF SHOW STARTED
        if (rawTime && new Date(rawTime) <= nowIST) {
          console.log("🛑 Show started, removing:", sessionId);

          for (let t of users) {
            const key = `${t.sessionId}_${t.token}`;
            trackers.delete(key);
          }

          continue;
        }

        // 🔥 Seat extraction (UNCHANGED LOGIC)
        const areas =
          data?.data?.seatLayout?.result?.seats?.area;

        if (!areas) continue;

        let result = [];

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
                  seats
                });
              }
            }
          }
        }

        // 🔥 Send notification if seats found
        if (result.length > 0) {
          const seatSummary = result
            .map(r => `${r.row}(${r.seats.length}): ${r.seats.join(",")}`)
            .join(" | ");

          // 🔥 Send to all users tracking this session
          for (let t of users) {
            try {
              await admin.messaging().send({
                collapseKey: `${sessionId}`,
                android: {
                  priority: "high",
                  ttl: 1800000, // 30 mins (in milliseconds)
                  notification: {
                    title: `🎬 ${movieName}`,
                    body: `${dateStr} ${timing} | ${seatSummary}`,
                    icon: "icon.png",
                    color: "#f45342",            // Brand color
                    tag: `${sessionId}`,
                    channelId: "seat-alerts-v1",
                    sound: "default",
                    notificationPriority: "priority_high", // Equivalent to "Heads-up" notification
                    defaultSound: true,
                    defaultVibrateTimings: true,
                    sticky: false,           // Set to true if you don't want them to swipe it away
                    localOnly: false,        // If true, won't mirror to watches/wearables
                  }
                },
                data: {
                  sessionId: String(sessionId),
                  type: "SEAT_UPDATE",
                },
                token: t.token
              });

              console.log("✅ Notified:", movieName, dateStr, timing, sessionId);

            } catch (err) {
              console.error("❌ Firebase error:", err.message);

              // 🔥 REMOVE INVALID TOKEN (IMPORTANT)
              if (
                err.code === "messaging/registration-token-not-registered" ||
                err.message.includes("Device unregistered")
              ) {
                const key = `${t.sessionId}_${t.token}`;
                trackers.delete(key);

                console.log("🧹 Removed invalid token:", key);
              }
            }
          }
        }

      } catch (err) {
        console.error("Session error:", err.message);
      }
    }

  } catch (err) {
    console.error("Cron error:", err.message);
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