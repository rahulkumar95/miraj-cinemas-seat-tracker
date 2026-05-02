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
let trackers = new Map(); // key = sessionId_token

// 🔑 Firebase
const serviceAccount = require("/etc/secrets/serviceAccount.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// 🟢 Health
app.get("/health", (req, res) => {
  res.send("OK");
});

// 🔥 COMMON FUNCTION (single source of truth for IST)
async function getShowDetails(sessionId) {
  let movieName = "";
  let dateStr = "";
  let timing = "";
  let showTime = null;

  try {
    // const res = await fetch(
    //   `https://mirajcinemas.com/api/v1.0/webapp/seat_layout/${sessionId}/0210`
    // );

    //const data = await res.json();
    const data = require("./test-seat-layout.json");

    const rawTime =
      data?.data?.sessionDetails?.Session_dtmRealShow;

    movieName =
      data?.data?.movieDetails?.Film_strTitle || "Movie";

    if (rawTime) {
      // 🔥 FIX: FORCE IST
      const iso = rawTime.replace(" ", "T");
      const d = new Date(iso);

      showTime = d;

      timing = d.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      });

      dateStr = d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short"
      });
    }

  } catch (err) {
    console.log("⚠️ Failed fetching show details:", err.message);
  }

  return { movieName, dateStr, timing, showTime };
}


// ✅ TRACK
app.post("/track", async (req, res) => {
  const { token, sessionId, area } = req.body;

  if (!token || !sessionId) {
    return res.status(400).json({ message: "Missing data" });
  }

  const key = `${sessionId}_${token}`;

  // 🔥 DUPLICATE CHECK
  if (trackers.has(key)) {
    console.log("⚠️ Duplicate attempt:", key);

    return res.status(409).json({
      message: "⚠️ Already tracking this show"
    });
  }

  // 🔥 USE COMMON FUNCTION
  const { movieName, dateStr, timing } =
    await getShowDetails(sessionId);

  trackers.set(key, {
    token,
    sessionId,
    area,
    movieName,
    dateStr,
    timing
  });

  console.log("✅ Added tracking:", key);

  res.json({
    message: "✅ Tracking Started",
    movieName,
    dateStr,
    timing
  });
});

// ❌ UNTRACK
app.post("/untrack", (req, res) => {
  const { token, sessionId } = req.body;

  const key = `${sessionId}_${token}`;

  trackers.delete(key);

  console.log("❌ Removed Tracking:", key);

  res.json({ message: "✅ Tracking Removed" });
});

// 📋 SINGLE SOURCE API
app.post("/my-trackings", (req, res) => {
  const { token } = req.body;

  const list = [];

  for (let t of trackers.values()) {
    if (t.token === token) {
      list.push(t);
    }
  }

  res.json({ trackings: list });
});

// ⏱ Prevent overlap
let isRunning = false;

// ⏰ CRON (updates + notifications)
cron.schedule("*/1 * * * *", async () => {
  if (isRunning) return;
  isRunning = true;

  try {
    const sessionMap = {};

    // 🔥 Group by session
    for (let t of trackers.values()) {
      if (!sessionMap[t.sessionId]) {
        sessionMap[t.sessionId] = [];
      }
      sessionMap[t.sessionId].push(t);
    }

    for (let sessionId in sessionMap) {
      const users = sessionMap[sessionId];

      // 🔥 Get show data
      const { movieName, dateStr, timing, showTime } =
        await getShowDetails(sessionId);

      // 🔥 UPDATE TRACKER META
      for (let t of users) {
        t.movieName = movieName;
        t.dateStr = dateStr;
        t.timing = timing;
      }

      // 🔥 STOP AFTER SHOW START
      const nowIST = new Date(
        new Date().toLocaleString("en-US", {
          timeZone: "Asia/Kolkata"
        })
      );

      if (showTime && showTime <= nowIST) {
        console.log("🛑 Removing started show:", sessionId);

        for (let t of users) {
          const key = `${t.sessionId}_${t.token}`;
          trackers.delete(key);
        }

        continue;
      }

      // 🔥 SEAT LOGIC
      try {
        // const res = await fetch(
        //   `https://mirajcinemas.com/api/v1.0/webapp/seat_layout/${sessionId}/0210`
        // );

        //const data = await res.json();
        const data = require("./test-seat-layout.json");

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
                  seat.strSeatStatus === "0") {
                  seats.push(seat.strSeatNumber === "0" ? 1 : seat.strSeatNumber);
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
                notification: {
                  title: `🎬 ${movieName}`,
                  body: `${dateStr} ${timing} | ${seatSummary}`
                },
                android: {
                  collapseKey: `${sessionId}`,
                  priority: "high",
                  ttl: 1800000, // 30 mins (in milliseconds)
                  notification: {
                    title: `🎬 ${movieName}`,
                    body: `${dateStr} ${timing} | ${seatSummary}`,
                    icon: "icon.png",
                    color: "#f45342",            // Brand color
                    sound: "default",
                    tag: `${sessionId}`,
                    channelId: "seat-alerts-v1",
                    priority: "priority_high", // Equivalent to "Heads-up" notification
                    defaultSound: true,
                    defaultVibrateTimings: true,
                    sticky: false,           // Set to true if you don't want them to swipe it away
                    localOnly: false,        // If true, won't mirror to watches/wearables
                  }
                },
                data: {
                  sessionId: String(sessionId),
                  type: "SEAT_UPDATE",
                  tag: `${sessionId}`,
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