const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/authMiddleware");
const loanController = require("../controllers/loanController");

router.post("/quote", verifyToken, loanController.quoteCollateral);
router.post("/request", verifyToken, loanController.requestCollateralLoan);
router.post("/repay", verifyToken, loanController.repayLoan);
router.post("/liquidate", loanController.liquidateDefault);
router.get("/status", verifyToken, loanController.getLoanStatus);
router.get("/status/:walletAddress", loanController.getLoanStatusByAddress);
router.get("/info", loanController.getLoanInfo);

module.exports = router;