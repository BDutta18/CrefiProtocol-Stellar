const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    password: {
      type: String,
    },
    walletAddress: {
      type: String,
      required: true,
      unique: true,
    },
    auraPoints: {
      type: Number,
      default: 0,
    },
    auraPenalty: {
      type: Number,
      default: 0,
    },
    isBlacklisted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
