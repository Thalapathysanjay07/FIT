# FIT Firebase Spark setup

## Free-only architecture

FIT is being migrated to Firebase's **Spark (no-cost) plan**. Do not link a billing account or upgrade to Blaze.

- Firebase Authentication: email/password sign-in.
- Cloud Firestore: user-owned fitness data and app records.
- Firebase Cloud Messaging: client notification delivery where supported.
- Firebase Hosting is optional; Netlify can remain the frontend host.
- No Cloud Functions, paid serverless functions, or automatic payment verification.

Create the Firebase project and choose **Mumbai (asia-south1)** for Firestore before creating the database. Firestore location cannot be changed later.

## Web app configuration

Register a Web app in Firebase Console → Project settings → General → Your apps. Copy its public web configuration into the frontend hosting environment:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`

For local development, copy `.env.example` to `.env.local` and fill those values. These are Firebase web-app settings, not privileged credentials. Firebase API keys identify the project; Firestore Security Rules and Authentication must enforce access.

Never put service-account JSON, private keys, or Firebase Admin credentials in `VITE_*` variables, frontend source, Git, or screenshots.

## Spark plan limits and limitations

- Cloud Functions are not available on Spark.
- Phone/SMS authentication is not a free unlimited option; FIT should use email/password.
- Do not expose an AI provider API key in browser code. A secure AI proxy needs a trusted backend; without one, keep AI features local/rule-based or disable provider-backed AI.
- UPI payments can be submitted as pending requests, but client code cannot verify a bank transaction or safely grant Premium. Owner must verify the UTR independently and update the membership using a trusted owner-only process. Never let a user write their own Premium entitlement.
- FCM clients can receive messages when configured, but securely sending broadcasts/automated notifications requires trusted server infrastructure.
- Legacy PostgreSQL bcrypt passwords cannot simply be copied into Firebase Authentication. Existing users will need a planned account migration/password reset or a fresh Firebase sign-up.

## Current migration safety

The Express/PostgreSQL backend remains active during the migration. Existing accounts, payment requests, membership records, and some activity routes still depend on PostgreSQL. Do not remove `DATABASE_URL`, Render, or the old database until every route has been migrated and verified.

The repository currently has a Firebase Admin SDK integration for backend-only operations. That integration is separate from the Spark client SDK. A service-account private key is privileged and must never be placed in the browser.

## Deploy Firestore rules

After reviewing the rules for the collections being migrated, deploy from the repository root:
```bash
firebase deploy --only firestore:rules
```

Do not deploy permissive test rules. Rules must scope every user-owned document to the authenticated UID and must prevent clients from modifying membership entitlements or admin records.

## Firebase-authenticated API endpoints (staged)

The backend now exposes these Firebase ID-token-protected endpoints:

- `GET /api/firebase/me` — verifies the Firebase ID token and creates/reads a minimal `users/{uid}` profile.
- `GET /api/firebase/data` — reads the signed-in user's `userData/{uid}` document.
- `PUT /api/firebase/data` — writes only that user's bounded `fit-*` app data.
- `GET /api/firebase/health` — checks Admin SDK / Firestore connectivity.

Send the Firebase ID token as `Authorization: Bearer <ID_TOKEN>`. The server verifies token revocation and derives the UID from the verified token; never accept a UID supplied in the request body as the account identity.

**Important:** The current sign-in screen and several app features still use the legacy PostgreSQL/JWT endpoints. These new endpoints are an additive migration layer and do not mean the frontend has switched to Firebase yet. Do not remove the legacy database until AuthGate, membership, payments, activity, coach, and account deletion have all been migrated and tested.
