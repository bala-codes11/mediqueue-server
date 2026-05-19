const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const Doctor = require("../models/doctor");
const Admin = require("../models/admin");
const Queue = require("../models/queue");

const auth = require("../middleware/authMiddleware");
const role = require("../middleware/roleMiddleware");

const sendInviteEmail = require("../utils/sendInviteEmail");

const router = express.Router();

/* ================= ADMIN LOGIN ================= */
router.post("/login", async (req, res) => {
  try {

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password required"
      });
    }

    const admin = await Admin.findOne({
  email: email.toLowerCase(),
  isActive: true
}).select("+password");

    /* SAME ERROR MESSAGE */
    if (!admin) {
      return res.status(400).json({
        message: "Invalid email or password"
      });
    }

    const isMatch = await bcrypt.compare(
      password,
      admin.password
    );

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid email or password"
      });
    }

    const token = jwt.sign(
      {
        id: admin._id,
        role: "ADMIN",
        email: admin.email
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({ token });

  } catch (error) {

    console.error("Admin login error:", error);

    res.status(500).json({
      message: "Server Error"
    });

  }
});


/* ================= CREATE DOCTOR ================= */
router.post(
  "/create-doctor",
  auth,
  role("ADMIN"),
  async (req, res) => {

    try {

      const {
        doctorId,
        name,
        email,
        department,
        specialization,
        experience,
        consultationMode,
        consultationFee
      } = req.body;

      /* ================= VALIDATION ================= */

      if (
        !doctorId ||
        !name ||
        !email ||
        !department ||
        !specialization ||
        !experience ||
        !consultationFee
      ) {
        return res.status(400).json({
          message: "All fields are required"
        });
      }

      /* doctorId validation */
      if (!/^[A-Z0-9_-]+$/i.test(doctorId)) {
        return res.status(400).json({
          message: "Invalid doctor ID format"
        });
      }

      /* email validation */
      const normalizedEmail = email.toLowerCase();

      const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailRegex.test(normalizedEmail)) {
        return res.status(400).json({
          message: "Invalid email format"
        });
      }

      /* experience validation */
      if (experience < 0 || experience > 60) {
        return res.status(400).json({
          message: "Invalid experience value"
        });
      }

      /* fee validation */
      if (consultationFee < 0) {
        return res.status(400).json({
          message: "Invalid consultation fee"
        });
      }

      /* ================= DUPLICATE CHECK ================= */

      const existingDoctor = await Doctor.findOne({
        doctorId
      });

      if (existingDoctor) {
        return res.status(400).json({
          message: "Doctor ID already exists"
        });
      }

      const existingEmail = await Doctor.findOne({
        email: normalizedEmail
      });

      if (existingEmail) {
        return res.status(400).json({
          message: "Email already registered"
        });
      }

      /* ================= INVITE TOKEN ================= */

      const inviteToken = crypto
        .randomBytes(32)
        .toString("hex");

      /* ================= CREATE DOCTOR ================= */

      const doctor = await Doctor.create({
        doctorId,
        name,
        email: normalizedEmail,
        department,
        specialization,
        experience,
        consultationMode,
        consultationFee,

        inviteToken,
        inviteTokenExpires:
          Date.now() + 24 * 60 * 60 * 1000
      });

      /* ================= CREATE QUEUE ================= */

      await Queue.create({
        doctorId: doctor._id,
        currentToken: 0
      });

      /* ================= SEND EMAIL ================= */

      try {

        await sendInviteEmail(
          normalizedEmail,
          inviteToken
        );

      } catch (emailError) {

        console.error(
          "Invite email failed:",
          emailError
        );

      }

      res.status(201).json({
        message:
          "Doctor created successfully"
      });

    } catch (error) {

      console.error(
        "Create doctor error:",
        error
      );

      res.status(500).json({
        message: "Server Error"
      });

    }

  }
);


/* ================= LIST DOCTORS ================= */
router.get(
  "/doctors",
  auth,
  role("ADMIN"),
  async (req, res) => {

    try {

      const doctors = await Doctor.find()
        .select(
          "-password -inviteToken -inviteTokenExpires -__v"
        );

      res.json(doctors);

    } catch (error) {

      console.error(error);

      res.status(500).json({
        message: "Server Error"
      });

    }

  }
);


/* ================= GET DOCTOR SLOTS ================= */
router.get(
  "/:doctorId/slots",
  auth,
  role("ADMIN", "DOCTOR"),
  async (req, res) => {

    try {

      /* Doctor can access only own slots */
      if (
        req.user.role === "DOCTOR" &&
        req.user.doctorId !== req.params.doctorId
      ) {
        return res.status(403).json({
          message: "Access denied"
        });
      }

      const doctor = await Doctor.findOne({
        doctorId: req.params.doctorId
      }).select("availableSlots");

      if (!doctor) {
        return res.status(404).json({
          message: "Doctor not found"
        });
      }

      res.json(doctor.availableSlots);

    } catch (error) {

      console.error(error);

      res.status(500).json({
        message: "Server Error"
      });

    }

  }
);


/* ================= ACTIVATE / DEACTIVATE ================= */
router.put(
  "/:doctorId/toggle",
  auth,
  role("ADMIN"),
  async (req, res) => {

    try {

      const doctor = await Doctor.findOne({
        doctorId: req.params.doctorId
      });

      if (!doctor) {
        return res.status(404).json({
          message: "Doctor not found"
        });
      }

      doctor.isActive = !doctor.isActive;

      await doctor.save();

      res.json({
        message: "Doctor status updated",
        isActive: doctor.isActive
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        message: "Server Error"
      });

    }

  }
);

module.exports = router;