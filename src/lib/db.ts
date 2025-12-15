// src/lib/db.ts
import { sql } from "@vercel/postgres";

export type Post = {
  id: number;
  created_at: string;
  kind: "text" | "photo" | "link";
  body: string;
  image_data: string | null;

  // External / source metadata
  source: "local" | "mastodon" | string;
  external_id: string | null;
  external_url: string | null;
  source_deleted: boolean;

  // For link-style posts
  link_url: string | null;

  // Cross-post tracking
  mastodon_url: string | null;
  bluesky_uri: string | null;
};

export async function initDb() {
  // Idempotent: safe to call multiple times
  await sql`
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      kind TEXT NOT NULL CHECK (kind IN ('text', 'photo', 'link')),
      body TEXT NOT NULL,
      image_data TEXT,
      source TEXT NOT NULL DEFAULT 'local',
      external_id TEXT,
      external_url TEXT,
      source_deleted BOOLEAN NOT NULL DEFAULT FALSE,
      link_url TEXT,
      mastodon_url TEXT,
      bluesky_uri TEXT
    );
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_posts_created_at
    ON posts (created_at DESC);
  `;
}

export type PostFilters = {
  source?: string; // "local" | "mastodon" | etc | "all"
  kind?: "text" | "photo" | "link" | "all";
  tag?: string;    // without '#'
  q?: string;      // free-text search
};

export async function fetchPostsPage(
  cursor: number | null,
  limit: number,
  filters: PostFilters = {},
): Promise<Post[]> {
  const hasSource = !!filters.source && filters.source !== "all";
  const hasKind =
    !!filters.kind &&
    filters.kind !== "all" &&
    (filters.kind === "text" ||
      filters.kind === "photo" ||
      filters.kind === "link");

  const hasTag = !!(filters.tag && filters.tag.trim() !== "");
  const hasQ = !!(filters.q && filters.q.trim() !== "");

  const tagPattern =
    "%" +
    "#" +
    (filters.tag ? filters.tag.trim().replace(/^#/, "") : "") +
    "%";

  const qPattern = "%" + (filters.q ? filters.q.trim() : "") + "%";

  const { rows } = await sql<Post>`
    SELECT *
    FROM posts
    WHERE
      (${cursor === null} OR id < ${cursor}) AND
      (${!hasSource} OR source = ${filters.source}) AND
      (${!hasKind} OR kind = ${filters.kind}) AND
      (${!hasTag} OR body ILIKE ${tagPattern}) AND
      (${
        !hasQ
      } OR (
        body ILIKE ${qPattern}
        OR COALESCE(link_url, '') ILIKE ${qPattern}
        OR source ILIKE ${qPattern}
        OR kind ILIKE ${qPattern}
      ))
    ORDER BY id DESC
    LIMIT ${limit}
  `;

  return rows;
}
