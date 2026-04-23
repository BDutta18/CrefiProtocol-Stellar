const {
  Keypair,
  Asset,
  TransactionBuilder,
  Networks,
  nativeToScVal,
  Operation,
} = require("@stellar/stellar-sdk");
require("dotenv").config();

const {
  server,
  horizonServer,
  getAdminKeypair,
  getAdminAddress,
  getLendingPoolContractId,
  getLoanManagerContractId,
  getCreditSystemContractId,
  getAccountPublicKey,
  getNetworkPassphrase,
  toStroops,
  fromStroops,
  MICRO,
  simulateTransaction,
  submitTransaction,
} = require("./appService");

const NETWORK_PASSPHRASE = getNetworkPassphrase();
const DAILY_INTEREST_BPS = 10;
const COLLATERAL_RATIO = 150;
const MIN_POINTS_FOR_UNSECURED = 30;

async function invokeLoanManagerMethod(method, args = []) {
  const admin = getAdminKeypair();
  const contractId = getLoanManagerContractId();
  const account = await getAccountPublicKey(admin.publicKey());

  const fee = await horizonServer.fetchBaseFee();

  const tx = new TransactionBuilder(account, {
    fee,
    networkPassphrase: NETWORK_PASSPHRASE,
    cursor: null,
  })
    .setTimeout(60)
    .addOperation(
      Operation.invokeContractFunction({
        contractId,
        method,
        args,
      })
    )
    .build();

  tx.sign(admin);

  const result = await submitTransaction(tx);
  return {
    txId: result.id,
    successful: result.successful,
    result: result.result,
  };
}

async function invokeCreditSystemMethod(method, args = []) {
  const admin = getAdminKeypair();
  const contractId = getCreditSystemContractId();
  const account = await getAccountPublicKey(admin.publicKey());

  const fee = await horizonServer.fetchBaseFee();

  const tx = new TransactionBuilder(account, {
    fee,
    networkPassphrase: NETWORK_PASSPHRASE,
    cursor: null,
  })
    .setTimeout(60)
    .addOperation(
      Operation.invokeContractFunction({
        contractId,
        method,
        args,
      })
    )
    .build();

  tx.sign(admin);

  const result = await submitTransaction(tx);
  return {
    txId: result.id,
    successful: result.successful,
    result: result.result,
  };
}

function calculateDue(xlmAmountStroops, daysToRepay) {
  const principal = BigInt(xlmAmountStroops);
  const perDay = (principal * BigInt(DAILY_INTEREST_BPS)) / BigInt(10000);
  const interest = perDay * BigInt(daysToRepay);
  const due = principal + interest;
  return {
    principal: Number(principal),
    interest: Number(interest),
    due: Number(due),
  };
}

function getCollateralQuote(xlmAmountStroops, daysToRepay) {
  const xlmAmount = Number(xlmAmountStroops);
  const days = Number(daysToRepay);

  const { interest, due } = calculateDue(xlmAmountStroops, days);
  const requiredCollateral = (xlmAmount * COLLATERAL_RATIO) / 100;

  return {
    xlmAmount,
    xlmAmountStroops: xlmAmount,
    daysToRepay: days,
    requiredCollateralXlm: requiredCollateral,
    requiredCollateralStroops: toStroops(requiredCollateral),
    estimatedInterestStroops: interest,
    estimatedDueStroops: Number(due),
  };
}

async function requestCollateralLoan(
  borrowerAddress,
  collateralAmount,
  loanAmount,
  daysToRepay
) {
  const contractId = getLoanManagerContractId();
  const account = await getAccountPublicKey(borrowerAddress);

  const fee = await horizonServer.fetchBaseFee();

  const tx = new TransactionBuilder(account, {
    fee,
    networkPassphrase: NETWORK_PASSPHRASE,
    cursor: null,
  })
    .setTimeout(60)
    .addOperation(
      Operation.invokeContractFunction({
        contractId,
        method: "request_loan",
        args: [
          nativeToScVal(borrowerAddress, "address"),
          nativeToScVal(toStroops(collateralAmount), "i128"),
          nativeToScVal(toStroops(loanAmount), "i128"),
          nativeToScVal(daysToRepay, "u32"),
        ],
      })
    )
    .build();

  const result = await submitTransaction(tx);
  return {
    txId: result.id,
    successful: result.successful,
  };
}

async function repayLoan(fromAddress, amount) {
  const contractId = getLoanManagerContractId();
  const account = await getAccountPublicKey(fromAddress);

  const fee = await horizonServer.fetchBaseFee();

  const tx = new TransactionBuilder(account, {
    fee,
    networkPassphrase: NETWORK_PASSPHRASE,
    cursor: null,
  })
    .setTimeout(60)
    .addOperation(
      Operation.invokeContractFunction({
        contractId,
        method: "repay",
        args: [
          nativeToScVal(fromAddress, "address"),
          nativeToScVal(toStroops(amount), "i128"),
        ],
      })
    )
    .build();

  const result = await submitTransaction(tx);
  return {
    txId: result.id,
    successful: result.successful,
  };
}

async function getUserLoan(userAddress) {
  try {
    const admin = getAdminKeypair();
    const contractId = getLoanManagerContractId();
    const account = await getAccountPublicKey(admin.publicKey());

    const fee = await horizonServer.fetchBaseFee();

    const tx = new TransactionBuilder(account, {
      fee,
      networkPassphrase: NETWORK_PASSPHRASE,
      cursor: null,
    })
      .setTimeout(30)
      .addOperation(
        Operation.invokeContractFunction({
          contractId,
          method: "get_loan",
          args: [nativeToScVal(userAddress, "address")],
        })
      )
      .build();

    tx.sign(admin);

    const response = await simulateTransaction(tx);
    return response;
  } catch (err) {
    if (err.message?.includes("No such contract") || err.message?.includes("404")) {
      return { principal: 0, collateral: 0, dueTimestamp: 0, status: 0 };
    }
    throw err;
  }
}

async function isLoanOverdue(userAddress) {
  try {
    const admin = getAdminKeypair();
    const contractId = getLoanManagerContractId();
    const account = await getAccountPublicKey(admin.publicKey());

    const fee = await horizonServer.fetchBaseFee();

    const tx = new TransactionBuilder(account, {
      fee,
      networkPassphrase: NETWORK_PASSPHRASE,
      cursor: null,
    })
      .setTimeout(30)
      .addOperation(
        Operation.invokeContractFunction({
          contractId,
          method: "is_overdue",
          args: [nativeToScVal(userAddress, "address")],
        })
      )
      .build();

    tx.sign(admin);

    const response = await simulateTransaction(tx);
    return response;
  } catch (err) {
    if (err.message?.includes("No such contract") || err.message?.includes("404")) {
      return false;
    }
    throw err;
  }
}

async function liquidate(borrowerAddress) {
  const contractId = getLoanManagerContractId();
  const admin = getAdminKeypair();
  const account = await getAccountPublicKey(admin.publicKey());

  const fee = await horizonServer.fetchBaseFee();

  const tx = new TransactionBuilder(account, {
    fee,
    networkPassphrase: NETWORK_PASSPHRASE,
    cursor: null,
  })
    .setTimeout(60)
    .addOperation(
      Operation.invokeContractFunction({
        contractId,
        method: "liquidate",
        args: [nativeToScVal(borrowerAddress, "address")],
      })
    )
    .build();

  tx.sign(admin);

  const result = await submitTransaction(tx);
  return {
    txId: result.id,
    successful: result.successful,
  };
}

async function getCreditScore(userAddress) {
  try {
    const admin = getAdminKeypair();
    const contractId = getCreditSystemContractId();
    const account = await getAccountPublicKey(admin.publicKey());

    const fee = await horizonServer.fetchBaseFee();

    const tx = new TransactionBuilder(account, {
      fee,
      networkPassphrase: NETWORK_PASSPHRASE,
      cursor: null,
    })
      .setTimeout(30)
      .addOperation(
        Operation.invokeContractFunction({
          contractId,
          method: "get_credit_score",
          args: [nativeToScVal(userAddress, "address")],
        })
      )
      .build();

    tx.sign(admin);

    const response = await simulateTransaction(tx);
    return response;
  } catch (err) {
    if (err.message?.includes("No such contract") || err.message?.includes("404")) {
      return { earnedPoints: 0, penaltyPoints: 0, isBlacklisted: false };
    }
    throw err;
  }
}

async function getNetPoints(userAddress) {
  try {
    const admin = getAdminKeypair();
    const contractId = getCreditSystemContractId();
    const account = await getAccountPublicKey(admin.publicKey());

    const fee = await horizonServer.fetchBaseFee();

    const tx = new TransactionBuilder(account, {
      fee,
      networkPassphrase: NETWORK_PASSPHRASE,
      cursor: null,
    })
      .setTimeout(30)
      .addOperation(
        Operation.invokeContractFunction({
          contractId,
          method: "get_net_points",
          args: [nativeToScVal(userAddress, "address")],
        })
      )
      .build();

    tx.sign(admin);

    const response = await simulateTransaction(tx);
    return response;
  } catch (err) {
    if (err.message?.includes("No such contract") || err.message?.includes("404")) {
      return 0;
    }
    throw err;
  }
}

async function getUnsecuredLimit(userAddress) {
  try {
    const admin = getAdminKeypair();
    const contractId = getCreditSystemContractId();
    const account = await getAccountPublicKey(admin.publicKey());

    const fee = await horizonServer.fetchBaseFee();

    const tx = new TransactionBuilder(account, {
      fee,
      networkPassphrase: NETWORK_PASSPHRASE,
      cursor: null,
    })
      .setTimeout(30)
      .addOperation(
        Operation.invokeContractFunction({
          contractId,
          method: "get_unsecured_limit",
          args: [nativeToScVal(userAddress, "address")],
        })
      )
      .build();

    tx.sign(admin);

    const response = await simulateTransaction(tx);
    return response;
  } catch (err) {
    if (err.message?.includes("No such contract") || err.message?.includes("404")) {
      return 0;
    }
    throw err;
  }
}

async function isEligibleForUnsecured(userAddress) {
  try {
    const admin = getAdminKeypair();
    const contractId = getCreditSystemContractId();
    const account = await getAccountPublicKey(admin.publicKey());

    const fee = await horizonServer.fetchBaseFee();

    const tx = new TransactionBuilder(account, {
      fee,
      networkPassphrase: NETWORK_PASSPHRASE,
      cursor: null,
    })
      .setTimeout(30)
      .addOperation(
        Operation.invokeContractFunction({
          contractId,
          method: "is_eligible_for_unsecured",
          args: [nativeToScVal(userAddress, "address")],
        })
      )
      .build();

    tx.sign(admin);

    const response = await simulateTransaction(tx);
    return response;
  } catch (err) {
    if (err.message?.includes("No such contract") || err.message?.includes("404")) {
      return false;
    }
    throw err;
  }
}

async function addEarnedPoints(userAddress, points) {
  const contractId = getCreditSystemContractId();
  const admin = getAdminKeypair();
  const account = await getAccountPublicKey(admin.publicKey());

  const fee = await horizonServer.fetchBaseFee();

  const tx = new TransactionBuilder(account, {
    fee,
    networkPassphrase: NETWORK_PASSPHRASE,
    cursor: null,
  })
    .setTimeout(60)
    .addOperation(
      Operation.invokeContractFunction({
        contractId,
        method: "add_earned_points",
        args: [
          nativeToScVal(userAddress, "address"),
          nativeToScVal(points, "u32"),
        ],
      })
    )
    .build();

  tx.sign(admin);

  const result = await submitTransaction(tx);
  return {
    txId: result.id,
    successful: result.successful,
  };
}

async function addPenaltyPoints(userAddress, points) {
  const contractId = getCreditSystemContractId();
  const admin = getAdminKeypair();
  const account = await getAccountPublicKey(admin.publicKey());

  const fee = await horizonServer.fetchBaseFee();

  const tx = new TransactionBuilder(account, {
    fee,
    networkPassphrase: NETWORK_PASSPHRASE,
    cursor: null,
  })
    .setTimeout(60)
    .addOperation(
      Operation.invokeContractFunction({
        contractId,
        method: "add_penalty_points",
        args: [
          nativeToScVal(userAddress, "address"),
          nativeToScVal(points, "u32"),
        ],
      })
    )
    .build();

  tx.sign(admin);

  const result = await submitTransaction(tx);
  return {
    txId: result.id,
    successful: result.successful,
  };
}

async function getUserLoanStatus(walletAddress) {
  let principal = 0n;
  let collateral = 0n;
  let dueTimestamp = 0;
  let status = 0;

  if (!walletAddress) {
    return {
      walletAddress: null,
      activeLoan: false,
      principal: 0,
      collateral: 0,
      dueTimestamp: 0,
      loanStatus: 0,
      isOverdue: false,
      creditScore: {
        earned: 0,
        penalty: 0,
        isBlacklisted: false,
      },
      unsecuredLimit: 0,
      unsecuredEligible: false,
      minAuraPointsForUnsecured: MIN_POINTS_FOR_UNSECURED,
    };
  }

  try {
    const loan = await getUserLoan(walletAddress);
    if (loan) {
      principal = loan.principal;
      collateral = loan.collateral;
      dueTimestamp = loan.dueTimestamp || 0;
      status = loan.status || 0;
    }
  } catch (err) {
    console.log("No active loan for", walletAddress, err.message);
  }

  let netPoints = 0;
  let penalty = 0;
  let isBlacklisted = false;

  try {
    const user = await User.findOne({ walletAddress });
    netPoints = user?.auraPoints || 0;
    penalty = user?.auraPenalty || 0;
    isBlacklisted = user?.isBlacklisted || false;
  } catch (err) {
    console.log("User not found for", walletAddress, err.message);
  }

  return {
    walletAddress,
    activeLoan: status === 1,
    principal: Number(principal),
    collateral: Number(collateral),
    dueTimestamp,
    loanStatus: status,
    isOverdue: dueTimestamp > 0 && dueTimestamp < Date.now(),
    creditScore: {
      earned: netPoints,
      penalty: penalty,
      isBlacklisted: isBlacklisted,
    },
    unsecuredLimit: netPoints >= MIN_POINTS_FOR_UNSECURED ? netPoints * 1000000 : 0,
    unsecuredEligible: netPoints >= MIN_POINTS_FOR_UNSECURED && !isBlacklisted,
    minAuraPointsForUnsecured: MIN_POINTS_FOR_UNSECURED,
  };
}

module.exports = {
  calculateDue,
  getCollateralQuote,
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
  addPenaltyPoints,
  getUserLoanStatus,
  invokeLoanManagerMethod,
  invokeCreditSystemMethod,
  getLoanManagerContractId,
  getCreditSystemContractId,
  DAILY_INTEREST_BPS,
  COLLATERAL_RATIO,
  MIN_POINTS_FOR_UNSECURED,
  MICRO,
};
