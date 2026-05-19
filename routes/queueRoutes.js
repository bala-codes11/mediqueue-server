const express = require("express");

const auth =
  require("../middleware/authMiddleware");

const role =
  require("../middleware/roleMiddleware");

const Queue =
  require("../models/queue");

const Appointment =
  require("../models/appointment");

const Doctor =
  require("../models/doctor");

const router = express.Router();

/* ======================================================
   NEXT TOKEN
====================================================== */

router.put(
  "/next/:doctorId",
  auth,
  role("DOCTOR"),
  async (req, res) => {

    try {

      const { doctorId } =
        req.params;

      /* ================= VALIDATION ================= */

      if (!doctorId) {
        return res.status(400).json({
          message:
            "Doctor ID required"
        });
      }

      /* ================= ACCESS CONTROL ================= */

      if (
        req.user.doctorId !==
        doctorId
      ) {
        return res.status(403).json({
          message:
            "Access denied"
        });
      }

      /* ================= FIND DOCTOR ================= */

      const doctor =
        await Doctor.findOne({
          doctorId,
          isActive: true
        });

      if (!doctor) {
        return res.status(404).json({
          message:
            "Doctor not found"
        });
      }

      /* ================= TODAY ================= */

      const today =
        new Date()
          .toISOString()
          .split("T")[0];

      /* ================= CHECK ACTIVE PATIENT ================= */

      const activePatient =
        await Appointment.findOne({
          doctorId: doctor._id,
          date: today,
          status: {
            $in: [
              "CALLED",
              "IN_PROGRESS"
            ]
          }
        });

      if (activePatient) {
        return res.status(400).json({
          message:
            "Finish current patient first"
        });
      }

      /* ================= FIND NEXT WAITING PATIENT ================= */

      const nextPatient =
        await Appointment.findOne({
          doctorId: doctor._id,
          date: today,
          status: "WAITING"
        }).sort({
          tokenNumber: 1
        });

      if (!nextPatient) {
        return res.status(404).json({
          message:
            "No waiting patients"
        });
      }

      /* ================= UPDATE STATUS ================= */

      nextPatient.status =
        "CALLED";

      await nextPatient.save();

      /* ================= UPDATE QUEUE ================= */

      let queue =
        await Queue.findOne({
          doctorId: doctor._id
        });

      if (!queue) {

        queue =
          await Queue.create({
            doctorId: doctor._id,
            currentToken:
              nextPatient.tokenNumber,
            currentAppointment:
              nextPatient._id
          });

      } else {

        queue.currentToken =
          nextPatient.tokenNumber;

        queue.currentAppointment =
          nextPatient._id;

        await queue.save();

      }

      /* ================= REALTIME UPDATE ================= */

      global.io
        .to(doctorId)
        .emit(
          "queueUpdated",
          {
            currentToken:
              queue.currentToken
          }
        );

      res.json({
        success: true,
        message:
          "Next patient called",
        currentToken:
          queue.currentToken,
        patient: nextPatient
      });

    } catch (error) {

      console.error(
        "Queue next error:",
        error
      );

      res.status(500).json({
        message:
          "Internal Server Error"
      });

    }

  }
);

module.exports = router;