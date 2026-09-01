// lib/firebaseAdmin.js
// Initializes Firebase Admin once per warm serverless instance and
// exports a Firestore handle used by every endpoint for storing
// your OWN customer/account/transaction records (this is what gives
// you per-customer transaction history and data isolation, since
// NIBSS itself doesn't provide that).

const admin = require("firebase-admin");

if (!admin.apps.length) {
  // FIREBASE_SERVICE_ACCOUNT should be the full service account JSON,
  // stored as a single-line string in your Vercel env vars.
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

module.exports = { admin, db };
