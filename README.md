# Digital Banking Backend — NibssByPhoenix Integration

A backend for the TS Academy assignment: customer onboarding, account
management, and core banking operations, integrated with the
NibssByPhoenix sandbox API. Built as Vercel serverless functions +
Firestore, so it deploys straight from a phone (GitHub → Vercel, no
local dev environment needed) — same workflow as KLAVE.

## Why Firestore is here at all

NIBSS by Phoenix has no concept of "your app's customers" — it only
knows about accounts and transactions at the bank level. So this
backend keeps its own Firestore records that:
- link a `customerId` (your app's own user ID) to the NIBSS account
  number it owns
- log every transfer under the `customerId` that made it

That's what makes "a customer can only see their own transaction
history" and "account creation only after onboarding" actually true —
NIBSS alone can't guarantee either.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/onboard-customer` | Register BVN, validate it, create account, link to customerId |
| GET | `/api/name-enquiry?accountNumber=` | Resolve an account number to a name (no ownership check — needed to verify a recipient) |
| POST | `/api/transfer` | Move money between accounts (checks sender owns `fromAccount`) |
| GET | `/api/balance?customerId=&accountNumber=` | Check a balance (ownership-checked) |
| GET | `/api/transaction-status?customerId=&transactionId=` | Query a transfer's status (ownership-checked) |
| GET | `/api/transactions?customerId=` | List only this customer's transaction history |

## Setup

1. **Create a Firebase project** (console.firebase.google.com) if you
   don't want to reuse an existing one. Enable Firestore.
2. **Generate a service account key**: Project Settings → Service
   Accounts → Generate new private key. Download the JSON.
3. **Push this folder to a new GitHub repo** (same phone workflow you
   already use: download the files, upload to GitHub via the app or
   mobile web UI).
4. **Import the repo into Vercel.**
5. **Set environment variables** in Vercel project settings, using
   `.env.example` as the template:
   - `NIBSS_API_KEY`
   - `NIBSS_API_SECRET`
   - `FIREBASE_SERVICE_ACCOUNT` — paste the entire service account
     JSON as one line (minify it first — any JSON minifier website
     works on mobile)
6. **Deploy.** Vercel auto-detects the `/api` folder as serverless
   functions.

## Testing it (same way you tested the raw NIBSS API)

Use Hoppscotch again, but now point it at YOUR Vercel URL instead of
NIBSS directly:

```
POST https://your-project.vercel.app/api/onboard-customer
Body:
{
  "customerId": "test-user-1",
  "firstName": "Jane",
  "lastName": "Doe",
  "dob": "1998-03-12",
  "phone": "08011112222",
  "bvn": "22233344455"
}
```

Then:
```
GET https://your-project.vercel.app/api/transactions?customerId=test-user-1
```

should return an empty list until you run a transfer, at which point
it'll show up — but only for `test-user-1`, never for any other
customerId.

## What's intentionally left simple

- **Auth**: `customerId` is passed directly by the caller rather than
  derived from a verified login token. In a production system you'd
  verify a Firebase Auth ID token server-side and use its `uid` as
  `customerId` instead of trusting the client. Worth mentioning in
  your submission write-up as a known simplification.
- **Firestore security rules**: since all writes go through your
  serverless functions (using the admin SDK, which bypasses rules),
  you don't need custom Firestore rules for this to work — but lock
  down rules anyway if you ever expose Firestore directly to a
  frontend.
