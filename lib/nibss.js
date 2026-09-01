// lib/nibss.js
// Thin client around the NIBSS by Phoenix sandbox API.
// Handles login + JWT caching so every function doesn't have to
// re-authenticate on every call (token is valid for 1 hour).

const BASE_URL = "https://nibssbyphoenix.onrender.com";

// Module-level cache. On a "warm" serverless instance this persists
// between requests, saving a login call. On a cold start it's just null
// and we log in fresh. Either way, correctness never depends on this
// cache being warm.
let cachedToken = null;
let cachedTokenExpiry = 0; // unix ms

async function nibssFetch(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const err = new Error(data.message || `NIBSS request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

/**
 * Logs in with the fintech's API key/secret and returns a valid JWT,
 * reusing a cached one if it's not close to expiring.
 */
async function getToken() {
  const now = Date.now();

  // Refresh 2 minutes before actual expiry, to be safe.
  if (cachedToken && now < cachedTokenExpiry - 2 * 60 * 1000) {
    return cachedToken;
  }

  const apiKey = process.env.NIBSS_API_KEY;
  const apiSecret = process.env.NIBSS_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error("NIBSS_API_KEY / NIBSS_API_SECRET env vars are not set");
  }

  const data = await nibssFetch("/api/auth/token", {
    method: "POST",
    body: JSON.stringify({ apiKey, apiSecret }),
  });

  cachedToken = data.token;
  // Token is valid for 1 hour (3600s) per the docs — set expiry accordingly.
  cachedTokenExpiry = now + 60 * 60 * 1000;

  return cachedToken;
}

async function authedFetch(path, options = {}) {
  const token = await getToken();
  return nibssFetch(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
}

// ---- Identity ----

async function insertBvn({ bvn, firstName, lastName, dob, phone }) {
  return authedFetch("/api/insertBvn", {
    method: "POST",
    body: JSON.stringify({ bvn, firstName, lastName, dob, phone }),
  });
}

async function insertNin({ nin, firstName, lastName, dob }) {
  return authedFetch("/api/insertNin", {
    method: "POST",
    body: JSON.stringify({ nin, firstName, lastName, dob }),
  });
}

async function validateBvn(bvn) {
  return authedFetch("/api/validateBvn", {
    method: "POST",
    body: JSON.stringify({ bvn }),
  });
}

async function validateNin(nin) {
  return authedFetch("/api/validateNin", {
    method: "POST",
    body: JSON.stringify({ nin }),
  });
}

// ---- Accounts ----

async function createAccount({ kycType, kycID, dob }) {
  return authedFetch("/api/account/create", {
    method: "POST",
    body: JSON.stringify({ kycType, kycID, dob }),
  });
}

async function nameEnquiry(accountNumber) {
  return authedFetch(`/api/account/name-enquiry/${accountNumber}`, {
    method: "GET",
  });
}

async function getBalance(accountNumber) {
  return authedFetch(`/api/account/balance/${accountNumber}`, {
    method: "GET",
  });
}

// ---- Transactions ----

async function transfer({ from, to, amount }) {
  return authedFetch("/api/transfer", {
    method: "POST",
    body: JSON.stringify({ from, to, amount: String(amount) }),
  });
}

async function transactionStatus(transactionId) {
  return authedFetch(`/api/transaction/${transactionId}`, {
    method: "GET",
  });
}

module.exports = {
  insertBvn,
  insertNin,
  validateBvn,
  validateNin,
  createAccount,
  nameEnquiry,
  getBalance,
  transfer,
  transactionStatus,
};
