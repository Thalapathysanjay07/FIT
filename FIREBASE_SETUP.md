# FIT Firebase Spark setup

## Free-only architecture

FIT is being migrated to Firebase's **Spark (no-cost) plan**. Do not link a billing account or upgrade to Blaze.

- Firebase Authentication: email/password sign-in.
- Cloud Firestore: user-owned fitness data and app records.
- Firebase Cloud Messaging: client notification delivery where supported.
- Firebase Hosting is optional; Netlify can remain the frontend host.
- No Cloud Functions, paid serverless functions, or automatic payment verification.

Create the Firebase project and choose **Mumbai (asia-south1)** for Firestore before creating the database. Firestore location cannot be changed later.

## Create and configure the Firebase project

1. In Firebase Console, create the FIT project (or select the existing FIT project).
2. Under Build → Authentication → Get started, enable **Email/Password**.
3. Under Build → Firestore Database, create the production database in **Mumbai (asia-south1)**. Choose production mode.
4. Under Authentication → Settings → Authorized domains, add the exact deployed FIT Netlify domain and any custom FIT domain.
5. Register a Web app under Project settings → General → Your apps.

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

The Firebase-mode frontend uses the Firebase Web SDK directly. The legacy Express backend and its Firebase Admin SDK integration remain in the repository only for backward compatibility; Firebase-mode sign-in, app data, activity, and payment submission do not require that backend. A service-account private key is privileged and must never be placed in the browser.

## Deploy Firestore rules and indexes

The repository `firebase.json` configures both `firestore.rules` and `firestore.indexes.json`. After creating the production Firestore database and reviewing the rules, deploy both from the repository root:
```bash
firebase deploy --only firestore
```

This deploy publishes the security rules and the composite index required by the seven-day activity leaderboard. Index creation can take several minutes; wait until the index status is **Enabled** in Firebase Console before testing that query. Do not deploy permissive test rules. Rules must scope every user-owned document to the authenticated UID and must prevent clients from modifying membership entitlements or admin records.

## Firebase-mode application

The entry point selects `src/FirebaseAuthGate.jsx` when `VITE_USE_FIREBASE_AUTH=true`. Firebase mode uses Firebase Authentication and Firestore directly for sign-in, profile/data sync, activity, leaderboard, notifications, membership reads, payment-request submission, and account deletion. The legacy Express/PostgreSQL path remains available only when the flag is false.

Do not switch the production host to Firebase mode until you have created the Firebase project, enabled Email/Password, created Firestore, deployed the rules, and set all required frontend environment variables. After that configuration is saved, redeploy the frontend and test registration, login, data sync, payment submission, and deletion with a test account.

## Current Firebase-first frontend implementation

The frontend migration now includes:

- Firebase email/password registration, sign-in, password reset and session persistence.
- Per-user Firestore profile and fitness-state documents.
- Direct Firestore sync for walking steps, workout counts, leaderboard opt-in and activity notifications.
- Direct Firestore UPI payment-request submission and membership reads.
- Firebase-mode account deletion with recent-login reauthentication and deletion of the user's own records.
- On-device FIT Coach templates in Firebase mode. This is not generative AI and does not call a paid AI provider.
- Manual owner verification for payments. The owner updates `paymentRequests/{UTR}` and `memberships/{uid}` in the Firebase Console; clients cannot grant Premium.

### Frontend environment variables

Set these in Netlify (or `.env.local` for local development):

- All five `VITE_FIREBASE_*` Web App values listed above.
- `VITE_USE_FIREBASE_AUTH=true`
- `VITE_FIT_UPI_ID` — public merchant UPI ID used to build the payment QR.
- `VITE_FIT_MERCHANT_NAME` — merchant display name.

The UPI ID is public payment-routing information, not an API secret. Never put bank passwords, UPI PINs, OTPs, or private keys in these variables.

### Owner payment review in Spark mode

There is no privileged payment-review API in the Spark-only architecture. In the Firebase Console, verify each UTR independently, then update the payment request status. For approved requests, set `memberships/{uid}` with:

- `userId`: the request's userId
- `planCode`: `quarterly`
- `startsAt`: ISO timestamp
- `expiresAt`: ISO timestamp 90 days after startsAt
- `paymentRequestId`: the UTR document ID

Do not expose Firebase Console owner credentials or grant project-owner roles to ordinary users.

### Important remaining boundaries

- Existing PostgreSQL accounts are not automatically migrated to Firebase Authentication. Users must create Firebase accounts; legacy password hashes cannot be imported as Firebase passwords. Historical PostgreSQL records need a verified UID-linking migration before old accounts/data can be safely imported.
- FIT Coach in Firebase mode uses local templates. Real generative AI needs a separately secured provider service; do not put provider API keys in the browser.
- Health Connect / phone sensors require a compatible installed Android app and device permissions; a browser cannot read phone pedometer hardware directly.
- Firebase Cloud Messaging receiving can be added on supported clients, but automated sending and scheduled campaigns need trusted server infrastructure.
- The legacy Express/PostgreSQL backend remains in the repository for backward compatibility. The Firebase-mode frontend paths are designed not to call it for sign-in, app data, activity, payments, coach, or account deletion. Do not delete the old backend/database until a real deployment test and legacy-data export are complete.
