require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");

const connectDB = require("./config/db");

const app = express();

/* ======================================================
   DATABASE
====================================================== */

const startServer = async () => {
  try {
    await connectDB();
    console.log("✅ Database Connected");
  } catch (error) {
    console.error(
      "❌ Database Connection Failed:",
      error.message
    );

    process.exit(1);
  }
};

startServer();

/* ======================================================
   SECURITY
====================================================== */

app.use(helmet());

app.set("trust proxy", 1);

app.use(
  express.json({
    limit: "50kb"
  })
);

/* ======================================================
   RATE LIMITER
====================================================== */

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,

  message: {
    message: "Too many requests, please try again later."
  }
});

app.use(limiter);

/* ======================================================
   CORS
====================================================== */

const allowedOrigins = [
  "http://localhost:3000",
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow Postman/mobile apps/server-side requests
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.error("❌ Blocked by CORS:", origin);

      return callback(
        new Error("CORS not allowed")
      );
    },

    credentials: true
  })
);

/* ======================================================
   GOOGLE OAUTH CALLBACK
====================================================== */

app.get(
  "/oauth2callback",
  async (req, res) => {
    const code = req.query.code;

    if (!code) {
      console.error(
        "❌ Authorization code missing"
      );

      return res
        .status(400)
        .send("Authorization code missing");
    }

    try {
      const {
        google
      } = require("googleapis");

      /* -----------------------------------------------
         Load Google OAuth credentials
      ------------------------------------------------ */

      const credentialsPath = path.join(
        __dirname,
        "google-credentials.json"
      );

      if (!fs.existsSync(credentialsPath)) {
        console.error(
          "❌ google-credentials.json not found"
        );

        return res
          .status(500)
          .send(
            "Google credentials file not found"
          );
      }

      const credentials = JSON.parse(
        fs.readFileSync(
          credentialsPath,
          "utf8"
        )
      );

      const config = credentials.web;

      /* -----------------------------------------------
         OAuth Client
      ------------------------------------------------ */

      const oauth2Client =
        new google.auth.OAuth2(
          config.client_id,
          config.client_secret,
          "http://localhost:5000/oauth2callback"
        );

      /* -----------------------------------------------
         Exchange authorization code
         for access + refresh token
      ------------------------------------------------ */

      const {
        tokens
      } = await oauth2Client.getToken(code);

      console.log(
        "\n========================================"
      );

      console.log(
        "✅ GOOGLE OAUTH SUCCESSFUL"
      );

      console.log(
        "========================================"
      );

      console.log(
        "Refresh token received:",
        !!tokens.refresh_token
      );

      console.log(
        "Access token received:",
        !!tokens.access_token
      );

      /* -----------------------------------------------
         Display refresh token in terminal
      ------------------------------------------------ */

      if (tokens.refresh_token) {
        console.log(
          "\n🔑 REFRESH TOKEN:"
        );

        console.log(
          tokens.refresh_token
        );
      } else {
        console.log(
          "\n⚠️ No refresh token received."
        );

        console.log(
          "Try authorization again with prompt=consent."
        );
      }

      console.log(
        "\n========================================\n"
      );

      /* -----------------------------------------------
         Browser response
      ------------------------------------------------ */

      res.send(`
        <!DOCTYPE html>

        <html>

          <head>

            <title>
              ClinicFlow Gmail Authorization
            </title>

          </head>

          <body
            style="
              font-family: Arial, sans-serif;
              padding: 40px;
              background: #f5f7fb;
            "
          >

            <div
              style="
                max-width: 600px;
                margin: auto;
                background: white;
                padding: 30px;
                border-radius: 12px;
              "
            >

              <h2>
                ✅ Gmail Authorization Successful
              </h2>

              <p>
                Your Gmail account has been
                successfully connected to ClinicFlow.
              </p>

              <p>
                Check your backend terminal
                for the refresh token.
              </p>

              <p>
                You can safely close this window.
              </p>

            </div>

          </body>

        </html>
      `);

    } catch (error) {
      console.error(
        "\n❌ OAuth authorization failed:"
      );

      console.error(
        error.response?.data ||
        error.message
      );

      res
        .status(500)
        .send(`
          <h2>
            ❌ OAuth Authorization Failed
          </h2>

          <p>
            Check your backend terminal
            for the exact error.
          </p>
        `);
    }
  }
);

/* ======================================================
   API ROUTES
====================================================== */

app.use(
  "/api/auth",
  require("./routes/authRoutes")
);

app.use(
  "/api/doctors",
  require("./routes/doctorRoutes")
);

app.use(
  "/api/appointments",
  require("./routes/appointmentRoutes")
);

app.use(
  "/api/queue",
  require("./routes/queueRoutes")
);

app.use(
  "/api/admin",
  require("./routes/adminRoutes")
);

app.use(
  "/api/public",
  require("./routes/publicRoutes")
);

/* ======================================================
   HEALTH CHECK
====================================================== */

app.get(
  "/health",
  (req, res) => {
    res.status(200).json({
      success: true,
      status: "OK",
      uptime: process.uptime()
    });
  }
);

/* ======================================================
   SOCKET SERVER
====================================================== */

const server = http.createServer(app);

const io = new Server(
  server,
  {
    cors: {
      origin: allowedOrigins,
      methods: [
        "GET",
        "POST"
      ],
      credentials: true
    }
  }
);

global.io = io;

/* ======================================================
   SOCKET EVENTS
====================================================== */

io.on(
  "connection",
  (socket) => {

    console.log(
      "🟢 Socket connected:",
      socket.id
    );

    /* -----------------------------------------------
       Doctor Queue Room
    ------------------------------------------------ */

    socket.on(
      "joinDoctorRoom",
      (doctorId) => {

        if (!doctorId) {
          return;
        }

        socket.join(
          doctorId
        );

        console.log(
          `📌 Joined room: ${doctorId}`
        );
      }
    );

    /* -----------------------------------------------
       Disconnect
    ------------------------------------------------ */

    socket.on(
      "disconnect",
      () => {

        console.log(
          "🔴 Socket disconnected:",
          socket.id
        );

      }
    );

  }
);

/* ======================================================
   404 HANDLER
====================================================== */

app.use(
  (req, res) => {

    res
      .status(404)
      .json({
        message: "Route not found"
      });

  }
);

/* ======================================================
   GLOBAL ERROR HANDLER
====================================================== */

app.use(
  (
    err,
    req,
    res,
    next
  ) => {

    console.error(
      "❌ Global Error:",
      err.message
    );

    res
      .status(500)
      .json({
        success: false,

        message:
          process.env.NODE_ENV ===
          "production"
            ? "Internal Server Error"
            : err.message
      });

  }
);

/* ======================================================
   START SERVER
====================================================== */

const PORT =
  process.env.PORT || 5000;

server.listen(
  PORT,
  () => {

    console.log(
      `🚀 Server running on port ${PORT}`
    );

  }
);