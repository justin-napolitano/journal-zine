# Integrations API Reference

All automation endpoints live inside the Next.js app and can be invoked over HTTPS (cron, curl, GitHub Actions, etc.). This guide lists each route, required auth, query parameters, and the objects that flow through them.

> **Security checklist**
>
> - Set `CRON_SECRET` in production. Provide it as `?key=YOUR_SECRET` on every request below.
> - `/api/mastodon-sync` additionally requires the admin session cookie because it can mutate lots of rows.
> - All routes depend on their respective third-party credentials (Mastodon, Spotify, GitHub, Bluesky).

## `/api/mastodon-sync` (GET or POST)

| Aspect | Details |
| --- | --- |
| Purpose | Mirror your own Mastodon timeline into the `posts` table. |
| Auth | Requires logged-in session (cookie `journal_session`) and, optionally, `?key=CRON_SECRET`. |
| Query params | `max` (default `120`): cap on statuses fetched per sync window. |
| Flow | Fetch pages of statuses via `fetchOwnStatusesPage`, strip HTML, infer `kind`/`link_url`, insert or refresh rows with `source='mastodon'`, then mark vanished statuses as `source_deleted`. |
| Response | `{ imported, reactivated, markedDeleted, scannedRemote }` |

Use `GET` when triggering from cron (makes it idempotent). `POST` is available for curl commands that want to include a body or just to keep semantics flexible.

## `/api/integrations/spotify-sync` (GET)

| Aspect | Details |
| --- | --- |
| Purpose | Post a "listening log" snapshot summarizing top artists/tracks from Spotify. |
| Auth | Optional `?key=CRON_SECRET`. No session cookie required (designed for cron). |
| Query params | `timeRange=short_term|medium_term|long_term` (default `short_term`), `artists` (default `5`), `tracks` (default `5`). |
| Flow | `fetchTopArtists` + `fetchTopTracks` → render body via `buildSnapshotBody` → insert `source='spotify'` row keyed by `spotify-top-<range>-<YYYY-MM-DD>` → optionally cross-post to Mastodon/Bluesky based on env toggles. |
| Response | `{ inserted, timeRange, artistsCount, tracksCount, bodyLength, message? }` where `inserted` is `0` if today’s snapshot already exists. |

## `/api/integrations/github-sync` (GET)

| Aspect | Details |
| --- | --- |
| Purpose | Insert one post per merged pull request across all public repos you own. |
| Auth | Optional `?key=CRON_SECRET`. |
| Query params | `windowDays` (default `7`): lookback window for merged PRs. |
| Flow | `fetchPublicRepos` → `fetchRecentMergedPullsForRepo(repo, sinceIso)` → dedupe per `source/external_id` (`pr:<repo>#<number>`) → insert `kind='link'` rows pointing to the PR URL → optional cross-posts (Mastodon/Bluesky) depending on env toggles. |
| Response | `{ inserted, skippedExisting, repos, windowDays }`. |

Each row is stored with `source='github'`, `external_id='pr:owner/repo#number'`, and `link_url=githubUrl`.

## `/api/integrations/github-weekly-sync` (GET)

| Aspect | Details |
| --- | --- |
| Purpose | Publish a single weekly (or custom window) summarized post counting merged PRs per repo. |
| Auth | Optional `?key=CRON_SECRET`. |
| Query params | `windowDays` (default `7`). |
| Flow | Same repo discovery + PR fetch as the per-PR route, but aggregate counts into a single body via `buildWeeklyGithubBody` → insert `source='github'`, `external_id='github-weekly-<window>-<YYYY-MM-DD>'`. Optional cross-posts run if enabled. |
| Response | `{ inserted, repos, merged, bodyLength, message? }` with `inserted=0` when the daily snapshot already exists. |

## Common helper script

`scripts/test-integrations.sh` loads `.env`, `.env.local`, and an optional `TEST_INTEGRATIONS_ENV_FILE`, builds `?key=` query strings automatically, and curls all endpoints in this order: Spotify snapshot, GitHub weekly summary, GitHub per-PR sync. Use it to sanity-check env vars locally.

## Object & var mapping

- Spotify + GitHub routes check `hasMastodonShare` / `hasBlueskyShare` before cross-posting to avoid duplicates.
- Every inserted post gets the usual columns (`kind`, `body`, `image_data`, `source`, `external_id`, `link_url`, `mastodon_url`, `bluesky_uri`). Refer to the Architecture doc for column definitions.
- The responses intentionally include counts so you can alert if they stay at zero unexpectedly.

With these reference tables you can wire your cron provider (Vercel, GitHub Actions, Cloudflare Workers, etc.) to hit the right routes using the correct secrets and parameters.
