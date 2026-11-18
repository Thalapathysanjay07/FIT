# FIT Firebase Spark setup

This guide configures the Firebase-authenticated app mode. It does not claim that every optional service is Firebase-only.

## 1. Create the Firebase project

1. Create a Firebase project and register a Web App.
2. In Authentication, enable Email/Password and Google sign-in.
3. Add every deployed web hostname to Authentication → Settings → Authorized domains.
4. Create the Cloud Firestore database.
5. Publish the repository's `firestore.rules` rules.

## 2. Frontend environment

Set these variables in the local `.env` file or the frontend hosting provider's environment settings. Restart/redeploy after changing them.

```dotenv
VITE_USE_FIREBASE_AUTH=true
VITE_FIREBASE_API_KEY=your_firebase_web_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_APP_ID=your_firebase_web_app_id
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIT_UPI_ID=merchant@upi
VITE_FIT_MERCHANT_NAME=FIT
```

The Firebase Web App configuration is public client configuration, not an Admin SDK credential. Never put a service-account JSON, private key, admin key, or payment-provider secret in a `VITE_*` variable.

## 3. Data and security model

- Firebase Authentication handles email/password and Google sign-in.
- New users must verify their email before entering the app.
- Firestore stores the user profile, app-state snapshot, activity days, payment requests and memberships.
- Firestore rules restrict profile and activity writes to the signed-in owner. Clients cannot approve payments or grant Premium.
- The activity leaderboard is opt-in through the activity document's `leaderboardOptIn` field.
- FIT stores some live UI state in browser localStorage and syncs the `fit-*` keys to the signed-in user's `userData/{uid}` document. Account hydration restores this snapshot on sign-in.

## 4. Manual UPI membership in Spark mode

The published plans are ₹49 for 30 days and ₹499 for 365 days. The app creates a pending `paymentRequests/{UTR}` document. The owner must verify the transaction independently in the merchant bank/UPI app, then update the request status and create/update `memberships/{uid}` in the Firebase Console.

The browser is intentionally unable to approve a payment or write a membership entitlement. Do not approve based on a screenshot or UTR alone. Do not give customers project-owner access.

## 5. Spark plan limitations

This configuration does not use Cloud Functions. As a result:

- Payment review and membership activation are manual.
- There is no trusted server-side scheduled job for expiry notifications or streak rewards.
- The Firebase-mode FIT Coach currently provides on-device guidance, not a hosted generative AI service.
- Browser notifications are not equivalent to a complete push-notification service.
- Firestore rules and real-device sensor behavior still require emulator/device testing.

A trusted backend or paid/server-side compute may be needed for automatic payment verification, privileged entitlement changes, scheduled jobs, server AI, and production push delivery. Never bypass Firestore rules to imitate these services.

## 6. Verification checklist

- [ ] Email/password registration and email verification
- [ ] Google sign-in on each deployed authorized domain
- [ ] Sign-out and sign-in restore the same user's data
- [ ] Firestore rules emulator tests pass
- [ ] Another account cannot read or write private user data
- [ ] A client cannot approve payment or grant Premium
- [ ] Manual owner approval grants only the intended plan dates
- [ ] Account export and deletion work for the signed-in account
- [ ] Walking sensor and Health Connect behavior tested on supported Android devices
- [ ] Production build and deployed app tested on mobile and desktop
