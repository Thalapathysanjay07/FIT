# FIT — Fitness companion

FIT is a React + Vite fitness app with Firebase Authentication / Firestore mode and a legacy Express + PostgreSQL mode.

## Frontend

```bash
npm install
npm run dev
npm run build
```

## Firebase Spark mode (recommended current migration path)

Set `VITE_USE_FIREBASE_AUTH=true` and configure the Firebase Web App variables listed in [Firebase Spark setup](docs/FIREBASE_SPARK_SETUP.md). Enable Email/Password and Google providers, add deployed hostnames to Firebase Authorized domains, create Firestore, and publish `firestore.rules`.

Firebase mode uses Firebase Authentication for accounts and Firestore for user profile, app-state snapshot, activity, payment requests and membership records. The app stores some UI state in localStorage and syncs the `fit-*` keys to the signed-in user's Firestore document.

The Spark-compatible UPI flow is manual: ₹49 / 30 days or ₹499 / 365 days. A user submits a UTR as a pending Firestore request. The owner verifies the actual bank/UPI transaction and updates payment/membership documents in Firebase Console. Client code cannot grant Premium.

**Spark limitations:** no Cloud Functions are used. Payment approval is manual; there are no trusted scheduled jobs; Firebase-mode FIT Coach uses on-device guidance rather than hosted generative AI; browser notifications are not a complete push service. Read the setup guide before deployment.

## Legacy backend mode

When `VITE_USE_FIREBASE_AUTH` is not `true`, the app uses the legacy Express API. That backend currently requires PostgreSQL and uses `DATABASE_URL`, `JWT_SECRET`, and `CLIENT_ORIGIN`. Optional AI API credentials belong only in the backend environment, never in frontend variables.

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Do not assume PostgreSQL has been removed: several legacy routes, including the server AI and legacy payment review flows, still depend on it.

## Deployment

The frontend is configured for Netlify through `netlify.toml`. The current API rewrite contains a placeholder hostname for the legacy backend; replace it only if deploying that backend. Firebase Spark frontend mode can use direct Firebase client services for its supported features and does not require that legacy API rewrite for basic sign-in and Firestore sync.

Never commit real database URLs, passwords, service-account files, JWT secrets, admin keys or AI provider credentials.

## Android / PWA

The project includes PWA assets and Capacitor Android dependencies.

```bash
npm install
npm run android:add
npm run android:sync
npm run android:open
```

Native step sensors and Health Connect require testing on supported physical Android devices. A web preview cannot validate native sensor integration. Play Store signing and release compliance remain separate launch tasks.

## Quality checks

```bash
npm run build
npm run test:firestore
```

The GitHub Actions workflow runs a production build and Firestore rules emulator tests. A workflow being committed does not mean the checks have passed; inspect the Actions run results.

## Features and launch requirements

The codebase includes dashboard, workouts, exercise library, nutrition and meal logging, progress, challenges, walking tracker, activity/rewards, membership UI, account settings, export and deletion flows, and FIT Coach modes.

Before public launch, verify Firebase providers/domains, Firestore rules tests, Android sensor behavior, backup/recovery, monitoring, privacy policy and terms, support contact details, payment compliance, and account deletion/export.