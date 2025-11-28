// src/lib/posts.ts

import type { Post as DbPost } from "./db";

// Re-export the Post type so components can import from "@/lib/posts"
export type Post = DbPost;

/**
 * Decide what URL a card should go to, if any.
 *
 * Rules (for now):
 * - Prefer link_url (explicit link posts / scraped links)
 * - Fallback to external_url (e.g. Mastodon status)
 * - Else → no outbound URL
 */
export function getPrimaryOutboundUrl(post: Post): string | null {
  if (post.link_url && post.link_url.trim() !== "") {
    return post.link_url.trim();
  }
  if (post.external_url && post.external_url.trim() !== "") {
    return post.external_url.trim();
  }
  return null;
}

/**
 * Convenience flag if you ever want to render "local only"
 * posts differently.
 */
export function isLocalOnly(post: Post): boolean {
  return !post.link_url && !post.external_url;
}

/**
 * Shared date formatter, matching what you already did
 * in PostCard.
 */
export function formatPostDate(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

