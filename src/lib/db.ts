// lib/db.ts
import { sql } from '@vercel/postgres';

export type Post = {
  id: number;
  created_at: string;
  kind: 'text' | 'photo';
  body: string;
  image_data: string | null;
  // NEW FIELDS for external sources (Mastodon, etc.)
  source: "local" | "mastodon";
  external_id: string | null;
  external_url: string | null;
  source_deleted: boolean;
  // NEW
  link_url: string | null;
};

export async function initDb() {
  // Safe to call more than once; it’s idempotent.
  await sql`
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      kind TEXT NOT NULL CHECK (kind IN ('text', 'photo')),
      body TEXT NOT NULL CHECK (char_length(body) <= 500),
      image_data TEXT
    );
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_posts_created_at
    ON posts (created_at DESC);
  `;
}


export async function fetchPostsPage(
  cursor: number | null,
  limit: number,
): Promise<Post[]> {
  if (cursor == null) {
    const { rows } = await sql<Post>`
      SELECT *
      FROM posts
      WHERE source_deleted = FALSE
      ORDER BY id DESC
      LIMIT ${limit}
    `;
    return rows;
  } else {
    const { rows } = await sql<Post>`
      SELECT *
      FROM posts
      WHERE source_deleted = FALSE
        AND id < ${cursor}
      ORDER BY id DESC
      LIMIT ${limit}
    `;
    return rows;
  }
}

