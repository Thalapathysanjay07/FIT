# FIT PostgreSQL → Firestore migration

## Current status
FIT's Express API still uses PostgreSQL for authentication, account deletion, user data, UPI payment requests, membership entitlements, activity days, and notifications. Firebase Admin SDK is configured as a separate connection; this is not yet a completed backend cutover.

## One-time data copy
A guarded migration utility is available at `backend/scripts/migrate-to-firestore.js`. It copies the current tables to Firestore collections:
- `users/{legacyId}`
- `userData/{legacyUserId}`
- `paymentRequests/{legacyPaymentId}`
- `memberships/{legacyUserId}`
- `activityDays/{legacyUserId}_{activityDate}`
- `activityNotifications/{legacyNotificationId}`

The default mode is **dry run** and performs no Firestore writes. The script preserves legacy numeric IDs as strings and copies password hashes only into the server-protected Firestore collection. Firestore client rules deny all direct reads and writes.

### Run a dry run
From `backend/`:
```bash
npm install
FIREBASE_MIGRATION_DRY_RUN=true npm run migrate:firestore
```

Required private backend environment variables:
- `DATABASE_URL`
- `DATABASE_SSL=true` when required by the PostgreSQL provider
- `FIREBASE_SERVICE_ACCOUNT` (complete service-account JSON string)
- optional `FIREBASE_PROJECT_ID`

### Run the initial copy only after reviewing the dry-run output
```bash
FIREBASE_MIGRATION_DRY_RUN=false npm run migrate:firestore
```

The script is an initial-copy tool, not a live dual-write or continuous sync. Do not run it while users are actively changing data unless you plan a maintenance window and a final delta copy. Re-running a collection copy overwrites matching documents, so make a verified backup first.

## What is still required before PostgreSQL can be removed
1. Convert each Express route to Firestore reads/writes, including login/register, account deletion, user data, UPI payment review, membership checks, activity, leaderboard, and notifications.
2. Keep subscription activation and payment review server-only; never allow clients to grant Premium.
3. Add transactional/unique-UTR handling and validate Firestore indexes for leaderboard queries.
4. Test against a disposable Firebase project and a copied database.
5. Cut over the frontend/backend, verify every route and existing account, then take a final backup.
6. Remove PostgreSQL only after successful production verification.

**Do not delete the PostgreSQL database or remove DATABASE_URL yet.**
