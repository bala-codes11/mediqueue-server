const mongoose = require("mongoose");

const billingSchema = new mongoose.Schema(
  {
    consultationFee: {
      type: Number,
      default: 0,
      min: 0
    },

    additionalCharges: {
      type: Number,
      default: 0,
      min: 0
    },

    totalAmount: {
      type: Number,
      default: 0,
      min: 0
    },

    paymentStatus: {
      type: String,
      enum: ["UNPAID", "PAID"],
      default: "UNPAID"
    }
  },
  { _id: false }
);

const appointmentSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true
    },

    date: {
      type: String,
      required: true
    },

    time: {
      type: String,
      required: true
    },

    tokenNumber: {
      type: Number,
      required: true,
      min: 1
    },

    status: {
      type: String,
      enum: [
        "WAITING",
        "CALLED",
        "IN_PROGRESS",
        "COMPLETED"
      ],
      default: "WAITING"
    },

    prescription: {
      type: String,
      default: "",
      trim: true
    },

    billing: {
      type: billingSchema,
      default: () => ({})
    }
  },
  { timestamps: true }
);

appointmentSchema.index({
  doctorId: 1,
  date: 1,
  tokenNumber: 1
});

appointmentSchema.index({
  patientId: 1
});

module.exports =
  mongoose.models.Appointment ||
  mongoose.model(
    "Appointment",
    appointmentSchema
  );