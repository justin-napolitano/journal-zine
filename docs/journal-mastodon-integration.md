# Mastodon Integration Guide

This page documents both directions of the Mastodon bridge: importing existing statuses into the journal and cross-posting new journal entries back out. It includes every relevant object/var mapping so Codex has the full picture.

## Configuration summary

| Variable | Purpose | Where it is read |
| --- | --- | --- |
| `MASTODON_BASE_URL` | API hostname, e.g. `https://mastodon.social` | `src/lib/mastodon.ts`, `src/lib/crosspost.ts`
| `MASTODON_ACCESS_TOKEN` | OAuth bearer token with `read:accounts read:statuses write:statuses` scopes | `src/lib/mastodon.ts`
| `CRON_SECRET` (optional) | Shared key to guard `/api/mastodon-sync` when exposed publicly | `src/app/api/mastodon-sync/route.ts` (pass as `?key=`)

The integration also reuses the generic auth cookie (for manual sync runs) and the `BLUESKY_*`/`SPOTIFY_*` vars when cross-posting cascades.

## Library functions (`src/lib/mastodon.ts`)

- `getOwnAccount()` → `MastodonAccount`
  - Wraps `/api/v1/accounts/verify_credentials` to discover the numeric account ID.
- `fetchOwnStatusesPage(accountId, { limit, maxId })` → `MastodonStatus[]`
  - Pulls pages of statuses with replies/reblogs optionally filtered (currently both included for fidelity; the sync route filters afterwards).
- `uploadMediaToMastodon(imageData)` → `media_id`
  - Takes a `data:image/...;base64,...` string, converts it to a `Blob`, hits `/api/v2/media`.
- `postToMastodon(status, mediaIds?)` → JSON API response or `null`
  - Posts text plus optional media.

Helper heuristics in `src/lib/crosspost.ts` look at `mastodon_url`, `source`, and `external_url` to determine whether a post already has a Mastodon representation.

## Import pipeline (`/api/mastodon-sync`)

1. **Auth**: rejects unless `isRequestAuthed()` returns true.
2. **Fetch window**: query param `max` (default 120) controls the maximum statuses to pull, paging 40 at a time.
3. **Filtering**:
   - Drop `visibility === 'direct'` (DMs) and any `reblog`.
4. **Normalization**:
   - `stripHtml` removes tags and squashes whitespace from Mastodon's HTML content.
   - `extractSingleUrl` looks for link-only posts and sets `kind='link'` + `link_url`.
   - Media attachments become `image_data` (stored as absolute URL strings).
5. **Upsert logic**:
   - If `(source='mastodon', external_id=<status.id>)` is new → insert with the remote timestamp/URL.
   - If it exists → refresh `body`, `image_data`, `link_url`, `mastodon_url`, and clear `source_deleted`.
6. **Soft deletion**:
   - After syncing, query all Mastodon rows newer than the oldest remote status in the window.
   - If their `external_id` is no longer in the remote set → `SET source_deleted = TRUE`.
7. **Response**: `{ imported, reactivated, markedDeleted, scannedRemote }` for quick dashboards or Slack notifications.

## Cross-posting when creating local posts

Inside `POST /api/posts`:

1. The client sets `targets: ["mastodon", ...]` when the “post to Mastodon” checkbox is on.
2. The server:
   - Uploads the file via `uploadMediaToMastodon` if `image_data` exists.
   - Calls `postToMastodon(body, mediaIds)`.
   - On success, updates the row inline to set `mastodon_url` and backfill `external_url` if it was empty.
3. Failures are logged but do not reject the local post insert, ensuring the journal stays consistent.

## URL detection

`looksLikeMastodonUrl` from `src/lib/crosspost.ts` helps determine whether a post already “counts” as shared:

```ts
const mastodonBase = (process.env.MASTODON_BASE_URL || '').replace(/\/$/, '');
return value?.startsWith(mastodonBase) || value?.includes('mastodon');
```

This is used by integration jobs (Spotify/GitHub) to prevent duplicate cross-posts.

## End-to-end checklist

1. Generate a user token in Mastodon with read+write scopes.
2. Populate `.env.local` with `MASTODON_BASE_URL`, `MASTODON_ACCESS_TOKEN`.
3. (Optional) Set `CRON_SECRET` and hit `/api/mastodon-sync?key=…` from cron.
4. Turn on “post to Mastodon” in the UI to ensure `postToMastodon` paths are exercised.
5. Inspect Postgres rows; expect `source='mastodon'` for mirrored content and `mastodon_url` populated for cross-posts.

With these details you can confidently tweak rate limits, add retry logic, or port the integration to another ActivityPub server.
