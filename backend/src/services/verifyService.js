const { server } = require("@stellar/stellar-sdk");

async function verifyTransaction(txId) {
  try {
    const txInfo = await server.getTransaction(txId);

    if (!txInfo) {
      throw new Error("Transaction not found");
    }

    if (!txInfo.successful) {
      throw new Error("Transaction was not successful");
    }

    const tx = txInfo.transaction;
    const source = tx.source || tx.sourceAccount;
    const operations = txInfo.operationCount || 0;

    return {
      txId: txId,
      source: source,
      operations: operations,
      successful: txInfo.successful,
    };
  } catch (err) {
    if (err.response?.status === 404) {
      throw new Error("Transaction not found");
    }
    throw err;
  }
}

module.exports = { verifyTransaction };