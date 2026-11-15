# FIT — Fitness companion

Premium black + neon-green React/Vite fitness app with a Node/Express API.

## Frontend

```bash
npm install
npm run dev
npm run build
```

## Backend

Requires a PostgreSQL database (Neon, Supabase PostgreSQL, or another managed PostgreSQL provider).

```bash
cd backend
npm install
cp .env.example .env
# Fill DATABASE_URL, JWT_SECRET and CLIENT_ORIGIN in .env
npm run dev
```

The API creates its required `users` and `user_data` tables on startup. Passwords are hashed with bcrypt. Sessions use signed JWTs. User fitness logs are stored per account in PostgreSQL.

## Deployment

1. Create a managed PostgreSQL database and copy its connection string.
2. Deploy this repository to Render using the included `render.yaml` blueprint. Set `DATABASE_URL` to the database connection string and `CLIENT_ORIGIN` to the deployed Netlify site origin.
3. In `netlify.toml`, replace `REPLACE-WITH-FIT-API` with the actual Render service hostname.
4. Deploy the frontend to Netlify. The `/api/*` rewrite forwards authentication and data requests to the Render API.
5. Verify `https://YOUR-API-HOST/api/health` returns `{"status":"ok"}`, then register a test account and confirm sign-in and data sync.

Never commit real database URLs, passwords, JWT secrets, payment keys or provider credentials. Configure secrets in the hosting provider dashboard.

## Installable app and Android

The PWA manifest, icon and service worker enable installation from an HTTPS deployment. Android Chrome: menu → Install app. iPhone Safari: Share → Add to Home Screen.

Capacitor commands:

```bash
npm install
npm run android:add
npm run android:sync
npm run android:open
```

The GitHub Actions workflow **FIT Android APK** builds a debug APK and uploads it as a workflow artifact. Android Studio/SDK is required for local native builds. iOS packaging requires macOS and Xcode.

## Included features

- Account registration and sign-in
- Per-account cloud persistence for browser-local FIT tracking data
- Dashboard, workout library and completion tracking
- Nutrition and protein logging, editable daily targets
- Hydration tracker, progress, challenges and discovery
- FIT Coach starter guidance
- Free and proposed Pro membership screens
- Responsive layouts and installable PWA
- Android Capacitor build pipeline

## Not yet production-enabled

The FIT Coach is rule-based and is not connected to an external AI model. Payments, real subscription entitlements, ad network, trainer marketplace and payouts, push notifications, live health-device integrations, and app-store release signing still require provider accounts, implementation, review and secrets. The ₹199/month price is a proposal only; no payment is currently collected. Workout suggestions are general educational content, not individualized medical advice.

Before public launch, complete privacy policy/terms, account deletion and data export workflows, security review, database backups, monitoring, app-store assets and legal/payment compliance.
