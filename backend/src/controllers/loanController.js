const User = require("../models/userModel");
const {
  getCollateralQuote,
  calculateDue,
  requestCollateralLoan,
  repayLoan,
  getUserLoan,
  isLoanOverdue,
  liquidate,
  getCreditScore,
  getNetPoints,
  getUnsecuredLimit,
  isEligibleForUnsecured,
  addEarnedPoints,
  getUserLoanStatus,
  getLoanManagerContractId,
  getCreditSystemContractId,
  getLendingPoolContractId,
  DAILY_INTEREST_BPS,
  COLLATERAL_RATIO,
  MIN_POINTS_FOR_UNSECURED,
  MICRO,
} = require("../services/loanService");

function safeStringify(obj) {
  return JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));
}

exports.quoteCollateral = async (req, res) => {
  try {
    const { xlmAmount, daysToRepay } = req.body;
    const walletAddress = req.user.walletAddress;

    if (!xlmAmount || !daysToRepay) {
      return res.status(400).json({
        success: false,
        error: "xlmAmount and daysToRepay are required",
      });
    }

    const quote = getCollateralQuote(Number(xlmAmount), Number(daysToRepay));

    res.json({
      success: true,
      quote: safeStringify(quote),
      config: {
        dailyInterestBps: DAILY_INTEREST_BPS,
        collateralRatio: COLLATERAL_RATIO,
        lendingPoolContractId: getLendingPoolContractId(),
        loanManagerContractId: getLoanManagerContractId(),
        creditSystemContractId: getCreditSystemContractId(),
        minAuraForUnsecured: MIN_POINTS_FOR_UNSECURED,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.requestCollateralLoan = async (req, res) => {
  try {
    const { xlmAmount, daysToRepay, collateralAmount } = req.body;
    const walletAddress = req.user.walletAddress;

    if (!xlmAmount || !daysToRepay || !collateralAmount) {
      return res.status(400).json({
        success: false,
        error: "xlmAmount, daysToRepay and collateralAmount are required",
      });
    }

    const result = await requestCollateralLoan(
      walletAddress,
      Number(collateralAmount),
      Number(xlmAmount),
      Number(daysToRepay)
    );

    res.json({
      success: true,
      message: "Collateral loan request submitted",
      txId: result.txId,
      loanType: "collateral",
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.repayLoan = async (req, res) => {
  try {
    const { amount } = req.body;
    const walletAddress = req.user.walletAddress;

    if (!amount) {
      return res.status(400).json({ success: false, error: "amount is required" });
    }

    const result = await repayLoan(walletAddress, Number(amount));

    const creditScore = await getCreditScore(walletAddress);
    const interestPaid = Number(amount) - Number((await getUserLoan(walletAddress)).principal || 0);
    const pointsEarned = Math.floor(interestPaid / MICRO);

    if (pointsEarned > 0) {
      await addEarnedPoints(walletAddress, pointsEarned);
    }

    res.json({
      success: true,
      message: "Loan repayment submitted",
      txId: result.txId,
      auraPointsEarned: pointsEarned,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.liquidateDefault = async (req, res) => {
  try {
    const { borrower } = req.body;

    if (!borrower) {
      return res.status(400).json({ success: false, error: "borrower is required" });
    }

    const result = await liquidate(borrower);

    res.json({
      success: true,
      message: "Loan liquidated",
      txId: result.txId,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getLoanStatus = async (req, res) => {
  try {
    const walletAddress = req.user.walletAddress;

    const status = await getUserLoanStatus(walletAddress);

    res.json({
      success: true,
      walletAddress,
      ...safeStringify(status),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getLoanStatusByAddress = async (req, res) => {
  try {
    const walletAddress = req.params.walletAddress;

    if (!walletAddress) {
      return res.status(400).json({ success: false, error: "walletAddress required" });
    }

    const status = await getUserLoanStatus(walletAddress);

    res.json({
      success: true,
      walletAddress,
      ...safeStringify(status),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getLoanInfo = async (req, res) => {
  try {
    res.json({
      success: true,
      lendingPoolContractId: process.env.LENDING_POOL_CONTRACT_ID || "",
      loanManagerContractId: process.env.LOAN_MANAGER_CONTRACT_ID || "",
      creditSystemContractId: process.env.CREDIT_SYSTEM_CONTRACT_ID || "",
      config: {
        dailyInterestBps: DAILY_INTEREST_BPS,
        collateralRatio: COLLATERAL_RATIO,
        minAuraForUnsecured: MIN_POINTS_FOR_UNSECURED,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
