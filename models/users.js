const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
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

    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false
    },

    role: {
      type: String,
      enum: ["PATIENT"],
      default: "PATIENT"
    }
  },
  { timestamps: true }
);

userSchema.index({
  email: 1
});

module.exports =
  mongoose.models.User ||
  mongoose.model(
    "User",
    userSchema
  );