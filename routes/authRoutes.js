const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/users");
const Doctor = require("../models/doctor");

const router = express.Router();

/* ======================================================
   HELPERS
====================================================== */

const emailRegex =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ======================================================
   PATIENT SIGNUP
====================================================== */

router.post("/signup", async (req, res) => {

  try {

    const { name, email, password } = req.body;

    /* ================= VALIDATION ================= */

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "All fields required"
      });
    }

    const normalizedEmail =
      email.toLowerCase().trim();

    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        message: "Invalid email format"
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters"
      });
    }

    /* ================= CHECK EXISTING ================= */

    const existing = await User.findOne({
      email: normalizedEmail
    });

    if (existing) {
      return res.status(400).json({
        message: "Email already registered"
      });
    }

    /* ================= HASH PASSWORD ================= */

    const hashed =
      await bcrypt.hash(password, 10);

    /* ================= CREATE USER ================= */

    await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashed,
      role: "PATIENT"
    });

    res.status(201).json({
      message:
        "Account created successfully"
    });

  } catch (error) {

    console.error(
      "Signup error:",
      error
    );

    res.status(500).json({
      message: "Server Error"
    });

  }

});


/* ======================================================
   PATIENT LOGIN
====================================================== */

router.post("/login", async (req, res) => {

  try {

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message:
          "Email and password required"
      });
    }

    const normalizedEmail =
      email.toLowerCase().trim();

    const user = await User.findOne({
  email: normalizedEmail
}).select("+password");

    /* SAME ERROR MESSAGE */

    if (!user) {
      return res.status(400).json({
        message:
          "Invalid email or password"
      });
    }

    const isMatch =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!isMatch) {
      return res.status(400).json({
        message:
          "Invalid email or password"
      });
    }

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        email: user.email
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {

    console.error(
      "Login error:",
      error
    );

    res.status(500).json({
      message: "Server Error"
    });

  }

});


/* ======================================================
   DOCTOR SETUP PASSWORD
====================================================== */

router.post(
  "/setup-password/:token",
  async (req, res) => {

    try {

      const { password } = req.body;

      if (
        !password ||
        password.length < 8
      ) {
        return res.status(400).json({
          message:
            "Password must be at least 8 characters"
        });
      }

      const doctor =
        await Doctor.findOne({

          inviteToken: req.params.token,

          inviteTokenExpires: {
            $gt: Date.now()
          }

        });

      if (!doctor) {
        return res.status(400).json({
          message:
            "Invalid or expired invite link"
        });
      }

      /* Prevent resetting again */

      if (doctor.password) {
        return res.status(400).json({
          message:
            "Password already created"
        });
      }

      const hashed =
        await bcrypt.hash(password, 10);

      doctor.password = hashed;

      doctor.inviteToken = undefined;

      doctor.inviteTokenExpires =
        undefined;

      doctor.mustChangePassword =
        false;

      await doctor.save();

      res.json({
        message:
          "Password created successfully"
      });

    } catch (error) {

      console.error(
        "Setup password error:",
        error
      );

      res.status(500).json({
        message: "Server Error"
      });

    }

  }
);


/* ======================================================
   DOCTOR LOGIN
====================================================== */

router.post(
  "/doctor-login",
  async (req, res) => {

    try {

      const {
        doctorId,
        password
      } = req.body;

      if (!doctorId || !password) {
        return res.status(400).json({
          message:
            "Doctor ID and password required"
        });
      }

      const doctor = await Doctor.findOne({
  doctorId: doctorId.trim(),
  isActive: true
}).select("+password");

      /* SAME ERROR MESSAGE */

      if (!doctor) {
        return res.status(400).json({
          message:
            "Invalid doctor ID or password"
        });
      }

      /* account not activated */

      if (!doctor.password) {
        return res.status(400).json({
          message:
            "Account not activated. Please check your email."
        });
      }

      const isMatch =
        await bcrypt.compare(
          password,
          doctor.password
        );

      if (!isMatch) {
        return res.status(400).json({
          message:
            "Invalid doctor ID or password"
        });
      }

      const token = jwt.sign(
        {
          id: doctor._id,
          role: "DOCTOR",
          doctorId: doctor.doctorId,
          name: doctor.name,
          email: doctor.email
        },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
      );

      res.json({
        token,
        doctor: {
          id: doctor._id,
          doctorId: doctor.doctorId,
          name: doctor.name,
          email: doctor.email,
          specialization:
            doctor.specialization
        }
      });

    } catch (error) {

      console.error(
        "Doctor login error:",
        error
      );

      res.status(500).json({
        message: "Server Error"
      });

    }

  }
);

module.exports = router;