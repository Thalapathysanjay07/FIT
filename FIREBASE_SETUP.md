# Firebase / Firestore setup for FIT

## Project region
Create the Firestore database in **Mumbai (asia-south1)**. Firestore location cannot be changed after creation.

## Security
- The repository's `firestore.rules` denies all direct browser/client reads and writes by default.
- The intended data path is the FIT Express backend using Firebase Admin SDK.
- Admin SDK access bypasses Firestore Security Rules. Protect the backend service account as a production secret.
- Never put service-account JSON, private keys, or Firebase Admin credentials in `VITE_*` variables, frontend source, Git, or screenshots.

## Backend connection (next setup step)
Create a Firebase service account in Firebase Console → Project settings → Service accounts → Generate new private key. Store the JSON securely as a backend hosting secret named `FIREBASE_SERVICE_ACCOUNT`; do not send the key in chat or commit it. The backend integration will be enabled only after the server-side Firebase Admin configuration is added and verified.

## Migration safety
FIT currently uses PostgreSQL for accounts, user data, payments, memberships, and activity. Creating Firestore does not migrate those records. Keep the existing PostgreSQL database configured until a verified export/import and endpoint cutover are complete. Do not delete the old database during migration.

## Deploy Firestore rules
From the repository root, after installing Firebase CLI and signing in:
```bash
firebase deploy --only firestore:rules
```
