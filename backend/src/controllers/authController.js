const bcrypt = require("bcryptjs");
const User = require("../models/userModel");
const { generateToken } = require("../utils/jwt");

function hashPassword(password) {
  return bcrypt.hash(password || "default_wallet_password", 10);
}

function generateDefaultPassword(walletAddress) {
  return "default_wallet_auth_2024";
}

function isDefaultPassword(password, walletAddress) {
  return password.startsWith(`wallet_${walletAddress.slice(0, 8)}_auth_`);
}

// signup
exports.signup = async (req, res) => {
  try {
    const { walletAddress } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({ error: "walletAddress is required" });
    }

const existingUser = await User.findOne({ walletAddress });
    if (existingUser) {
      return res.json({ success: true, message: "User already exists", userId: existingUser._id });
    }

    const user = await User.create({
      walletAddress,
      auraPoints: 1,
      auraPenalty: 0,
      isBlacklisted: false,
    });

    res.json({
      success: true,
      message: "User created",
      userId: user._id,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// login
exports.login = async (req, res) => {
  try {
    const { walletAddress } = req.body;

    if (!walletAddress) {
      return res.status(400).json({ error: "walletAddress is required" });
    }

    let user = await User.findOne({ walletAddress });

    if (!user) {
      const hashedPassword = await bcrypt.hash("default_wallet_auth_2024", 10);
      user = await User.create({
        password: hashedPassword,
        walletAddress,
      });
    }

    const token = generateToken(user);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        walletAddress: user.walletAddress,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
