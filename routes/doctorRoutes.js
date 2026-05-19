const express = require("express");

const Doctor = require("../models/doctor");

const auth = require("../middleware/authMiddleware");
const role = require("../middleware/roleMiddleware");

const router = express.Router();

/* ======================================================
   HELPERS
====================================================== */

const timeRegex =
  /^([01]\d|2[0-3]):([0-5]\d)$/;

/* ======================================================
   ADD SLOTS
====================================================== */

router.post(
  "/add-slots",
  auth,
  role("ADMIN", "DOCTOR"),
  async (req, res) => {

    try {

      const {
        doctorId,
        date,
        startTime,
        endTime
      } = req.body;

      const duration =
        Number(req.body.duration);

      /* ================= VALIDATION ================= */

      if (
        !doctorId ||
        !date ||
        !startTime ||
        !endTime ||
        !duration
      ) {
        return res.status(400).json({
          message: "All fields required"
        });
      }

      /* validate duration */

      if (
        isNaN(duration) ||
        duration <= 0
      ) {
        return res.status(400).json({
          message: "Invalid duration"
        });
      }

      /* validate time format */

      if (
        !timeRegex.test(startTime) ||
        !timeRegex.test(endTime)
      ) {
        return res.status(400).json({
          message: "Invalid time format"
        });
      }

      /* ================= FIND DOCTOR ================= */

      const doctor = await Doctor.findOne({
        doctorId,
        isActive: true
      });

      if (!doctor) {
        return res.status(404).json({
          message: "Doctor not found"
        });
      }

      /* ================= ACCESS CONTROL ================= */

      if (
        req.user.role === "DOCTOR" &&
        req.user.doctorId !== doctorId
      ) {
        return res.status(403).json({
          message: "Access denied"
        });
      }

      /* ================= DATE VALIDATION ================= */

      const start = new Date(
        `${date}T${startTime}:00`
      );

      const end = new Date(
        `${date}T${endTime}:00`
      );

      if (
        isNaN(start.getTime()) ||
        isNaN(end.getTime())
      ) {
        return res.status(400).json({
          message: "Invalid date or time"
        });
      }

      if (start >= end) {
        return res.status(400).json({
          message:
            "End time must be after start time"
        });
      }

      /* ================= SLOT CREATION ================= */

      const slots = [];

      let current = new Date(start);

      while (current < end) {

        const slotStart =
          new Date(current);

        const slotEnd =
          new Date(current);

        slotEnd.setMinutes(
          slotEnd.getMinutes() + duration
        );

        /* prevent overflow */

        if (slotEnd > end) break;

        const startH =
          slotStart
            .getHours()
            .toString()
            .padStart(2, "0");

        const startM =
          slotStart
            .getMinutes()
            .toString()
            .padStart(2, "0");

        const endH =
          slotEnd
            .getHours()
            .toString()
            .padStart(2, "0");

        const endM =
          slotEnd
            .getMinutes()
            .toString()
            .padStart(2, "0");

        const formattedStart =
          `${startH}:${startM}`;

        const formattedEnd =
          `${endH}:${endM}`;

        slots.push({
          startTime: formattedStart,
          endTime: formattedEnd,
          maxPatients: 1,
          bookedCount: 0
        });

        current.setMinutes(
          current.getMinutes() + duration
        );

      }

      /* ================= HANDLE DATE ================= */

      let day =
        doctor.availableSlots.find(
          d => d.date === date
        );

      if (!day) {

        day = {
          date,
          slots: []
        };

        doctor.availableSlots.push(day);

      }

      /* ================= DUPLICATE PREVENTION ================= */

      for (const slot of slots) {

        const alreadyExists =
          day.slots.some(
            s =>
              s.startTime ===
              slot.startTime
          );

        if (!alreadyExists) {
          day.slots.push(slot);
        }

      }

      /* ================= SORT SLOTS ================= */

      day.slots.sort((a, b) =>
        a.startTime.localeCompare(
          b.startTime
        )
      );

      await doctor.save();

      res.json({
        message:
          "Slots created successfully",
        totalSlots: slots.length,
        slots: day.slots
      });

    } catch (error) {

      console.error(
        "Add slots error:",
        error
      );

      res.status(500).json({
        message: "Server Error"
      });

    }

  }
);


/* ======================================================
   GET AVAILABLE SLOTS
====================================================== */

router.get(
  "/:doctorId/slots",
  async (req, res) => {

    try {

      const doctor =
        await Doctor.findOne({
          doctorId: req.params.doctorId,
          isActive: true
        }).select("availableSlots");

      if (!doctor) {
        return res.status(404).json({
          message: "Doctor not found"
        });
      }

      const now = new Date();

      const filtered =
        doctor.availableSlots
          .map(day => {

            const slots =
              day.slots.filter(slot => {

                const slotTime =
                  new Date(
                    `${day.date}T${slot.startTime}:00`
                  );

                const notExpired =
                  slotTime > now;

                const notFull =
                  slot.bookedCount <
                  slot.maxPatients;

                return (
                  notExpired &&
                  notFull
                );

              });

            return {
              date: day.date,
              slots
            };

          })
          .filter(
            day => day.slots.length > 0
          );

      res.json(filtered);

    } catch (error) {

      console.error(
        "Get slots error:",
        error
      );

      res.status(500).json({
        message: "Server Error"
      });

    }

  }
);


/* ======================================================
   GET DOCTORS
====================================================== */

router.get("/", async (req, res) => {

  try {

    const { specialization } =
      req.query;

    let filter = {
      isActive: true
    };

    if (specialization) {
      filter.specialization =
        specialization;
    }

    const doctors =
      await Doctor.find(filter)
        .select(
          "-password -inviteToken -inviteTokenExpires -__v"
        )
        .sort({ createdAt: -1 });

    res.json(doctors);

  } catch (error) {

    console.error(
      "Fetch doctors error:",
      error
    );

    res.status(500).json({
      message:
        "Internal Server Error"
    });

  }

});

module.exports = router;