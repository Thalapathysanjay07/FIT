# FIT deployment and release checklist

## Architecture
- Frontend: React + Vite (repository root; build command `npm run build`; publish directory `dist`).
- Backend: Express API in `backend/` (Render blueprint in `render.yaml`).
- Database: PostgreSQL. The backend creates required tables at startup using `init()`.

## Frontend environment
Set `VITE_API_URL` to the public HTTPS URL of the deployed FIT API, without a trailing slash. Vite embeds this value at build time, so rebuild the frontend after changing it.

## Backend environment
Configure these variables in the backend hosting dashboard. Never commit real values:
- `DATABASE_URL`: PostgreSQL connection string.
- `DATABASE_SSL=true`: enable TLS where required by the database provider.
- `JWT_SECRET`: random secret with at least 32 characters.
- `CLIENT_ORIGIN`: exact HTTPS frontend origin in production; multiple origins may be comma-separated. Wildcard origins are rejected.
- `OPENAI_API_KEY`: optional until AI Coach is enabled.
- `AI_MODEL`: defaults to `gpt-4o-mini`.
- `FIT_UPI_ID`: merchant UPI ID for QR/payment configuration.
- `FIT_MERCHANT_NAME`: merchant display name.
- `FIT_ADMIN_KEY`: random admin key with at least 24 characters.

See `backend/.env.example` for a local template. Never put backend secrets in frontend variables or Vite code.

## Release verification
1. Confirm backend `/api/health` returns `{"status":"ok"}`. Production startup now rejects missing/weak JWT secrets and invalid or wildcard frontend origins.
2. Confirm the frontend build uses the correct `VITE_API_URL`.
3. Register a disposable test account and verify login and `/api/auth/me`.
4. Verify a free account receives `tier: "free"` from `/api/membership/access`.
5. In a controlled test setup, submit a test UPI reference, approve it through the protected admin endpoint, and confirm quarterly membership expiry is 90 days after activation.
6. Verify premium AI modes are rejected for free users and only allowed with an active membership.
7. Verify activity save/read, workout logging, optional leaderboard opt-in/out, and notification read status.
8. Test Android separately on a supported real device; browser testing cannot verify Health Connect or pedometer permissions.

## Important
- FIT Pro is a manually reviewed UPI/QR process, not an automatic payment gateway.
- Green CI confirms compilation and backend syntax only. It does not prove production credentials, database connectivity, payment verification, AI provider access, or Android sensor behavior.
- Use test accounts and test UTRs. Do not use real customer payments during deployment verification.
