// api/onboard-customer.js
const nibss = require("../lib/nibss");
const { db } = require("../lib/firebaseAdmin");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }
  const { customerId, firstName, lastName, dob, phone, bvn } = req.body || {};
  if (!customerId || !firstName || !lastName || !dob || !phone || !bvn) {
    return res.status(400).json({ message: "customerId, firstName, lastName, dob, phone, and bvn are all required" });
  }
  try {
    const existing = await db.collection("accounts").where("customerId", "==", customerId).limit(1).get();
    if (!existing.empty) {
      return res.status(409).json({ message: "This customer already has an account" });
    }
    try {
      await nibss.insertBvn({ bvn, firstName, lastName, dob, phone });
    } catch (insertErr) {
      return res.status(insertErr.status || 500).json({ message: "insertBvn failed", details: insertErr.data || insertErr.message });
    }
    // Small retry loop: the NIBSS sandbox can have a brief lag right
    // after inserting a BVN before validation reflects it.
    let validation = null;
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        validation = await nibss.validateBvn(bvn);
        if (validation.valid || validation.success) break;
      } catch (validateErr) {
        // retry on transient sandbox errors
      }
      if (attempt < maxAttempts) {
        await new Promise(function (resolve) { setTimeout(resolve, 1500); });
      }
    }
    if (!validation || !(validation.valid || validation.success)) {
      return res.status(400).json({ message: "BVN could not be verified" });
    }
    const accountResult = await nibss.createAccount({ kycType: "bvn", kycID: bvn, dob: dob });
    await db.collection("accounts").add({
      customerId: customerId, accountNumber: accountResult.account.accountNumber,
      accountName: accountResult.account.accountName, bankCode: accountResult.account.bankCode,
      bvn: bvn, createdAt: new Date().toISOString(),
    });
    return res.status(201).json({ message: "Customer onboarded and account created", account: accountResult.account });
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({ message: err.message || "Onboarding failed", details: err.data });
  }
};
