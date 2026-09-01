// api/onboard-customer.js
// POST body:
// {
//   "customerId": "any string that identifies YOUR app's user (e.g. their Firebase Auth uid)",
//   "firstName": "...",
//   "lastName": "...",
//   "dob": "YYYY-MM-DD",
//   "phone": "...",
//   "bvn": "11-digit test bvn"
// }
//
// Flow (this is what enforces requirement #1 — onboarding before account
// creation — at YOUR system's level, not just NIBSS's):
//   1. Register the BVN with NIBSS
//   2. Validate the BVN with NIBSS
//   3. Only if valid, create the bank account
//   4. Save the customer + account to Firestore, linked by customerId

const nibss = require("../lib/nibss");
const { db } = require("../lib/firebaseAdmin");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { customerId, firstName, lastName, dob, phone, bvn } = req.body || {};

  if (!customerId || !firstName || !lastName || !dob || !phone || !bvn) {
    return res.status(400).json({
      message: "customerId, firstName, lastName, dob, phone, and bvn are all required",
    });
  }

  try {
    // Reject duplicate onboarding for the same app customer.
    const existing = await db
      .collection("accounts")
      .where("customerId", "==", customerId)
      .limit(1)
      .get();

    if (!existing.empty) {
      return res.status(409).json({ message: "This customer already has an account" });
    }

    // Step 1: register identity
    await nibss.insertBvn({ bvn, firstName, lastName, dob, phone });

    // Step 2: verify identity before proceeding — this is the
    // "account creation only after successful onboarding and
    // verification" requirement.
    const validation = await nibss.validateBvn(bvn);
    if (!validation.valid) {
      return res.status(400).json({ message: "BVN could not be verified" });
    }

    // Step 3: create the account (NIBSS auto pre-funds it with ₦15,000)
    const accountResult = await nibss.createAccount({
      kycType: "bvn",
      kycID: bvn,
      dob,
    });

    // Step 4: save the link between YOUR customer and this account
    await db.collection("accounts").add({
      customerId,
      accountNumber: accountResult.account.accountNumber,
      accountName: accountResult.account.accountName,
      bankCode: accountResult.account.bankCode,
      bvn,
      createdAt: new Date().toISOString(),
    });

    return res.status(201).json({
      message: "Customer onboarded and account created",
      account: accountResult.account,
    });
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({
      message: err.message || "Onboarding failed",
      details: err.data,
    });
  }
};
