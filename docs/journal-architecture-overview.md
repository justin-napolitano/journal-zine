# Journal Architecture Overview

This document orients you (or Codex) inside the project by mapping the moving parts, the Post object shape, and how requests flow through the system.

## High-level system map

| Layer | Implementation | Responsibilities | Key files |
| --- | --- | --- | --- |
| UI & routing | Next.js App Router | Renders the feed, login screen, client interactivity | `src/app/**/*.tsx`, `src/components/*.tsx`
| API tier | Next.js route handlers | CRUD for posts, login/logout, ingestion webhooks | `src/app/api/**/*`
| Data | Vercel Postgres via `@vercel/postgres` | Stores every journal post plus mirrors of Mastodon/Spotify/GitHub content | `src/lib/db.ts`, `scripts/migrate.mjs`
| Integrations | Thin libraries wrapping remote APIs | Mastodon, Bluesky, Spotify, GitHub | `src/lib/{mastodon,bluesky,spotify,github}.ts`
| Background jobs | Triggered via HTTP (cron or manual) | Import posts from Mastodon, synthesize Spotify & GitHub snapshots | `src/app/api/integrations/**/*`, `scripts/test-integrations.sh`

All traffic enters through Next.js. Server components (e.g. `src/app/page.tsx`) fetch data straight from Postgres; API routes do the same, so there is only one source of truth.

## Primary data objects

### `Post` row (stored in Postgres and reused in TypeScript)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `number` | Primary key, monotonic.
| `created_at` | `string` (ISO) | Default `NOW()` when inserted locally; remote imports keep their timestamps.
| `kind` | `'text' | 'photo' | 'link'` | Drives card layout and posting logic.
| `body` | `string` | Markdown-less plain text the user typed or parsed from remote content.
| `image_data` | `string | null` | For local posts this is a base64 data URL; for Mastodon imports this is the remote media URL.
| `source` | `'local' | 'mastodon' | 'spotify' | 'github' | ...` | Where the row originated.
| `external_id` | `string | null` | Remote identifier (Mastodon status ID, GitHub PR number slug, etc.).
| `external_url` | `string | null` | Canonical remote URL if known.
| `source_deleted` | `boolean` | Soft-delete flag when remote content disappears.
| `link_url` | `string | null` | Only set for link-style posts (local or imported).
| `mastodon_url` | `string | null` | URL that the row was cross-posted to on Mastodon.
| `bluesky_uri` | `string | null` | Bluesky `at://` URI for cross-post copies.

Related helpers live in `src/lib/posts.ts` and `src/lib/crosspost.ts`.

### `PostFilters`

POST `/api/posts` accepts arbitrary text but GET `/api/posts` exposes rich filtering. A normalized filter bag looks like this:

```ts
{
  source?: 'local' | 'mastodon' | string;
  kind?: 'text' | 'photo' | 'link' | 'all';
  tag?: string; // no leading '#'
  q?: string;   // free form search
}
```

`parseSearchToFilters` (in `src/app/api/posts/route.ts`) understands `tag:foo`, `:tag foo`, `#foo`, `type:photos`, `source:mastodon`, and plain free text, making the single search bar expressive without extra UI.

## Request flows & module wiring

### Reading the feed

1. `src/app/page.tsx` (server component) runs `initDb()` and `fetchPostsPage(null, 12)`.
2. It renders `<JournalApp>` with those `posts` plus `isAuthed` (via `isRequestAuthed()`).
3. The client component keeps the list in React state, listens for the sentinel intersection, and hits `GET /api/posts?cursor=…&q=…` to paginate.
4. `GET /api/posts` composes SQL filters, enforces a max limit (50), and returns `{ posts, nextCursor }`.

### Creating a post

1. `<NewPostForm>` collects text, optional photo, and target checkboxes (Mastodon/Bluesky).
2. `POST /api/posts` validates auth (`isRequestAuthed()`), enforces grapheme limits (`getEffectivePostLimit`), infers `kind` (photo vs link vs text), and inserts a row.
3. Optional cross-posts:
   - Mastodon: `uploadMediaToMastodon` → `postToMastodon` and record `mastodon_url`.
   - Bluesky: `postToBluesky` and record `bluesky_uri`.
4. The API returns `{ post }` so the client can prepend it to the feed immediately.

### Importing remote content

All ingestion jobs live under `src/app/api/integrations` and are ordinary HTTP handlers that cron or `scripts/test-integrations.sh` can invoke locally.

- **Mastodon mirror (`/api/mastodon-sync`)**
  - Fetch account via `getOwnAccount`, page through `/api/v1/accounts/:id/statuses`.
  - Strip HTML, detect hashtags/links, upsert rows with `source='mastodon'`.
  - Mark local rows as `source_deleted` if they disappeared remotely.

- **Spotify snapshot (`/api/integrations/spotify-sync`)**
  - Uses `fetchTopArtists`/`fetchTopTracks` with a refresh-token grant.
  - Builds a textual summary (kept under Bluesky's limit) and inserts a text row keyed by `spotify-top-<range>-<date>`.
  - Optional cross-posting reuses the same helpers as manual posts.

- **GitHub syncs**
  - `/api/integrations/github-sync`: inserts one post per merged PR since `windowDays`.
  - `/api/integrations/github-weekly-sync`: inserts one aggregated weekly summary post.
  - Both rely on `fetchPublicRepos` + `fetchRecentMergedPullsForRepo` and share the cross-post helpers.

## Environment variable map

| Variable | Purpose | Used in |
| --- | --- | --- |
| `DATABASE_URL` | Vercel Postgres connection string | `@vercel/postgres` via `sql``
| `ADMIN_PASSWORD` | Shared secret for `/login` | `src/app/api/login/route.ts`
| `ADMIN_SESSION_SECRET` | Cookie value in prod (and auth check) | `login` route + `src/lib/auth.ts`
| `MASTODON_BASE_URL` | Base URL for API + host heuristics | `src/lib/mastodon.ts`, `src/lib/crosspost.ts`
| `MASTODON_ACCESS_TOKEN` | OAuth bearer token | `src/lib/mastodon.ts`
| `BLUESKY_SERVICE_URL` | Optional alternate service base | `src/lib/bluesky.ts`
| `BLUESKY_IDENTIFIER` / `BLUESKY_APP_PASSWORD` | App password credentials | `src/lib/bluesky.ts`
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` / `SPOTIFY_REFRESH_TOKEN` | API credentials for stats snapshots | `src/lib/spotify.ts`
| `GITHUB_TOKEN` | Personal access token for API calls | `src/lib/github.ts`
| `GITHUB_OWNER` | Optional override for repo filtering | `src/lib/github.ts`
| `SPOTIFY_SYNC_ENABLE_MASTODON` / `SPOTIFY_SYNC_ENABLE_BLUESKY` | Toggle cross-posting for the Spotify job | Spotify route handler
| `GITHUB_SYNC_ENABLE_MASTODON` / `GITHUB_SYNC_ENABLE_BLUESKY` | Toggle cross-posting for GitHub jobs | GitHub route handlers
| `CRON_SECRET` | Shared secret to guard integration endpoints | Spotify + GitHub routes, helper scripts

Keep `.env.local` out of version control and load it through Next or `scripts/test-integrations.sh`.

## File/module lookup

- `src/app/api/posts/route.ts`: pagination, filtering, creation, cross-post fan-out.
- `src/lib/text.ts`: grapheme counting + max-length negotiation shared between client & server.
- `src/components/JournalApp.tsx`: search UX, infinite scroll, logout wiring.
- `scripts/migrate.mjs`: idempotent migrations tracked via `schema_migrations`.

With this reference you can quickly see where to plug new feed sources or UI chrome.
