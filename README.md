# Digital Banking Backend — NibssByPhoenix Integration

A backend for the TS Academy assignment: customer onboarding, account
management, and core banking operations, integrated with the
NibssByPhoenix sandbox API. Built as Vercel serverless functions +
Firestore, so it deploys straight from a phone (GitHub → Vercel, no
local dev environment needed).

**Live**: `https://tsa-banking.vercel.app`
**Status**: All 6 endpoints built, deployed, and tested end-to-end.

## Why Firestore is here at all

NIBSS by Phoenix has no concept of "your app's customers" — it only
knows about accounts and transactions at the bank level. So this
backend keeps its own Firestore records that:
- link a `customerId` (your app's own user ID) to the NIBSS account
  number it owns
- log every transfer under the `customerId` that made it

That's what makes "a customer can only see their own transaction
history" and "account creation only after onboarding" actually true —
NIBSS alone can't guarantee either. This was verified directly: a
`customerId` with no transactions returns an empty list, and querying
another customer's account returns a 403.

## Endpoints

| Method | Path | Purpose | Status |
|---|---|---|---|
| POST | `/api/onboard-customer` | Register BVN, validate it, create account, link to customerId | ✅ tested |
| GET | `/api/name-enquiry/:accountNumber` | Resolve an account number to a name (no ownership check — needed to verify a recipient) | ✅ tested |
| POST | `/api/transfer` | Move money between accounts (checks sender owns `fromAccount`) | ✅ tested |
| GET | `/api/balance?customerId=&accountNumber=` | Check a balance (ownership-checked) | ✅ tested |
| GET | `/api/transaction-status?customerId=&transactionId=` | Query a transfer's status (ownership-checked) | ✅ tested |
| GET | `/api/transactions?customerId=` | List only this customer's transaction history | ✅ tested |

## Setup

1. **Create a Firebase project** (console.firebase.google.com). Enable Firestore.
2. **Generate a service account key**: Project Settings → Service
   Accounts → Generate new private key. Download the JSON.
3. **Push this folder to a GitHub repo.**
4. **Import the repo into Vercel.**
5. **Set environment variables** in Vercel project settings, using
   `.env.example` as the template:
   - `NIBSS_API_KEY`
   - `NIBSS_API_SECRET`
   - `FIREBASE_SERVICE_ACCOUNT` — the entire service account JSON,
     minified to one line
6. **Deploy.** Vercel auto-detects the `/api` folder as serverless functions.

## Known NIBSS sandbox quirks (found by testing, not documented)

The NibssByPhoenix docs don't fully match its live behavior. Two
mismatches were found and handled defensively in code rather than
assumed away:

- **`/api/validateBvn`** returns `{ success, message, data }`, not the
  documented `{ valid: true, ... }`. `onboard-customer.js` checks for
  either shape.
- **`/api/transfer`** returns the transaction ID under a `reference`
  field, not `transactionId` as documented, and may nest the real
  payload under a `data` key. `transfer.js` checks several likely
  field names rather than trusting one.
- Failed transfers can still return a normal HTTP success at the
  network level with the failure embedded in the body, or vice versa
  — code doesn't assume a 200 status means the documented shape came back.

## What's intentionally left simple

- **Auth**: `customerId` is passed directly by the caller rather than
  derived from a verified login token. In a production system you'd
  verify a Firebase Auth ID token server-side and use its `uid` as
  `customerId` instead of trusting the client. This is the main
  simplification worth calling out in a submission write-up.
- **Firestore security rules**: all writes go through serverless
  functions using the admin SDK, which bypasses rules — fine here,
  but rules would matter if Firestore were ever exposed to a frontend
  directly.
