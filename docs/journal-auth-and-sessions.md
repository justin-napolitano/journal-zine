# Auth & Session Handling

The journal keeps authentication intentionally simple: a single shared password gates write access, enforced by an HTTP-only cookie. This page spells out the control flow plus every variable that influences it.

## Actors & cookies

- **Actors**
  - *Anonymous reader*: can hit `/` and the posts API anonymously but cannot create/import.
  - *Admin*: knows `ADMIN_PASSWORD` and can post, run syncs, or trigger cron endpoints.
- **Cookie**: `journal_session`
  - Set by `/api/login` after a successful password exchange.
  - Cleared by `/api/logout` or when it expires (30 days `maxAge`).
  - Stored as `"1"` locally for convenience, or `ADMIN_SESSION_SECRET` in production.

## Login flow

1. The client-side login page (`src/app/login/page.tsx`) posts `{ password }` to `/api/login`.
2. The route handler verifies preconditions:
   - `ADMIN_PASSWORD` **must** be set or the route 500s.
   - If `NODE_ENV === 'production'`, `ADMIN_SESSION_SECRET` must be set.
3. On password mismatch → `401 { error: "Invalid password" }`.
4. On success:
   - Respond with `{ ok: true }`.
   - Attach the `journal_session` cookie with attributes:
     - `httpOnly: true`
     - `secure: NODE_ENV === 'production'`
     - `sameSite: 'lax'`
     - `path: '/'`
     - `maxAge: 30 days`

## Authorization checks everywhere else

Use `isRequestAuthed()` (`src/lib/auth.ts`) from within server components or API routes. It:

1. Reads the cookie via `next/headers` (server-only API).
2. Accepts a legacy `"1"` value only while `NODE_ENV !== 'production'` for easier curl/testing.
3. If `ADMIN_SESSION_SECRET` is unset:
   - Development: treat as unauthenticated (matches historical behavior where auth was optional).
   - Production: fail closed so we are not accidentally wide-open.
4. Compares the cookie to the known secret; returns `true | false`.

Routes that rely on it today:

| Route | Purpose |
| --- | --- |
| `POST /api/posts` | Rejects unauthenticated write attempts.
| `GET|POST /api/mastodon-sync` | Prevents random mirrors from being triggered.
| Any future private endpoint | Import `isRequestAuthed` the same way.

## Logging out

- `<JournalApp>` shows a “log out” button when `isAuthed` is true.
- Clicking it calls `POST /api/logout`, which overwrites `journal_session` with an empty value + `maxAge: 0`.
- The client then pushes to `/login` and refreshes to purge any cached session state.

## Environment variable matrix

| Variable | Required? | Description |
| --- | --- | --- |
| `ADMIN_PASSWORD` | **Yes** | Shared secret the login form compares against.
| `ADMIN_SESSION_SECRET` | Required in production | Acts as the canonical cookie value. Set to the same string across servers.
| `NODE_ENV` | Auto-set by Next | Controls whether the fallback `"1"` cookie is honored and whether cookies use the `secure` flag.

## Extending the model

- To add multiple users, replace the shared secret with a database-backed user table and issue signed JWTs or NextAuth sessions.
- To add rolling sessions, rotate the cookie value when the password changes or on every login.
- To guard cron-style endpoints shared with outside automation (Zapier, etc.), prefer the `CRON_SECRET` query guard already supported by the integration routes.

Keep this doc handy when you need to debug “why can’t I post?”—nine times out of ten it is an unset env var or a stale cookie value.
