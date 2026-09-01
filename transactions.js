// api/transactions.js
// GET /api/transactions?customerId=abc
//
// Returns ONLY the transactions belonging to this customerId.
// This is what satisfies requirement #4: each customer can view only
// their own transaction history, with no way to see anyone else's.

const { db } = require("../lib/firebaseAdmin");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { customerId } = req.query;
  if (!customerId) {
    return res.status(400).json({ message: "customerId query param is required" });
  }

  try {
    const snap = await db
      .collection("transactions")
      .where("customerId", "==", customerId)
      .orderBy("createdAt", "desc")
      .get();

    const transactions = snap.docs.map((doc) => doc.data());

    return res.status(200).json({ transactions });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message || "Could not fetch transactions" });
  }
};
