require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const http = require("http");
const { Server } = require("socket.io");

const connectDB = require("./config/db");

const app = express();

/* ======================================================
   DATABASE
====================================================== */

const startServer = async () => {

  try {

    await connectDB();

    console.log(
      "✅ Database Connected"
    );

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
    limit: "10kb"
  })
);

/* ======================================================
   RATE LIMITER
====================================================== */

const limiter = rateLimit({

  windowMs:
    15 * 60 * 1000,

  max: 100,

  standardHeaders: true,

  legacyHeaders: false,

  message: {
    message:
      "Too many requests, try again later."
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

    origin: (
      origin,
      callback
    ) => {

      /* allow postman/mobile apps */

      if (!origin) {
        return callback(
          null,
          true
        );
      }

      if (
        allowedOrigins.includes(origin)
      ) {

        callback(null, true);

      } else {

        console.error(
          "❌ Blocked by CORS:",
          origin
        );

        callback(
          new Error(
            "CORS not allowed"
          )
        );

      }

    },

    credentials: true

  })

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

app.get("/health", (req, res) => {

  res.status(200).json({
    success: true,
    status: "OK",
    uptime: process.uptime()
  });

});

/* ======================================================
   SOCKET SERVER
====================================================== */

const server =
  http.createServer(app);

const io = new Server(server, {

  cors: {

    origin: allowedOrigins,

    methods: [
      "GET",
      "POST"
    ],

    credentials: true

  }

});

global.io = io;

/* ======================================================
   SOCKET EVENTS
====================================================== */

io.on(
  "connection",
  socket => {

    console.log(
      "🟢 Socket connected:",
      socket.id
    );

    /* join doctor room */

    socket.on(
      "joinDoctorRoom",
      doctorId => {

        if (!doctorId) return;

        socket.join(doctorId);

        console.log(
          `📌 Joined room: ${doctorId}`
        );

      }
    );

    /* disconnect */

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

app.use((req, res) => {

  res.status(404).json({
    message: "Route not found"
  });

});

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

    res.status(500).json({

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

server.listen(PORT, () => {

  console.log(
    `🚀 Server running on port ${PORT}`
  );

});