const express = require("express");
const mongoose = require("mongoose");

const auth = require("../middleware/authMiddleware");
const role = require("../middleware/roleMiddleware");

const Appointment = require("../models/appointment");
const Doctor = require("../models/doctor");

const router = express.Router();

/* ======================================================
   HELPER
====================================================== */

const verifyDoctorAccess = (
  requestDoctorId,
  tokenDoctorId
) => {
  return requestDoctorId === tokenDoctorId;
};

/* ======================================================
   PATIENT: BOOK APPOINTMENT
====================================================== */

router.post(
  "/book",
  auth,
  role("PATIENT"),
  async (req, res) => {

    try {

      const { doctorId, date, time } = req.body;

      if (!doctorId || !date || !time) {
        return res.status(400).json({
          message: "All fields required"
        });
      }

      const doctor = await Doctor.findOne({
        doctorId,
        isActive: true
      });

      if (!doctor) {
        return res.status(404).json({
          message: "Doctor not found"
        });
      }

      const day = doctor.availableSlots.find(
        d => d.date === date
      );

      if (!day) {
        return res.status(400).json({
          message: "Date not available"
        });
      }

      /* Prevent duplicate booking */

      const existing = await Appointment.findOne({
        doctorId: doctor._id,
        patientId: req.user.id,
        date
      });

      if (existing) {
        return res.status(400).json({
          message: "You already booked today"
        });
      }

      const normalizedTime = time.trim();

      const slot = day.slots.find(
        s =>
          s.startTime &&
          s.startTime === normalizedTime
      );

      if (!slot) {
        return res.status(400).json({
          message: "Slot not found"
        });
      }

      /* SLOT FULL CHECK */

      if (slot.bookedCount >= slot.maxPatients) {
        return res.status(400).json({
          message: "Slot full"
        });
      }

      /* increase booked count */

      slot.bookedCount += 1;

      await doctor.save();

      /* generate token */

      const nextToken =
        (
          await Appointment.countDocuments({
            doctorId: doctor._id,
            date
          })
        ) + 1;

      const appointment =
        await Appointment.create({
          patientId: req.user.id,
          doctorId: doctor._id,
          date,
          time: normalizedTime,
          tokenNumber: nextToken,
          status: "WAITING"
        });

      /* realtime update */

      global.io
        .to(doctorId)
        .emit("queueUpdated");

      res.status(201).json({
        message:
          "Appointment booked successfully",
        tokenNumber: nextToken,
        appointment
      });

    } catch (error) {

      console.error("Booking error:", error);

      res.status(500).json({
        message: "Internal Server Error"
      });

    }

  }
);


/* ======================================================
   DOCTOR: GET TODAY APPOINTMENTS
====================================================== */

router.get(
  "/today/:doctorId",
  auth,
  role("DOCTOR"),
  async (req, res) => {

    try {

      if (
        !verifyDoctorAccess(
          req.params.doctorId,
          req.user.doctorId
        )
      ) {
        return res.status(403).json({
          message: "Access denied"
        });
      }

      const doctor = await Doctor.findOne({
        doctorId: req.params.doctorId
      });

      if (!doctor) {
        return res.status(404).json({
          message: "Doctor not found"
        });
      }

      const today =
        new Date().toISOString().split("T")[0];

      const appointments =
        await Appointment.find({
          doctorId: doctor._id,
          date: today
        })
          .populate("patientId", "name email")
          .sort({ tokenNumber: 1 });

      res.json({
        success: true,
        data: appointments
      });

    } catch (error) {

      console.error("Fetch error:", error);

      res.status(500).json({
        message: "Internal Server Error"
      });

    }

  }
);


/* ======================================================
   DOCTOR: CALL NEXT PATIENT
====================================================== */

router.put(
  "/call-next/:doctorId",
  auth,
  role("DOCTOR"),
  async (req, res) => {

    try {

      if (
        !verifyDoctorAccess(
          req.params.doctorId,
          req.user.doctorId
        )
      ) {
        return res.status(403).json({
          message: "Access denied"
        });
      }

      const doctor = await Doctor.findOne({
        doctorId: req.params.doctorId
      });

      if (!doctor) {
        return res.status(404).json({
          message: "Doctor not found"
        });
      }

      const today =
        new Date().toISOString().split("T")[0];

      const activePatient =
        await Appointment.findOne({
          doctorId: doctor._id,
          date: today,
          status: {
            $in: ["CALLED", "IN_PROGRESS"]
          }
        });

      if (activePatient) {
        return res.status(400).json({
          message:
            "Finish current patient first"
        });
      }

      const nextPatient =
        await Appointment.findOne({
          doctorId: doctor._id,
          date: today,
          status: "WAITING"
        }).sort({ tokenNumber: 1 });

      if (!nextPatient) {
        return res.status(400).json({
          message: "No waiting patients"
        });
      }

      nextPatient.status = "CALLED";

      await nextPatient.save();

      global.io
        .to(req.params.doctorId)
        .emit("queueUpdated");

      res.json({
        message:
          "Patient called successfully",
        data: nextPatient
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        message: "Internal Server Error"
      });

    }

  }
);


/* ======================================================
   DOCTOR: START CONSULTATION
====================================================== */

/* ======================================================
   DOCTOR: START CONSULTATION
   Consultation can start only at/after scheduled time
====================================================== */

router.put(
  "/start/:appointmentId",
  auth,
  role("DOCTOR"),
  async (req, res) => {

    try {

      /* ================= VALIDATE ID ================= */

      if (
        !mongoose.Types.ObjectId.isValid(
          req.params.appointmentId
        )
      ) {
        return res.status(400).json({
          message: "Invalid appointment ID"
        });
      }

      /* ================= FIND APPOINTMENT ================= */

      const appointment =
        await Appointment.findById(
          req.params.appointmentId
        );

      if (!appointment) {
        return res.status(404).json({
          message: "Appointment not found"
        });
      }

      /* ================= FIND DOCTOR ================= */

      const doctor = await Doctor.findOne({
        doctorId: req.user.doctorId
      });

      if (!doctor) {
        return res.status(404).json({
          message: "Doctor not found"
        });
      }

      /* ================= DOCTOR ACCESS ================= */

      if (
        appointment.doctorId.toString() !==
        doctor._id.toString()
      ) {
        return res.status(403).json({
          message: "Access denied"
        });
      }

      /* ================= STATUS CHECK ================= */

      if (appointment.status !== "CALLED") {
        return res.status(400).json({
          message:
            "Patient must be called first"
        });
      }

      /* ================= DATE CHECK ================= */

      const today =
        new Date().toISOString().split("T")[0];

      if (appointment.date !== today) {
        return res.status(400).json({
          message:
            "This appointment is not scheduled for today"
        });
      }

      /* ================= TIME CHECK ================= */

      /*
        appointment.time comes from the booked slot.
        Example:
        appointment.date = "2026-08-17"
        appointment.time = "10:30"
      */

      const appointmentDateTime =
        new Date(
          `${appointment.date}T${appointment.time}:00`
        );

      if (
        isNaN(
          appointmentDateTime.getTime()
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid appointment date or time"
        });
      }

      const now = new Date();

      /* ================= PREVENT EARLY START ================= */

      if (now < appointmentDateTime) {

        const timeRemaining =
          appointmentDateTime.getTime() -
          now.getTime();

        const minutesRemaining =
          Math.ceil(
            timeRemaining / (1000 * 60)
          );

        return res.status(400).json({
          message:
            `Consultation cannot start yet. Appointment starts in ${minutesRemaining} minute${minutesRemaining !== 1 ? "s" : ""}.`
        });

      }

      /* ================= START CONSULTATION ================= */

      appointment.status =
        "IN_PROGRESS";

      await appointment.save();

      /* ================= REALTIME UPDATE ================= */

      global.io
        .to(req.user.doctorId)
        .emit("queueUpdated");

      /* ================= RESPONSE ================= */

      res.json({
        message:
          "Consultation started"
      });

    } catch (error) {

      console.error(
        "Start consultation error:",
        error
      );

      res.status(500).json({
        message:
          "Internal Server Error"
      });

    }

  }
);

/* ======================================================
   DOCTOR: COMPLETE CONSULTATION
====================================================== */

router.put(
  "/complete/:appointmentId",
  auth,
  role("DOCTOR"),
  async (req, res) => {

    try {

      if (
        !mongoose.Types.ObjectId.isValid(
          req.params.appointmentId
        )
      ) {
        return res.status(400).json({
          message: "Invalid appointment ID"
        });
      }

      const prescription =
        req.body.prescription || "";

      const additionalCharges =
        Number(req.body.additionalCharges) || 0;

      if (additionalCharges < 0) {
        return res.status(400).json({
          message: "Invalid charges"
        });
      }

      const appointment =
        await Appointment.findById(
          req.params.appointmentId
        );

      if (!appointment) {
        return res.status(404).json({
          message: "Appointment not found"
        });
      }

      const doctor = await Doctor.findOne({
        doctorId: req.user.doctorId
      });

      if (
        appointment.doctorId.toString() !==
        doctor._id.toString()
      ) {
        return res.status(403).json({
          message: "Access denied"
        });
      }

      if (
        appointment.status !== "IN_PROGRESS"
      ) {
        return res.status(400).json({
          message:
            "Consultation not started"
        });
      }

      const consultationFee =
        doctor.consultationFee;

      const totalAmount =
        consultationFee + additionalCharges;

      appointment.status = "COMPLETED";

      appointment.prescription =
        prescription;

      appointment.billing = {
        consultationFee,
        additionalCharges,
        totalAmount,
        paymentStatus: "UNPAID"
      };

      await appointment.save();

      global.io
        .to(req.user.doctorId)
        .emit("queueUpdated");

      res.json({
        message:
          "Consultation completed successfully",
        totalAmount
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        message: "Internal Server Error"
      });

    }

  }
);


/* ======================================================
   MARK BILL AS PAID
====================================================== */

router.put(
  "/pay/:appointmentId",
  auth,
  role("DOCTOR", "ADMIN"),
  async (req, res) => {

    try {

      if (
        !mongoose.Types.ObjectId.isValid(
          req.params.appointmentId
        )
      ) {
        return res.status(400).json({
          message: "Invalid appointment ID"
        });
      }

      const appointment =
        await Appointment.findById(
          req.params.appointmentId
        );

      if (!appointment) {
        return res.status(404).json({
          message: "Appointment not found"
        });
      }

      if (
        appointment.billing.paymentStatus ===
        "PAID"
      ) {
        return res.status(400).json({
          message: "Bill already paid"
        });
      }

      appointment.billing.paymentStatus =
        "PAID";

      await appointment.save();

      res.json({
        message: "Payment marked as PAID"
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        message: "Internal Server Error"
      });

    }

  }
);


/* ======================================================
   DOCTOR: REVENUE SUMMARY
====================================================== */

router.get(
  "/revenue/:doctorId",
  auth,
  role("DOCTOR"),
  async (req, res) => {

    try {

      if (
        !verifyDoctorAccess(
          req.params.doctorId,
          req.user.doctorId
        )
      ) {
        return res.status(403).json({
          message: "Access denied"
        });
      }

      const doctor = await Doctor.findOne({
        doctorId: req.params.doctorId
      });

      if (!doctor) {
        return res.status(404).json({
          message: "Doctor not found"
        });
      }

      const today =
        new Date().toISOString().split("T")[0];

      const appointments =
        await Appointment.find({
          doctorId: doctor._id,
          date: today,
          status: "COMPLETED"
        });

      const totalRevenue =
        appointments.reduce(
          (sum, a) =>
            sum +
            (a.billing?.totalAmount || 0),
          0
        );

      const paidRevenue =
        appointments
          .filter(
            a =>
              a.billing?.paymentStatus ===
              "PAID"
          )
          .reduce(
            (sum, a) =>
              sum +
              (a.billing?.totalAmount || 0),
            0
          );

      res.json({
        totalRevenue,
        paidRevenue,
        totalPatients:
          appointments.length
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