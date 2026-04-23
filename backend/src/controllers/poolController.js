const Deposit = require("../models/depositModel");
const User = require("../models/userModel");
const {
  getPoolInfo,
  getUserDeposits,
  depositToPool,
  withdrawFromPool,
  getLendingPoolContractId,
  submitSignedTransaction,
  toStroops,
  fromStroops,
  MICRO
} = require("../services/appService");

function safeStringify(obj) {
  return JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));
}

function getContractId() {
  return process.env.LENDING_POOL_CONTRACT_ID;
}

exports.deposit = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, signedTxXdr } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.json({ success: false, error: "User not found" });
    }

    if (!amount || amount <= 0) {
      return res.json({ success: false, error: "Valid amount required" });
    }

    let txId;
    if (signedTxXdr) {
      const result = await submitSignedTransaction(signedTxXdr);
      txId = result.hash;
    } else {
      const tx = await depositToPool(user.walletAddress, amount);
      txId = tx.txId;
    }

    res.json({
      success: true,
      message: "Deposit submitted",
      txId,
    });

  } catch (err) {
    console.error(err);
    res.json({ success: false, error: err.message });
  }
};

exports.withdraw = async (req, res) => {
  try {
    const userId = req.user.id;
    const { shares, signedTxXdr } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.json({ success: false, error: "User not found" });
    }

    if (!shares || shares <= 0) {
      return res.json({ success: false, error: "Valid shares amount required" });
    }

    let txId;
    if (signedTxXdr) {
      const result = await submitSignedTransaction(signedTxXdr);
      txId = result.hash;
    } else {
      const result = await withdrawFromPool(user.walletAddress, shares);
      txId = result.txId;
    }

    res.json({
      success: true,
      message: "Withdraw submitted",
      sharesBurned: shares,
      txId,
    });

  } catch (err) {
    console.error(err);
    res.json({ success: false, error: err.message });
  }
};

exports.getPoolInfo = async (req, res) => {
  try {
    const poolInfo = await getPoolInfo();

    res.json({
      success: true,
      pool: safeStringify({
        contractId: getContractId(),
        totalDeposits: fromStroops(poolInfo.totalDeposits || 0n),
        totalShares: fromStroops(poolInfo.totalShares || 0n),
        sharePrice: fromStroops(poolInfo.sharePrice || BigInt(MICRO)),
      }),
    });

  } catch (err) {
    console.error(err);
    res.json({ success: false, error: err.message });
  }
};

exports.getUserInfo = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.json({ success: false, error: "User not found" });
    }

    const userDeposits = await getUserDeposits(user.walletAddress);

    res.json({
      success: true,
      user: {
        id: user._id.toString(),
        walletAddress: user.walletAddress,
        shares: fromStroops(userDeposits || 0n),
      },
    });

  } catch (err) {
    console.error(err);
    res.json({ success: false, error: err.message });
  }
};