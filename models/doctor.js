const mongoose = require("mongoose");

const slotSchema = new mongoose.Schema(
  {
    startTime: {
      type: String,
      required: true
    },

    endTime: {
      type: String,
      required: true
    },

    duration: {
      type: Number,
      default: 30,
      min: 1
    },

    maxPatients: {
      type: Number,
      default: 3,
      min: 1
    },

    bookedCount: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  { _id: false }
);

const availabilitySchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: true
    },

    slots: [slotSchema]
  },
  { _id: false }
);

const doctorSchema = new mongoose.Schema(
  {
    doctorId: {
      type: String,
      unique: true,
      required: true,
      trim: true
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    department: {
      type: String,
      required: true,
      trim: true
    },

    specialization: {
      type: String,
      required: true,
      trim: true
    },

    experience: {
      type: Number,
      required: true,
      min: 0,
      max: 60
    },

    consultationMode: {
      type: String,
      enum: [
        "OPD",
        "Online",
        "Emergency"
      ],
      default: "OPD"
    },

    consultationFee: {
      type: Number,
      required: true,
      min: 0
    },

    availableSlots: [
      availabilitySchema
    ],

    password: {
      type: String,
      select: false
    },

    mustChangePassword: {
      type: Boolean,
      default: true
    },

    inviteToken: {
      type: String,
      select: false
    },

    inviteTokenExpires: {
      type: Date,
      select: false
    },

    isActive: {
      type: Boolean,
      default: true
    },

    isConsulting: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

doctorSchema.index({
  doctorId: 1
});

doctorSchema.index({
  specialization: 1
});

doctorSchema.index({
  email: 1
});

module.exports =
  mongoose.models.Doctor ||
  mongoose.model(
    "Doctor",
    doctorSchema
  );