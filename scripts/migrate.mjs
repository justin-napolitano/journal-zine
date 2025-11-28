// scripts/migrate.js
//import { loadEnvConfig } from "@next/env";
import { sql } from "@vercel/postgres";

import pkg from '@next/env';
const { loadEnvConfig } = pkg;

/**
 * Minimal migration system:
 * - Keeps a schema_migrations table with (name, run_at)
 * - Runs any migrations whose name is not yet in that table
 */

// ✅ Load .env, .env.local, etc. just like Next dev/build does
const projectDir = process.cwd();
loadEnvConfig(projectDir);

async function ensureMigrationsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      run_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

const migrations = [
  {
    name: "001_add_posts_source_fields",
    up: async () => {
      // Add columns to posts so we can track Mastodon-origin posts
      await sql`
        ALTER TABLE posts
        ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'local',
        ADD COLUMN IF NOT EXISTS external_id TEXT,
        ADD COLUMN IF NOT EXISTS external_url TEXT,
        ADD COLUMN IF NOT EXISTS source_deleted BOOLEAN NOT NULL DEFAULT FALSE
      `;

      // Optional: unique index to prevent duplicate imports per-source
      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_source_external
        ON posts (source, external_id)
        WHERE external_id IS NOT NULL
      `;
    },
  },
  {
    name: "002_add_link_url_to_posts",
    up: async () => {
      await sql`
        ALTER TABLE posts
        ADD COLUMN IF NOT EXISTS link_url TEXT
      `;
    },
  },
  {
    name: "003_update_posts_kind_constraint",
    up: async () => {
      // Drop the old CHECK constraint if it exists
      await sql`
        ALTER TABLE posts
        DROP CONSTRAINT IF EXISTS posts_kind_check
      `;

      // Add a new one that includes 'link'
      await sql`
        ALTER TABLE posts
        ADD CONSTRAINT posts_kind_check
        CHECK (kind IN ('text', 'photo', 'link'))
      `;
    },
  },
  // When you add more migrations later, push new objects here:
  // {
  //   name: "002_some_other_change",
  //   up: async () => { ... },
  // },
];

async function getAppliedMigrationNames() {
  const result = await sql`SELECT name FROM schema_migrations ORDER BY id ASC`;
  return result.rows.map((row) => row.name);
}

async function recordMigration(name) {
  await sql`
    INSERT INTO schema_migrations (name)
    VALUES (${name})
    ON CONFLICT (name) DO NOTHING
  `;
}

async function runMigrations() {
  console.log("Running migrations...");
  await ensureMigrationsTable();

  const applied = new Set(await getAppliedMigrationNames());

  for (const migration of migrations) {
    if (applied.has(migration.name)) {
      console.log(`- Skipping ${migration.name} (already applied)`);
      continue;
    }

    console.log(`- Applying ${migration.name}...`);
    try {
      await migration.up();
      await recordMigration(migration.name);
      console.log(`  ✓ ${migration.name} applied`);
    } catch (err) {
      console.error(`  ✗ Failed to apply ${migration.name}:`, err);
      process.exitCode = 1;
      return;
    }
  }

  console.log("All migrations up to date.");
}

runMigrations().then(() => {
  // let process exit naturally
});

