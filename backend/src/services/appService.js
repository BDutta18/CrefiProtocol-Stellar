const {
  Keypair,
  TransactionBuilder,
  Networks,
  StrKey,
  nativeToScVal,
  Operation,
  Asset,
  Horizon,
  rpc,
  scValToNative,
} = require("@stellar/stellar-sdk");
require("dotenv").config();

const horizonServer = new Horizon.Server(
  process.env.STELLAR_HORIZON_URL || "https://horizon-testnet.stellar.org"
);

const sorobanServer = new rpc.Server(
  process.env.STELLAR_SOROBAN_URL || "https://soroban-testnet.stellar.org"
);

let server = sorobanServer;

const NETWORK_PASSPHRASE =
  process.env.STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET;

function getServer() {
  return server;
}

function getHorizonServer() {
  return horizonServer;
}

function setServer(srv) {
  server = srv;
}

function getNetworkPassphrase() {
  return NETWORK_PASSPHRASE;
}

function getAdminKeypair() {
  const secret = process.env.ADMIN_SECRET_KEY;
  if (!secret || secret === "your-admin-secret-key-here") {
    throw new Error("ADMIN_SECRET_KEY not configured in backend/.env");
  }
  return Keypair.fromSecret(secret);
}

function getAdminAddress() {
  return getAdminKeypair().publicKey();
}

function getLendingPoolContractId() {
  const id = process.env.LENDING_POOL_CONTRACT_ID;
  if (!id) {
    throw new Error("LENDING_POOL_CONTRACT_ID not configured");
  }
  return id;
}

function getLoanManagerContractId() {
  const id = process.env.LOAN_MANAGER_CONTRACT_ID;
  if (!id) {
    throw new Error("LOAN_MANAGER_CONTRACT_ID not configured");
  }
  return id;
}

function getCreditSystemContractId() {
  const id = process.env.CREDIT_SYSTEM_CONTRACT_ID;
  if (!id) {
    throw new Error("CREDIT_SYSTEM_CONTRACT_ID not configured");
  }
  return id;
}

async function getAccountPublicKey(address) {
  try {
    const account = await horizonServer.loadAccount(address);
    return account;
  } catch (err) {
    if (err.response?.status === 404) {
      throw new Error(`Account ${address} not found on network`);
    }
    throw err;
  }
}

async function getAccountSequenceNumber(address) {
  const account = await getAccountPublicKey(address);
  return account.sequenceNumber();
}

const MICRO = 10_000_000;

function toStroops(xlmAmount) {
  return BigInt(Math.floor(Number(xlmAmount) * MICRO));
}

function fromStroops(stroops) {
  return Number(stroops) / MICRO;
}

async function submitTransaction(envelope) {
  const tx = await horizonServer.submitTransaction(envelope);
  return tx;
}

async function simulateTransaction(envelope) {
  try {
    const response = await sorobanServer.simulateTransaction(envelope);
    return response;
  } catch (err) {
    console.error("Simulation error:", err.message);
    throw err;
  }
}

async function buildInitPoolTransaction() {
  const admin = getAdminKeypair();
  const contractId = getLendingPoolContractId();
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
        method: "init",
        args: [],
      })
    )
    .build();

  tx.sign(admin);

  return tx;
}

async function initPool() {
  const admin = getAdminKeypair();
  const contractId = getLendingPoolContractId();
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
        method: "init",
        args: [],
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

async function invokePoolMethod(method, args = []) {
  const admin = getAdminKeypair();
  const contractId = getLendingPoolContractId();
  const account = await getAccountPublicKey(admin.publicKey());

  const fee = await horizonServer.fetchBaseFee();

  const tx = new TransactionBuilder(account, {
    fee,
    networkPassphrase: NETWORK_PASSPHRASE,
    cursor: null,
  })

async function getUserDeposits(userAddress) {
  try {
    const admin = getAdminKeypair();
    const contractId = getLendingPoolContractId();
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
          method: "get_user_deposits",
          args: [nativeToScVal(userAddress, "address")],
        })
      )
      .build();

    tx.sign(admin);

    const response = await simulateTransaction(tx);
    return response;
  } catch (err) {
    if (err.message?.includes("No such contract") || err.message?.includes("404")) {
      return { totalDeposits: 0, totalShares: 0, sharePrice: MICRO };
    }
    throw err;
  }
}

async function addLiquidity(fromAddress, amount) {
  const admin = getAdminKeypair();
  const contractId = getLendingPoolContractId();
  const account = await getAccountPublicKey(fromAddress);

  const fee = await horizonServer.fetchBaseFee();
  const baseFee = BigInt(fee * 2);

  const tx = new TransactionBuilder(account, {
    fee: Number(baseFee),
    networkPassphrase: NETWORK_PASSPHRASE,
    cursor: null,
  })
    .setTimeout(60)
    .addOperation(
      Operation.invokeContractFunction({
        contractId,
        method: "add_liquidity",
        args: [
          nativeToScVal(fromAddress, "address"),
          nativeToScVal(toStroops(amount), "i128"),
        ],
      })
    )
    .addOperation(
      Operation.payment({
        destination: contractId,
        asset: Asset.native(),
        amount: amount.toString(),
      })
    )
    .build();

  return tx;
}

async function depositToPool(fromAddress, amount) {
  const admin = getAdminKeypair();
  const contractId = getLendingPoolContractId();
  const account = await getAccountPublicKey(fromAddress);

  const fee = await horizonServer.fetchBaseFee();
  const baseFee = BigInt(fee * 2);

  const tx = new TransactionBuilder(account, {
    fee: Number(baseFee),
    networkPassphrase: NETWORK_PASSPHRASE,
    cursor: null,
  })
    .setTimeout(60)
    .addOperation(
      Operation.invokeContractFunction({
        contractId,
        method: "deposit",
        args: [
          nativeToScVal(fromAddress, "address"),
          nativeToScVal(toStroops(amount), "i128"),
        ],
      })
    )
    .addOperation(
      Operation.payment({
        destination: contractId,
        asset: Asset.native(),
        amount: amount.toString(),
      })
    )
    .build();

  tx.sign(admin);
  const result = await horizonServer.submitTransaction(tx);

  return { txId: result.hash, success: true };
}

async function submitSignedTransaction(signedTxXdr) {
  try {
    const tx = TransactionBuilder.fromXdr(signedTxXdr, NETWORK_PASSPHRASE);
    const result = await horizonServer.submitTransaction(tx);
    return { hash: result.hash, success: true };
  } catch (err) {
    console.error("Submit signed transaction error:", err);
    throw new Error(`Failed to submit transaction: ${err.message}`);
  }
}

async function withdrawFromPool(fromAddress, shares) {
  const admin = getAdminKeypair();
  const contractId = getLendingPoolContractId();
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
        method: "withdraw",
        args: [
          nativeToScVal(fromAddress, "address"),
          nativeToScVal(shares, "i128"),
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

module.exports = {
  initPool,
  invokePoolMethod,
  getPoolInfo,
  getUserDeposits,
  addLiquidity,
  depositToPool,
  withdrawFromPool,
  submitSignedTransaction,
  getNetworkPassphrase,
  getHorizonServer,
  getLendingPoolContractId,
  getLoanManagerContractId,
  getCreditSystemContractId,
  getAdminKeypair,
  getAdminAddress,
  getAccountPublicKey,
  toStroops,
  fromStroops,
  simulateTransaction,
  submitTransaction,
  horizonServer,
  server,
};
