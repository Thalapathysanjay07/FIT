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

FIT Pro pricing is ₹49 per month and ₹499 per year. The membership page generates a dynamic UPI QR code and also opens a UPI payment intent. Users submit the UTR; an owner manually verifies it in the Admin page before activation. The backend validates active subscription dates on every Premium AI request. Re-approving an existing active membership extends from its current expiry instead of discarding remaining days.

Configure FIT_UPI_ID, FIT_MERCHANT_NAME and a private FIT_ADMIN_KEY (at least 24 characters) on the backend. QR generation requires a valid merchant UPI ID. UTR submission is not automatic bank verification; the owner must verify the payment in the merchant's bank/UPI app before approval. Never share the admin key with customers.

### Premium access and AI

Free accounts can use general FIT Coach chat and standard tracking. FIT Pro is required server-side for personalised AI diet plans, goal-based AI workout plans and AI weekly reports. The backend requires OPENAI_API_KEY; AI_MODEL and AI_BASE_URL are optional. AI-generated nutrition and training suggestions are educational estimates, not medical advice.

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
- Goal-based weekly training schedule, equipment-aware exercise substitutions, training frequency and rest timer
- Fitness profile with age, height, weight, target weight, equipment and experience settings
- Daily nutrition and protein logging, date-specific meal and hydration tracking, editable targets and vegetarian / mixed / vegan sample meal planner
- Hydration tracker, progress, challenges and discovery
- FIT Coach free chat plus server-gated Pro diet, workout and weekly-report modes
- Free and FIT Pro membership with ₹49 monthly / ₹499 yearly pricing
- Dynamic UPI QR and UPI intent checkout with manual owner verification and payment status history
- Server-verified membership start/expiry checks and secure admin payment review
- Account settings, fitness-data export and password-confirmed account deletion
- Privacy policy and terms starter pages
- Responsive layouts and installable PWA
- Android Capacitor build pipeline

## Remaining launch requirements

The app includes manual UPI QR/intent checkout and owner-operated payment review, but does not automatically verify bank transactions. AI features require a configured provider key and can incur usage costs. The Android workflow creates a debug APK only; Play Store release signing, store listing assets and release compliance are not included. Push notifications, trainer marketplace/payouts, and ad network are not implemented. Health Connect and phone step sensors require testing on supported physical devices; web preview cannot provide native sensor access. Privacy policy and terms are starter templates and must be completed with the operator's legal identity, contact details, actual providers and applicable law before public launch.

Before public launch, complete privacy policy/terms, account deletion and data export workflows, security review, database backups, monitoring, app-store assets and legal/payment compliance.
