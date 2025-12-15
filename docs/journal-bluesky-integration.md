# Bluesky Integration Guide

This guide documents everything related to Bluesky cross-posting: credentials, helper functions, and how the flag flows from the UI down to the database.

## Configuration summary

| Variable | Purpose | Where it is used |
| --- | --- | --- |
| `BLUESKY_SERVICE_URL` | Optional override for the AT Protocol service (defaults to `https://bsky.social`) | `src/lib/bluesky.ts` when constructing `BskyAgent`
| `BLUESKY_IDENTIFIER` | Handle or DID for the account that will post (e.g., `name.bsky.social`) | `src/lib/bluesky.ts`
| `BLUESKY_APP_PASSWORD` | App password generated via Bluesky settings | `src/lib/bluesky.ts`
| `SPOTIFY_SYNC_ENABLE_BLUESKY` | Enables Bluesky cross-posting for the Spotify snapshot route | `src/app/api/integrations/spotify-sync/route.ts`
| `GITHUB_SYNC_ENABLE_BLUESKY` | Enables Bluesky cross-posting for GitHub integration routes | `src/app/api/integrations/{github-sync,github-weekly-sync}/route.ts`

Store the credentials in `.env.local` for development and in your hosting provider’s secret manager for production.

## Library walkthrough (`src/lib/bluesky.ts`)

- **`getServiceUrl()`** – resolves `BLUESKY_SERVICE_URL` and falls back to `https://bsky.social`.
- **`isConfigured()`** – quick guard that checks both `BLUESKY_IDENTIFIER` and `BLUESKY_APP_PASSWORD` exist.
- **`getAgent()`** – lazily creates a singleton `BskyAgent` pointing at the service URL.
- **`postToBluesky(text, options?)`** – logs in with the configured identifier/app password on every call, builds an optional `app.bsky.embed.external` block when `options.link` is provided, then publishes the post. Returns `{ uri, cid }` on success or `null` if the integration is not configured.

`postToBluesky` never throws if the integration simply isn’t configured; upstream callers can treat a `null` as “skip cross-posting.” Exceptions are thrown when the API itself fails.

## How cross-post selection works

1. In the composer UI (`NewPostForm`), the “post to Bluesky” checkbox toggles `postToBluesky` state.
2. When the form submits, it serializes `targets: ["mastodon", "bluesky", ...]`.
3. `/api/posts` checks `targets.includes("bluesky")` and, after inserting the local row, calls `postToBluesky(body)`.
4. On success, it updates the row with `bluesky_uri` and, if `external_url` was empty, fills it with the Bluesky URI.

`src/lib/crosspost.ts` exposes `hasBlueskyShare(post: Post)` which returns `true` when any of the following are true:

- The `bluesky_uri` column is set.
- The `external_url` looks like an `at://` URI or `https://bsky.app/...`.

Integration jobs (Spotify/GitHub) use that helper to avoid duplicate Bluesky posts when re-running.

## Embedding external links

`postToBluesky` accepts `options.link` with `{ url, title?, description? }`. The GitHub PR sync uses this to embed the PR URL and human-friendly title so Bluesky renders a card. Title/description fall back to the URL if omitted.

```ts
await postToBluesky(body, {
  link: {
    url: githubUrl,
    title: pull.title ?? `${repo.full_name} PR #${pull.number}`,
    description: body,
  },
});
```

## Troubleshooting tips

- **401 or login failures**: Regenerate the app password in Bluesky → Settings → App Passwords. App passwords look like `xxxx-xxxx-xxxx-xxxx`.
- **Posting succeeds but feed shows nothing**: Bluesky might throttle rapid posts; add retries/backoff in your caller if you’re batching.
- **`hasBlueskyShare` returning true unexpectedly**: check if `external_url` already contains a Bluesky host; clear that column if you want to re-share.

With this reference you can confidently wire new automation (e.g., cross-posting a different integration) by calling `postToBluesky` with the proper `link` metadata.
