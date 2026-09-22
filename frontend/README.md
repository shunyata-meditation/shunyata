# Shunyata frontend

A small meditation journal built with TanStack Start, Router, Query, React, TypeScript, and Tailwind. Warm paper, muted sage, and quiet typography keep the focus on your practice.

## Run locally

Use Node.js 22.12+ (or a newer supported LTS release) and npm. From this directory:

```bash
npm ci
cp .env.example .env
openssl rand -base64 32
```

Paste the generated value into `SESSION_SECRET` in `.env`, then run:

```bash
npm run dev
```

Open <http://localhost:3000>. If `.env` already exists, preserve it instead of copying over it.

| Variable          | Purpose                                                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `BACKEND_API_URL` | Server-side Django API base URL, including `/api`; defaults to `http://127.0.0.1:8000/api`.                                   |
| `SESSION_SECRET`  | Required secret of at least 32 characters for encrypting the authentication cookie. Use a separate value in each environment. |

Start Django using the instructions in [the backend README](../backend/README.md). Set Django's `FRONTEND_URL` to the frontend origin, usually `http://localhost:3000`. For development verification emails, use Django's console email backend. Apply the existing Django migrations to populate meditation types; types can also be managed through Django admin.

The browser talks to TanStack Start on its own origin. Start calls Django server-to-server, so this frontend does not require a browser CORS exception. Keep backend and session configuration server-only; do not prefix secrets with `VITE_`.

## Features

- Register with a username, email, password, and confirmation; verify email before signing in.
- Recover a password by email, resend expired verification links, and review account details from a minimal profile.
- Follow the backend's existing `/api/auth/verify-email/<token>` link. Opening or prefetching the page does not consume the token; the verification button does.
- Sign in with a username and password, maintain access through JWT refresh, and sign out.
- Begin a countdown with pause/resume, an optional gentle completion bell, and review-before-save.
- Log a session manually with its meditation type, start time, duration, completion status, and optional reflection.
- Review your own sessions grouped by local date, newest first; edit entries or delete them after confirmation.
- Use the journal on mobile or desktop, with keyboard navigation, accessible form errors, and loading/empty/error states.

Dates are entered and displayed in the browser's local timezone. The frontend sends ISO timestamps to Django and preserves duration precision when editing. Manual entries derive their end time from start plus duration. Timer entries keep their real finish time and active duration separately, excluding pauses. Editing only notes, type, or completion status preserves that finish time; editing start or duration recalculates it. Durations must be positive and no longer than one year. History currently uses the backend's unpaginated list.

## Meditation timer

Open **Timer** or **Begin a session**, choose a meditation type, then select a preset or enter 1–180 whole minutes. The default is 10 minutes with a gentle completion bell enabled. Start when ready; pause/resume or finish early at any time.

At the end, add an optional reflection and save or discard the session. Natural completion is marked completed; finishing early is unfinished. Sessions shorter than one second cannot be saved. Saving never retries automatically; errors keep the review and reflection available. If a connection drops while saving, check your journal before retrying because the server may have received the first request.

The timer continues across app navigation, with a return indicator in the journal. A validated snapshot in `sessionStorage` restores the timer and reflection after refreshing the same tab. Pauses remain paused; overdue countdowns restore directly to review, using their calculated finish time rather than the time you returned. Snapshots are bound to an opaque login scope and discarded when signing out or changing login sessions. No JWTs are stored in browser storage. If storage is blocked, the app explains that it can only retain the timer in memory.

The completion bell is one synthesized, quiet tone, with a mute control. After refreshing, your browser may require you to click **Enable bell**. A missed bell is not replayed for an already completed session. Sound is optional and cannot prevent saving. Browser or device suspension may delay audio and UI updates; this is not a reliable background alarm. Cross-tab/device synchronization and recovery after signing out are not supported.

## Architecture

File-based routes and a protected layout live in `src/routes`. `src/server/functions.ts` provides the typed server-function boundary; Django remains the authority for account and record permissions. `src/server/transport.ts` normalizes API errors and retries an unauthorized request once after refreshing the access token. Network failures do not automatically repeat writes.

JWTs live in an encrypted HTTP-only, SameSite=Lax cookie, marked Secure in production. They are not exposed in localStorage or page hydration. Start CSRF middleware protects server-function requests. Private responses are not publicly cacheable. The local cookie lasts up to one day; Django still enforces token expiry. Signing out clears the local cookie and query cache; the backend currently has no token revocation endpoint.

TanStack Query uses a separate QueryClient for each router/server request, preloads through route loaders, and invalidates journal data after successful mutations. Browser-local date rendering waits for hydration to avoid server timezone mismatches. Validation uses Zod at the server-function boundary.

## Checks

```bash
npm run typecheck
npm test
npx playwright install chromium --only-shell
npm run test:e2e
npm run format:check
npm run build
```

Unit tests cover duration and timestamp handling, timer state and recovery, optional audio, validation, error mapping, and token refresh/expiry. Browser tests start a deterministic Django-contract fixture on port 8100 and the frontend on port 3100; those ports must be free. They cover account flows, journal CRUD, session isolation, failure states, mobile layouts, and clock-controlled timer completion, recovery, pause/resume, and saving. No real accounts or emails are used. Screenshots and failure traces are written under the ignored `test-results/` directory.

`npm run format` formats the frontend; generated routes and build/test artifacts are excluded.

## Production

```bash
npm run build
node .output/server/index.mjs
```

Deploy the full `.output/` directory to a Node-compatible server. Set `BACKEND_API_URL` and `SESSION_SECRET` in its environment, configure Django's `FRONTEND_URL` to the public frontend origin, and serve the frontend over HTTPS so Secure cookies work. Keep the same secret across frontend instances. Do not publicly cache authenticated pages or server-function responses. This is a server-rendered app, not a static-only deployment.

### Docker

Build and run the production image from the repository root:

```bash
docker build -t shunyata-frontend ./frontend
docker run --rm -p 3000:3000 \
  -e BACKEND_API_URL=http://backend:8000/api \
  -e SESSION_SECRET='<at-least-32-characters>' \
  shunyata-frontend
```

`BACKEND_API_URL` and `SESSION_SECRET` are runtime-only settings. The image runs the Nitro server on port `3000` as a non-root user.

## Pending features

- [x] Countdown timer, pause/resume, and optional completion bell.
- [x] Progress charts, streaks, and goals.
- [x] Password reset and verification-email resend.
- [x] Minimal profile and password change.
- [ ] Open-ended stopwatch mode and interval bells.
- [ ] Server-side logout/token revocation (backend support needed).
- [ ] Reminders and notification preferences.
- [ ] Offline/PWA support and data export.
- [ ] Dark theme and localization.
