const { swapDefaultedCollateral } = require("../services/tinymanService");

function isAuthorized(req) {
  const expected = process.env.SWAP_WEBHOOK_TOKEN || "";
  if (!expected) return true;

  const header = String(req.headers.authorization || "");
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return token === expected;
}

exports.swapDefaultedCollateral = async (req, res) => {
  try {
    if (!isAuthorized(req)) {
      return res.status(401).json({ success: false, error: "Unauthorized webhook call" });
    }

    const {
      walletAddress,
      collateralAmount,
      source,
      liquidationTxId,
    } = req.body || {};

    if (!walletAddress || !collateralAmount) {
      return res.status(400).json({
        success: false,
        error: "walletAddress and collateralAmount are required",
      });
    }

    const swapResult = await swapDefaultedCollateral({
      walletAddress,
      collateralAmount: Number(collateralAmount),
      source: source || "liquidation",
      liquidationTxId: liquidationTxId || null,
    });

    return res.json({
      success: true,
      swapped: !swapResult.skipped,
      ...swapResult,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};