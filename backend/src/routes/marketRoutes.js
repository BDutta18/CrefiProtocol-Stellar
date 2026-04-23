const express = require("express");
const router = express.Router();
const marketController = require("../controllers/marketController");

router.get("/", (_req, res) => {
  res.json({
    service: "market",
    endpoints: ["GET /api/market/stats", "GET /api/market/ohlc"],
  });
});

router.get("/ohlc", marketController.getOhlc);
router.get("/stats", marketController.getStats);
router.get("/pool-snapshot", marketController.getPoolSnapshot);
router.get("/liquidity-pools", marketController.getLiquidityPools);
router.get("/liquidity-pool/:poolId", marketController.getLiquidityPool);

module.exports = router;
