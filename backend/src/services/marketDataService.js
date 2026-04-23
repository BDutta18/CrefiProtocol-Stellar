const {
  Horizon,
  Asset,
  Networks,
} = require("@stellar/stellar-sdk");
require("dotenv").config();

const STELLAR_SERVER_URL = process.env.STELLAR_HORIZON_URL || "https://horizon-testnet.stellar.org";
const server = new Horizon.Server(STELLAR_SERVER_URL);

const INTERVAL_SECONDS = {
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "4h": 14400,
  "1d": 86400,
};

const STELLAR_NATIVE_ASSET = "XLM";

function resolveBucketSeconds(interval) {
  return INTERVAL_SECONDS[interval] || INTERVAL_SECONDS["1h"];
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Market provider request failed with status ${response.status}`);
    }
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function toVolumeMap(totalVolumes) {
  const map = new Map();
  if (!Array.isArray(totalVolumes)) return map;

  for (const row of totalVolumes) {
    const [tsMs, vol] = row;
    const tsSec = Math.floor(Number(tsMs) / 1000);
    map.set(tsSec, Number(vol) || 0);
  }

  return map;
}

function buildCandles(prices, totalVolumes, fromTs, toTs, interval) {
  const bucketSeconds = resolveBucketSeconds(interval);
  const volumeByTs = toVolumeMap(totalVolumes);
  const buckets = new Map();

  for (const row of prices || []) {
    const [tsMs, rawPrice] = row;
    const tsSec = Math.floor(Number(tsMs) / 1000);
    const price = Number(rawPrice);

    if (!Number.isFinite(tsSec) || !Number.isFinite(price)) continue;
    if (tsSec < fromTs || tsSec > toTs) continue;

    const bucketTs = Math.floor(tsSec / bucketSeconds) * bucketSeconds;
    const existing = buckets.get(bucketTs);
    const pointVolume = volumeByTs.get(tsSec) || 0;

    if (!existing) {
      buckets.set(bucketTs, {
        time: bucketTs,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: pointVolume,
      });
      continue;
    }

    existing.high = Math.max(existing.high, price);
    existing.low = Math.min(existing.low, price);
    existing.close = price;
    existing.volume += pointVolume;
  }

  return Array.from(buckets.values()).sort((a, b) => a.time - b.time);
}

const ohlcCache = new Map();
const OHLC_CACHE_TTL_MS = 5 * 60 * 1000;

async function getOhlc({ interval, fromTs, toTs }) {
  const cacheKey = `${interval}_${fromTs}_${toTs}`;
  const cached = ohlcCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < OHLC_CACHE_TTL_MS) {
    return cached.candles;
  }

  const rangeSeconds = Math.max(3600, toTs - fromTs);
  const days = clamp(Math.ceil(rangeSeconds / 86400), 1, 90);
  const coinGeckoBase = "https://api.coingecko.com/api/v3";
  const marketChartUrl = `${coinGeckoBase}/coins/stellar/market_chart?vs_currency=usd&days=${days}&interval=hourly`;

  let data;
  try {
    data = await fetchJson(marketChartUrl);
  } catch (err) {
    console.error("Failed to fetch market chart:", err.message);
    return [];
  }

  const candles = buildCandles(data.prices || [], data.total_volumes || [], fromTs, toTs, interval);
  ohlcCache.set(cacheKey, { candles, ts: Date.now() });
  if (ohlcCache.size > 20) {
    const oldest = [...ohlcCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    ohlcCache.delete(oldest[0]);
  }
  return candles;
}

const marketStatsCache = { data: null, ts: 0 };
const MARKET_STATS_CACHE_TTL_MS = 5 * 60 * 1000;

async function getMarketStats() {
  const now = Date.now();
  if (marketStatsCache.data && now - marketStatsCache.ts < MARKET_STATS_CACHE_TTL_MS) {
    return marketStatsCache.data;
  }

  const coinGeckoBase = "https://api.coingecko.com/api/v3";
  const marketsUrl = `${coinGeckoBase}/coins/markets?vs_currency=usd&ids=stellar&price_change_percentage=24h`;
  const rows = await fetchJson(marketsUrl);
  const row = Array.isArray(rows) ? rows[0] : null;

  if (!row) {
    throw new Error("No market stats returned by provider");
  }

  const data = {
    price: Number(row.current_price || 0),
    change24h: Number(row.price_change_percentage_24h || 0),
    volume24h: Number(row.total_volume || 0),
    liquidity: Number(row.market_cap || 0),
    high24h: Number(row.high_24h || 0),
    low24h: Number(row.low_24h || 0),
  };

  marketStatsCache.data = data;
  marketStatsCache.ts = now;
  return data;
}

function formatUnits(raw, decimals) {
  const value = BigInt(raw || 0);
  if (decimals <= 0) return value.toString();
  const sign = value < 0n ? "-" : "";
  const base = sign ? (-value).toString() : value.toString();
  const padded = base.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals);
  const frac = padded.slice(-decimals).replace(/0+$/, "");
  return frac ? `${sign}${whole}.${frac}` : `${sign}${whole}`;
}

const stellarPoolCache = { data: null, ts: 0 };
const STELLAR_POOL_CACHE_TTL_MS = 5 * 60 * 1000;

async function getStellarPoolSnapshot() {
  const now = Date.now();
  if (stellarPoolCache.data && now - stellarPoolCache.ts < STELLAR_POOL_CACHE_TTL_MS) {
    return stellarPoolCache.data;
  }

  const poolContractId = process.env.LENDING_POOL_CONTRACT_ID;
  
  try {
    let nativeBalance = 0;
    if (poolContractId) {
      try {
        const account = await server.loadAccount(poolContractId);
        nativeBalance = Number(account.balances.find(b => b.asset_type === "native")?.balance || 0);
      } catch (e) {
        console.log("Pool account not found, returning 0 balance");
      }
    }

    const pools = await getLiquidityPools();
    const totalLiquidity = pools.reduce((sum, p) => {
      const nativeReserve = p.reserves.find(r => r.asset === "native");
      return sum + (nativeReserve ? Number(nativeReserve.amount) : 0);
    }, 0);

    const data = {
      poolContractId: poolContractId || "not configured",
      xlmReserve: nativeBalance + totalLiquidity,
      symbol: "XLM",
      quoteAssetId: "USDC",
      quoteSymbol: "USDC",
      quoteReserve: 0,
      usdcPerXlm: 0.11,
      round: Date.now(),
    };

    stellarPoolCache.data = data;
    stellarPoolCache.ts = now;
    return data;
  } catch (err) {
    console.error("Failed to get pool snapshot:", err.message);
    return {
      poolContractId: poolContractId || "not configured",
      xlmReserve: 0,
      symbol: "XLM",
      quoteAssetId: "USDC",
      quoteSymbol: "USDC",
      quoteReserve: 0,
      usdcPerXlm: 0.11,
      round: Date.now(),
    };
  }
}

const liquidityPoolCache = { data: null, ts: 0 };
const LIQUIDITY_POOL_CACHE_TTL_MS = 60 * 1000;

async function getLiquidityPools() {
  const now = Date.now();
  if (liquidityPoolCache.data && now - liquidityPoolCache.ts < LIQUIDITY_POOL_CACHE_TTL_MS) {
    return liquidityPoolCache.data;
  }

  try {
    const response = await server.liquidityPools().limit(20).call();
    const pools = response.records.map((pool) => ({
      id: pool.id,
      type: pool.type,
      feeBps: pool.fee_bp,
      totalShares: pool.total_shares,
      reserves: pool.reserves.map((r) => ({
        asset: r.asset,
        amount: r.amount,
      })),
    }));

    liquidityPoolCache.data = pools;
    liquidityPoolCache.ts = now;
    return pools;
  } catch (err) {
    console.error("Failed to fetch liquidity pools:", err.message);
    throw err;
  }
}

async function getLiquidityPoolById(poolId) {
  try {
    const pool = await server.getLiquidityPool(poolId);
    return {
      id: pool.id,
      type: pool.type,
      feeBps: pool.fee_bp,
      totalShares: pool.total_shares,
      reserves: pool.reserves.map((r) => ({
        asset: r.asset,
        amount: r.amount,
      })),
    };
  } catch (err) {
    console.error("Failed to fetch liquidity pool:", err.message);
    throw err;
  }
}

module.exports = {
  server,
  getOhlc,
  getMarketStats,
  getStellarPoolSnapshot,
  getLiquidityPools,
  getLiquidityPoolById,
  STELLAR_NATIVE_ASSET,
};