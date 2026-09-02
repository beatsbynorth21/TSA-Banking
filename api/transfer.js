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
    const rawResult = await nibss.transfer({ from: fromAccount, to: toAccount, amount });

    // NIBSS's live responses don't always match their docs (we hit this
    // with validateBvn too) -- some endpoints nest the real payload under
    // a "data" key instead of returning it flat, or use a different field
    // name entirely. Check the likely shapes and never let an undefined
    // value reach Firestore.
    const payload =
      rawResult && typeof rawResult.data === "object" && rawResult.data !== null
        ? rawResult.data
        : rawResult || {};

    const transactionId =
      payload.transactionId || payload.id || payload.reference || payload.txnId || "unknown";
    const status =
      payload.status || rawResult.status || (rawResult.success ? "success" : "unknown");

    // Log the transaction under this customer, so /api/transactions can
    // later return only what belongs to them. from/to/amount come from
    // our own request, so those are trustworthy no matter how NIBSS's
    // response is shaped.
    await db.collection("transactions").add({
      customerId,
      transactionId,
      from: fromAccount,
      to: toAccount,
      amount,
      status,
      rawNibssResponse: rawResult || null, // TEMP: remove once transactionId/status look right
      createdAt: new Date().toISOString(),
    });

    return res.status(200).json({
      transactionId,
      status,
      amount,
      from: fromAccount,
      to: toAccount,
      raw: rawResult,
    });
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({
      message: err.message || "Transfer failed",
      details: err.data,
    });
  }
};
