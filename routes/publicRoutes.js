const express = require("express");

const Doctor = require("../models/doctor");
const Appointment = require("../models/appointment");

const router = express.Router();

/* ======================================================
   PUBLIC DOCTORS
====================================================== */

router.get("/doctors", async (req, res) => {

  try {

    const { specialization } = req.query;

    let filter = {
      isActive: true
    };

    /* optional specialization filter */

    if (specialization) {
      filter.specialization = specialization;
    }

    const doctors =
      await Doctor.find(filter)
        .select(
          "doctorId name specialization department consultationMode consultationFee experience"
        )
        .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: doctors.length,
      data: doctors
    });

  } catch (error) {

    console.error(
      "Public doctors error:",
      error
    );

    res.status(500).json({
      message:
        "Internal Server Error"
    });

  }

});


/* ======================================================
   PUBLIC DOCTOR SLOTS
====================================================== */

router.get(
  "/doctors/:doctorId/slots",
  async (req, res) => {

    try {

      const doctor =
        await Doctor.findOne({
          doctorId:
            req.params.doctorId,
          isActive: true
        }).select("availableSlots");

      if (!doctor) {
        return res.status(404).json({
          message:
            "Doctor not found"
        });
      }

      const now = new Date();

      /* filter expired/full slots */

      const filteredSlots =
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
            day =>
              day.slots.length > 0
          );

      res.json({
        success: true,
        data: filteredSlots
      });

    } catch (error) {

      console.error(
        "Public slots error:",
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
   PUBLIC STATS
====================================================== */

router.get("/stats", async (req, res) => {

  try {

    const totalDoctors =
      await Doctor.countDocuments();

    const activeDoctors =
      await Doctor.countDocuments({
        isActive: true
      });

    /* today's appointments */

    const startOfDay =
      new Date();

    startOfDay.setHours(
      0,
      0,
      0,
      0
    );

    const endOfDay =
      new Date();

    endOfDay.setHours(
      23,
      59,
      59,
      999
    );

    const totalAppointments =
      await Appointment.countDocuments({
        createdAt: {
          $gte: startOfDay,
          $lte: endOfDay
        }
      });

    const completedAppointments =
      await Appointment.countDocuments({
        status: "COMPLETED",
        createdAt: {
          $gte: startOfDay,
          $lte: endOfDay
        }
      });

    const waitingAppointments =
      await Appointment.countDocuments({
        status: "WAITING",
        createdAt: {
          $gte: startOfDay,
          $lte: endOfDay
        }
      });

    res.json({
      success: true,
      data: {
        totalDoctors,
        activeDoctors,
        totalAppointments,
        completedAppointments,
        waitingAppointments
      }
    });

  } catch (error) {

    console.error(
      "Public stats error:",
      error
    );

    res.status(500).json({
      message:
        "Internal Server Error"
    });

  }

});

module.exports = router;