# Dev, Ops & Maintenance Notes

Everything you need to run the journal locally, keep the schema in shape, and operate the integration endpoints.

## Local setup checklist

1. **Install deps**
   ```bash
   npm install
   ```
2. **Database**: provision a Vercel Postgres database (or any Postgres URL compatible with `@vercel/postgres`). Set `DATABASE_URL` in `.env.local`.
3. **Env vars**: copy `.env.example` (if you create one) or populate `.env.local` manually. Minimum set for local posting:
   - `ADMIN_PASSWORD`
   - `ADMIN_SESSION_SECRET` (so `isRequestAuthed` can succeed even in dev)
4. **Run migrations**
   ```bash
   npm run migrate
   ```
   - `scripts/migrate.mjs` keeps an internal `schema_migrations` table. Each object in the `migrations` array has a `name` to enforce idempotency.
5. **Start Next dev server**
   ```bash
   npm run dev
   ```

## Available npm scripts

| Script | Command | Notes |
| --- | --- | --- |
| `dev` | `next dev` | Starts the local Next server with hot reload.
| `build` | `next build` | Production build; uses App Router conventions.
| `start` | `next start` | Run the compiled build.
| `lint` | `eslint` | Uses `eslint.config.mjs` and Next's recommended rules.
| `migrate` | `node scripts/migrate.mjs` | Replays pending migrations against the configured Postgres instance.

## Integration endpoints & testing

Cron-friendly HTTP routes live under `/api/integrations`. Guard them in production by setting `CRON_SECRET` and appending `?key=YOUR_SECRET` to every request.

| Endpoint | Description | Key env vars |
| --- | --- | --- |
| `/api/mastodon-sync` | Mirrors your Mastodon account into the journal (requires login cookie and Mastodon creds). | `MASTODON_*`, `ADMIN_*`, optional `CRON_SECRET`
| `/api/integrations/spotify-sync` | Posts a "listening log" snapshot; accepts `timeRange`, `artists`, `tracks`. | `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REFRESH_TOKEN`, optional `SPOTIFY_SYNC_ENABLE_{MASTODON,BLUESKY}`
| `/api/integrations/github-sync` | Inserts one post per merged PR within `windowDays`. | `GITHUB_TOKEN`, `GITHUB_OWNER?`, `GITHUB_SYNC_ENABLE_*`
| `/api/integrations/github-weekly-sync` | Inserts one summarized post for all merged PRs in the window. | Same as above

Use `scripts/test-integrations.sh` to hit the endpoints locally:

```bash
# optional: TEST_INTEGRATIONS_ENV_FILE=.env.integrations npm run dev &
./scripts/test-integrations.sh
```

The script loads `.env.local`, `.env`, and any file pointed to by `TEST_INTEGRATIONS_ENV_FILE`, builds query strings with `CRON_SECRET`, and curls each endpoint in sequence.

## Character limits & cross-post safety

- `src/lib/text.ts` holds `POST_LIMITS` for the journal, Mastodon, and Bluesky.
- `getEffectivePostLimit({ includeMastodon, includeBluesky })` is used server-side and the `NewPostForm` mirrors the logic to avoid mismatches.
- When writing new integrations that cross-post, call `hasMastodonShare` / `hasBlueskyShare` before sending duplicate posts.

## Database schema quick reference

1. `posts` table is created lazily by `initDb()` on every request if needed. It contains all the columns listed in the architecture doc.
2. Indexes:
   - `idx_posts_created_at` speeds up timeline pagination (`ORDER BY id DESC`).
   - `idx_posts_source_external` (from migration `001_add_posts_source_fields`) enforces uniqueness for `source/external_id` combos where `external_id` is non-null.
3. No foreign keys yet, so expanding the schema (e.g., adding `tags` or `users`) just requires another migration entry.

## Production deployment tips

- **Secrets**: configure all env vars through your hosting provider (Vercel dashboard, Doppler, etc.). `ADMIN_SESSION_SECRET` should never be checked into git.
- **Cron scheduling**: Vercel Cron Jobs or GitHub Actions can hit the integration endpoints. Always include `?key=${CRON_SECRET}`.
- **Monitoring**: each integration route responds with counts (`inserted`, `skippedExisting`, `bodyLength`, etc.). Log those JSON payloads somewhere (e.g., Slack webhook) to verify the job is working.
- **Backups**: the entire app depends on the `posts` table. Enable automatic backups on Postgres or periodically `pg_dump` the database.

## Handy commands

```bash
# Format/inspect cookies in dev tools
Application tab → Cookies → http://localhost:3000 → journal_session

# Run a single integration (e.g., Spotify short-term)
curl "http://localhost:3000/api/integrations/spotify-sync?timeRange=short_term"

# Trigger Mastodon sync manually while authenticated
curl -X POST -H "Cookie: journal_session=1" http://localhost:3000/api/mastodon-sync
```

Keep iterating on this file whenever you add a new cron job, script, or deployment quirk so the operational context stays centralized.
