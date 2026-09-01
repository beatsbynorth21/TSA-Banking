// api/name-enquiry.js
// GET /api/name-enquiry?accountNumber=1234567890
//
// No ownership check here on purpose — a customer needs to be able to
// look up the NAME on an account they don't own, to confirm the
// recipient before sending money.

const nibss = require("../lib/nibss");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { accountNumber } = req.query;
  if (!accountNumber) {
    return res.status(400).json({ message: "accountNumber query param is required" });
  }

  try {
    const result = await nibss.nameEnquiry(accountNumber);
    return res.status(200).json(result);
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({
      message: err.message || "Name enquiry failed",
      details: err.data,
    });
  }
};
