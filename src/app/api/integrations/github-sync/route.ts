// src/app/api/integrations/github-sync/route.ts
import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import type { Post } from "@/lib/db";
import {
  fetchPublicRepos,
  fetchRecentMergedPullsForRepo,
} from "@/lib/github";
import { postToMastodon } from "@/lib/mastodon";
import { postToBluesky } from "@/lib/bluesky";
import { graphemeLength, POST_LIMITS } from "@/lib/text";

const ENABLE_MASTO =
  process.env.GITHUB_SYNC_ENABLE_MASTODON === "true";
const ENABLE_BLUESKY =
  process.env.GITHUB_SYNC_ENABLE_BLUESKY === "true";
const CRON_SECRET = process.env.CRON_SECRET;

// how many days back to look for merged PRs
const DEFAULT_WINDOW_DAYS = 7;

function buildPrBody(params: {
  repoFullName: string;
  title: string;
  number: number;
  reserveChars?: number;
}): string {
  const [, repoSlug] = params.repoFullName.split("/");
  const repo = repoSlug || params.repoFullName;
  const title = params.title.trim() || `merged pull request #${params.number}`;

  const lines: string[] = [];
  lines.push(`${repo} merge #${params.number}`);
  lines.push("-----------------------");
  lines.push(title);
  lines.push("");
  lines.push("fresh commits heading out");

  let core = lines.join("\n").trimEnd();
  const tagLine = `#github #${repo}`;
  const tagLength = graphemeLength(tagLine);
  const separatorLength = graphemeLength("\n\n");
  const maxLength = Math.max(0, POST_LIMITS.bluesky - (params.reserveChars ?? 0));

  if (maxLength === 0) {
    return "";
  }

  while (
    graphemeLength(core) + (core ? separatorLength : 0) + tagLength >
    maxLength
  ) {
    const lastNewline = core.lastIndexOf("\n");
    if (lastNewline === -1) {
      core = "";
      break;
    }
    core = core.slice(0, lastNewline).trimEnd();
  }

  if (!core) {
    return tagLength <= maxLength ? tagLine : "";
  }

  const candidate = `${core}\n\n${tagLine}`;
  return graphemeLength(candidate) <= maxLength ? candidate : tagLine;
}

function getSinceIso(windowDays: number): string {
  const ms = windowDays * 24 * 60 * 60 * 1000;
  const now = Date.now();
  return new Date(now - ms).toISOString();
}

/**
 * GET /api/integrations/github-sync?key=CRON_SECRET&windowDays=7
 *
 * - discovers all public, non-fork, non-archived repos for the user
 * - fetches merged PRs in that window
 * - inserts them as "github" link posts in the journal
 * - optionally cross-posts each to Mastodon
 */
export async function GET(request: Request) {
  // optional protection so randoms can't hit this
  if (CRON_SECRET) {
    const url = new URL(request.url);
    const key = url.searchParams.get("key");
    if (key !== CRON_SECRET) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  const url = new URL(request.url);
  const windowDaysParam = url.searchParams.get("windowDays");
  const windowDays =
    windowDaysParam && !Number.isNaN(Number(windowDaysParam))
      ? Math.max(1, Number(windowDaysParam))
      : DEFAULT_WINDOW_DAYS;

  const sinceIso = getSinceIso(windowDays);

  const repos = await fetchPublicRepos();
  if (repos.length === 0) {
    return NextResponse.json({
      inserted: 0,
      skippedExisting: 0,
      repos: 0,
    });
  }

  let inserted = 0;
  let skippedExisting = 0;

  for (const repo of repos) {
    const merged = await fetchRecentMergedPullsForRepo(repo, sinceIso);

    for (const { pull } of merged) {
      const externalId = `pr:${repo.full_name}#${pull.number}`;
      const githubUrl = pull.html_url;
      const baseBodyInput = {
        repoFullName: repo.full_name,
        title: pull.title,
        number: pull.number,
      };
      const body = buildPrBody(baseBodyInput);

      // dedupe by source + external_id
      const existing = await sql<Post>`
        SELECT * FROM posts
        WHERE source = 'github'
          AND external_id = ${externalId}
        LIMIT 1
      `;

      if (existing.rows.length > 0) {
        skippedExisting++;
        continue;
      }

      const { rows } = await sql<Post>`
        INSERT INTO posts (
          kind,
          body,
          image_data,
          source,
          external_id,
          external_url,
          source_deleted,
          link_url
        )
        VALUES (
          'link',
          ${body},
          NULL,
          'github',
          ${externalId},
          NULL,
          FALSE,
          ${githubUrl}
        )
        RETURNING *
      `;

      let post = rows[0];
      inserted++;

      // optional: cross-post this PR to Mastodon
      if (ENABLE_MASTO) {
        try {
          const status = await postToMastodon(
            `${body} ${githubUrl}`,
            undefined,
          );

          if (status && status.url && !post.external_url) {
            const updated = await sql<Post>`
              UPDATE posts
              SET external_url = ${status.url}
              WHERE id = ${post.id}
              RETURNING *
            `;
            post = updated.rows[0];
          }
        } catch (err) {
          console.error("GitHub PR → Mastodon failed:", err);
        }
      }

      if (ENABLE_BLUESKY) {
        try {
          const suffix = githubUrl ? ` ${githubUrl}` : "";
          const reserve = suffix ? graphemeLength(suffix) : 0;
          const blueskyBody = suffix
            ? buildPrBody({ ...baseBodyInput, reserveChars: reserve })
            : body;
          const payload = `${blueskyBody}${suffix}`.trim();
          if (!payload) {
            throw new Error("Empty payload for Bluesky cross-post");
          }
          const result = await postToBluesky(payload);

          if (result && result.uri && !post.external_url) {
            const updated = await sql<Post>`
              UPDATE posts
              SET external_url = ${result.uri}
              WHERE id = ${post.id}
              RETURNING *
            `;
            post = updated.rows[0];
          }
        } catch (err) {
          console.error("GitHub PR → Bluesky failed:", err);
        }
      }
    }
  }

  return NextResponse.json({
    inserted,
    skippedExisting,
    repos: repos.length,
    windowDays,
  });
}
