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

### FIT Coach AI configuration

The FIT Coach calls the backend at `POST /api/coach`; the provider key is kept on the server and is never exposed to the browser. To enable live AI responses, add these environment variables to the backend hosting service:

- `OPENAI_API_KEY` — secret API key (required for live responses)
- `AI_MODEL` — optional model name; defaults to `gpt-4o-mini`
- `AI_BASE_URL` — optional OpenAI-compatible API base URL; defaults to `https://api.openai.com/v1`

The endpoint requires a signed-in user, limits questions to 1,200 characters, applies rate limiting and returns a safe unavailable message when the provider is not configured. API usage may incur provider charges. Do not put the API key in frontend environment variables or commit it to Git.

### Membership and payments

Membership is currently informational only. Checkout and premium activation are intentionally disabled while the core app is being completed. QR / UPI payment will be implemented later, after the fitness features and deployment are tested. No payment should be collected through the current app.

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
- Dashboard, workout library, exercise instructions and completion tracking
- Goal-based weekly training schedule, training frequency and rest timer
- Fitness profile with age, height, weight, target weight, equipment and experience settings
- Daily nutrition and protein logging, date-specific meal and hydration tracking, editable targets
- Hydration tracker, progress, challenges and discovery
- FIT Coach starter guidance
- Free and proposed Pro membership screens
- Account settings, fitness-data export and password-confirmed account deletion
- Privacy policy and terms starter pages
- Responsive layouts and installable PWA
- Android Capacitor build pipeline

## Not yet production-enabled

The FIT Coach requires a configured AI provider key. Membership checkout and payments are currently disabled by design and will be added later. An owner-operated admin review workflow, subscription entitlement enforcement across all premium features, ad network, trainer marketplace and payouts, push notifications, live health-device integrations, and app-store release signing still require additional implementation, review and secrets. Workout suggestions are general educational content, not individualized medical advice.

Before public launch, complete privacy policy/terms, account deletion and data export workflows, security review, database backups, monitoring, app-store assets and legal/payment compliance.
