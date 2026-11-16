# SCIVILL: Vercel full-stack migration (preview)

This folder is an **isolated proof of concept**, not the live production site. Current GitHub Pages/D1 data remain unchanged.

## Architecture
- Next.js on Vercel hosts the UI and server-side API.
- Firebase Authentication supplies verified Google identity tokens.
- Server verifies JWT signature, issuer, audience and expiry.
- Only invitation allowlisted users or the pre-configured, verified admin email can gain member access.
- PostgreSQL is accessible only via server-side DATABASE_URL.
- Server validates team creation, applications, approvals and permissions.
- The existing daily competition pipeline still targets the legacy D1 server, **not** this Postgres database.

## Deploy checklist
1. Create a managed PostgreSQL database. Run db/schema.sql with a migration account and use least-privilege server credentials for the app.
2. In Vercel import hsjun519/SCIVILL, set Root Directory to `vercel-app`, and preview-deploy the migration branch only.
3. Enable Google login in Firebase and allow the intended Vercel domain.
4. Configure Vercel environment variables from .env.example. Never put DATABASE_URL or other secrets into NEXT_PUBLIC_ variables or the repository.
5. Set ADMIN_EMAIL to the verified, owner-controlled Google account. Insert invite emails and member roles into invitations (private database, not JavaScript).
6. Test 401 unauthenticated, 403 uninvited, 403 non-owner decisions, successful owner approval and transactional capacity limits.
7. Add request rate limiting, sign-in abuse controls and automated security tests before any real users are invited.
8. Back up and migrate existing verified competitions and collaboration data. Do not import plain-text PINs; retire the old PIN authentication.
9. Redirect the daily collector to the new database through authenticated server API; until then the new competition table will be empty.
10. Perform independent build, integration and deployment checks before switching the live URL.

## Known limitations
- This code is not yet deployed, and no Vercel project or database has been connected.
- Production security hardening, rate limiting, full data migration, final UI/UX parity, and daily collector integration are incomplete.
- A separate legacy index.html in the repository still contains plaintext 4-digit PIN authentication and a publicly embedded roster. It should be retired or secured before production launch.
- Public Firebase client configuration is not a secret. Database credentials must remain server-only.
