const { getMarketStats, getOhlc, getStellarPoolSnapshot, getLiquidityPools, getLiquidityPoolById } = require("../services/marketDataService");

function parseUnix(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.floor(n);
}

exports.getOhlc = async (req, res) => {
  try {
    const interval = String(req.query.interval || "1h");
    const now = Math.floor(Date.now() / 1000);
    const toTs = parseUnix(req.query.to, now);
    const fromTs = parseUnix(req.query.from, now - 60 * 3600);

    if (toTs <= fromTs) {
      return res.status(400).json({ error: "Invalid time range" });
    }

    const candles = await getOhlc({ interval, fromTs, toTs });
    return res.json({ candles });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to fetch OHLC" });
  }
};

exports.getStats = async (_req, res) => {
  try {
    const stats = await getMarketStats();
    return res.json(stats);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to fetch market stats" });
  }
};

exports.getPoolSnapshot = async (_req, res) => {
  try {
    const snapshot = await getStellarPoolSnapshot();
    return res.json(snapshot);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to fetch pool snapshot" });
  }
};

exports.getLiquidityPools = async (_req, res) => {
  try {
    const pools = await getLiquidityPools();
    return res.json({ pools });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to fetch liquidity pools" });
  }
};

exports.getLiquidityPool = async (req, res) => {
  try {
    const poolId = String(req.params.poolId || "");
    if (!poolId) {
      return res.status(400).json({ error: "Pool ID required" });
    }
    const pool = await getLiquidityPoolById(poolId);
    return res.json(pool);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to fetch liquidity pool" });
  }
};