// api/balance.js
// GET /api/balance?customerId=abc&accountNumber=1234567890
//
// Verifies the account belongs to the requesting customer before
// returning the balance — a customer should only be able to check
// their own account's balance.

const nibss = require("../lib/nibss");
const { db } = require("../lib/firebaseAdmin");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { customerId, accountNumber } = req.query;
  if (!customerId || !accountNumber) {
    return res.status(400).json({
      message: "customerId and accountNumber query params are required",
    });
  }

  try {
    const ownerSnap = await db
      .collection("accounts")
      .where("customerId", "==", customerId)
      .where("accountNumber", "==", accountNumber)
      .limit(1)
      .get();

    if (ownerSnap.empty) {
      return res.status(403).json({
        message: "accountNumber does not belong to this customer",
      });
    }

    const result = await nibss.getBalance(accountNumber);
    return res.status(200).json(result);
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({
      message: err.message || "Balance check failed",
      details: err.data,
    });
  }
};
