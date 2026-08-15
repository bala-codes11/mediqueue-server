const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema(
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

    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

  

module.exports =
  mongoose.models.Admin ||
  mongoose.model("Admin", adminSchema);