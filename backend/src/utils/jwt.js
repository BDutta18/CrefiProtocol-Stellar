const jwt = require("jsonwebtoken");

const generateToken = (user) => {
  const expiresIn = process.env.JWT_EXPIRES || "7d";
  return jwt.sign(
    { id: user._id, walletAddress: user.walletAddress },
    process.env.JWT_SECRET,
    { expiresIn }
  );
};

module.exports = { generateToken };
