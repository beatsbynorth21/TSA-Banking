// api/transfer.js
// POST body:
// {
//   "customerId": "the app user initiating the transfer",
//   "fromAccount": "must belong to customerId",
//   "toAccount": "recipient account number",
//   "amount": 5000
// }
//
// This is where data isolation for transfers is enforced: we check
// in OUR OWN Firestore records that `fromAccount` actually belongs to
// `customerId` before ever calling NIBSS. Without this check, anyone
// could move money out of any account number.

const nibss = require("../lib/nibss");
const { db } = require("../lib/firebaseAdmin");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { customerId, fromAccount, toAccount, amount } = req.body || {};

  if (!customerId || !fromAccount || !toAccount || !amount) {
    return res.status(400).json({
      message: "customerId, fromAccount, toAccount, and amount are all required",
    });
  }

  try {
    // Ownership check
    const ownerSnap = await db
      .collection("accounts")
      .where("customerId", "==", customerId)
      .where("accountNumber", "==", fromAccount)
      .limit(1)
      .get();

    if (ownerSnap.empty) {
      return res.status(403).json({
        message: "fromAccount does not belong to this customer",
      });
    }

    // Execute the transfer against the NIBSS sandbox
    const result = await nibss.transfer({ from: fromAccount, to: toAccount, amount });

    // Log the transaction under this customer, so /api/transactions
    // can later return only what belongs to them.
    await db.collection("transactions").add({
      customerId,
      transactionId: result.transactionId,
      from: fromAccount,
      to: toAccount,
      amount: result.amount,
      status: result.status,
      createdAt: new Date().toISOString(),
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({
      message: err.message || "Transfer failed",
      details: err.data,
    });
  }
};
