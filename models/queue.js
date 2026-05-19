const mongoose = require("mongoose");

const queueSchema = new mongoose.Schema(
  {
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
      unique: true
    },

    currentToken: {
      type: Number,
      default: 0,
      min: 0
    },

    currentAppointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      default: null
    }
  },
  { timestamps: true }
);

/* indexes */

queueSchema.index({
  doctorId: 1
});

module.exports =
  mongoose.models.Queue ||
  mongoose.model(
    "Queue",
    queueSchema
  );