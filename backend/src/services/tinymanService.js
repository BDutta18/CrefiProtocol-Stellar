require("dotenv").config();

const {
  Keypair,
  TransactionBuilder,
  Networks,
  Asset,
} = require("@stellar/stellar-sdk");
require("./appService");

const STELLAR_NETWORK = process.env.STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET;

function getStellarNetwork() {
  return STELLAR_NETWORK;
}

function getSwapConfig() {
  return {
    enabled: String(process.env.AUTO_SWAP_ENABLED || "false").toLowerCase() === "true",
    webhookUrl: process.env.SWAP_WEBHOOK_URL || null,
    webhookToken: process.env.SWAP_WEBHOOK_TOKEN || "",
  };
}

async function swapDefaultedCollateral(payload) {
  const config = getSwapConfig();

  if (!config.enabled) {
    return { skipped: true, reason: "auto swap disabled" };
  }

  if (!config.webhookUrl) {
    return { skipped: true, reason: "swap webhook not configured" };
  }

  const response = await fetch(config.webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.webhookToken
        ? { Authorization: `Bearer ${config.webhookToken}` }
        : {}),
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Swap webhook failed (${response.status}): ${text}`);
  }

  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch (_err) {
    parsed = { raw: text };
  }

  return {
    skipped: false,
    mode: "webhook",
    result: parsed,
  };
}

module.exports = {
  getStellarNetwork,
  getSwapConfig,
  swapDefaultedCollateral,
};