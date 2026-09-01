// api/transaction-status.js
// GET /api/transaction-status?customerId=abc&transactionId=TX123...
//
// Checks that the transaction was logged under this customerId in
// Firestore (i.e. they were the sender) before querying NIBSS for
// its live status.

const nibss = require("../lib/nibss");
const { db } = require("../lib/firebaseAdmin");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { customerId, transactionId } = req.query;
  if (!customerId || !transactionId) {
    return res.status(400).json({
      message: "customerId and transactionId query params are required",
    });
  }

  try {
    const txSnap = await db
      .collection("transactions")
      .where("customerId", "==", customerId)
      .where("transactionId", "==", transactionId)
      .limit(1)
      .get();

    if (txSnap.empty) {
      return res.status(403).json({
        message: "This transaction does not belong to this customer",
      });
    }

    const result = await nibss.transactionStatus(transactionId);
    return res.status(200).json(result);
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({
      message: err.message || "Transaction status check failed",
      details: err.data,
    });
  }
};
