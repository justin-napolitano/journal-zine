// src/lib/crosspost.ts
import type { Post } from "./db";

const mastodonBase = (process.env.MASTODON_BASE_URL || "").replace(/\/$/, "");

function looksLikeMastodonUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  if (mastodonBase && value.startsWith(mastodonBase)) {
    return true;
  }
  return value.includes("mastodon");
}

function looksLikeBlueskyUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  if (value.startsWith("at://")) {
    return true;
  }
  return value.includes("bsky.app");
}

export function hasMastodonShare(post: Post): boolean {
  if (post.mastodon_url) {
    return true;
  }
  if (post.source === "mastodon") {
    return true;
  }
  return looksLikeMastodonUrl(post.external_url);
}

export function hasBlueskyShare(post: Post): boolean {
  if (post.bluesky_uri) {
    return true;
  }
  return looksLikeBlueskyUrl(post.external_url);
}
