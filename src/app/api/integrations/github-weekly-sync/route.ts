// src/app/api/integrations/github-weekly/route.ts
export const runtime = "nodejs";

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
import { hasBlueskyShare, hasMastodonShare } from "@/lib/crosspost";

const ENABLE_MASTO =
  process.env.GITHUB_SYNC_ENABLE_MASTODON === "true";
const ENABLE_BLUESKY =
  process.env.GITHUB_SYNC_ENABLE_BLUESKY === "true";
const CRON_SECRET = process.env.CRON_SECRET;

const MAX_BODY_CHARS = POST_LIMITS.bluesky;
const TAG_LINE = "#github #weekly";

const DEFAULT_WINDOW_DAYS = 7;

function getSinceIso(windowDays: number): string {
  const ms = windowDays * 24 * 60 * 60 * 1000;
  const now = Date.now();
  return new Date(now - ms).toISOString();
}

/**
 * Build a 300-char summary of merged PRs per repo, dropping whole lines
 * if needed to stay within the limit.
 */
function buildWeeklyGithubBody(opts: {
  windowDays: number;
  repoStats: { repo: string; mergedCount: number }[];
}): string {
  const { windowDays, repoStats } = opts;

  const lines: string[] = [];
  lines.push(`github pulse - last ${windowDays} days`);
  lines.push("---------------------------");

  const totalMerged = repoStats.reduce(
    (sum, r) => sum + r.mergedCount,
    0,
  );
  lines.push(`${totalMerged} merged pull requests across the board`);

  const activeRepos = repoStats.filter((r) => r.mergedCount > 0);
  if (activeRepos.length > 0) {
    lines.push("");
    lines.push("shipping highlights:");
    activeRepos.forEach((r) => {
      lines.push(`- ${r.repo}: ${r.mergedCount} merge${
        r.mergedCount === 1 ? "" : "s"
      }`);
    });
  } else {
    lines.push("");
    lines.push("quiet stretch - clearing the runway for the next sprint");
  }

  let core = lines.join("\n").trimEnd();
  const tagLength = graphemeLength(TAG_LINE);
  const separatorLength = graphemeLength("\n\n");

  while (
    graphemeLength(core) + (core ? separatorLength : 0) + tagLength >
    MAX_BODY_CHARS
  ) {
    const lastNewline = core.lastIndexOf("\n");
    if (lastNewline === -1) {
      core = "";
      break;
    }
    core = core.slice(0, lastNewline).trimEnd();
  }

  if (!core) {
    return TAG_LINE;
  }

  return `${core}\n\n${TAG_LINE}`;
}

/**
 * GET /api/integrations/github-weekly
 *
 * Query params:
 *   - key: CRON_SECRET (optional, if set in env)
 *   - windowDays: how many days back to look (default 7)
 *
 * Example (weekly cron):
 *   /api/integrations/github-weekly?key=YOUR_SECRET&windowDays=7
 */
export async function GET(request: Request) {
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
      repos: 0,
      message: "no public repos found",
    });
  }

  const repoStats: { repo: string; mergedCount: number }[] = [];

  for (const repo of repos) {
    const merged = await fetchRecentMergedPullsForRepo(
      repo,
      sinceIso,
    );
    if (merged.length > 0) {
      repoStats.push({
        repo: repo.full_name,
        mergedCount: merged.length,
      });
    }
  }

  const totalMerged = repoStats.reduce(
    (sum, r) => sum + r.mergedCount,
    0,
  );

  if (totalMerged === 0) {
    return NextResponse.json({
      inserted: 0,
      repos: repos.length,
      merged: 0,
      message: "no merged PRs in window",
    });
  }

  const body = buildWeeklyGithubBody({ windowDays, repoStats });

  // one snapshot per day + window size
  const todayKey = new Date().toISOString().slice(0, 10);
  const externalId = `github-weekly-${windowDays}-${todayKey}`;

  const existing = await sql<Post>`
    SELECT *
    FROM posts
    WHERE source = 'github'
      AND external_id = ${externalId}
    LIMIT 1
  `;

  let inserted = 0;
  let post: Post;

  if (existing.rows.length > 0) {
    post = existing.rows[0];
  } else {
    const result = await sql<Post>`
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
        'text',
        ${body},
        NULL,
        'github',
        ${externalId},
        NULL,
        FALSE,
        NULL
      )
      RETURNING *
    `;

    post = result.rows[0];
    inserted = 1;
  }

  const alreadyMasto = hasMastodonShare(post);
  const alreadyBluesky = hasBlueskyShare(post);

  if (ENABLE_MASTO && !alreadyMasto) {
    try {
      const status = await postToMastodon(body, undefined);

      if (status && status.url) {
        const updated = await sql<Post>`
          UPDATE posts
          SET
            mastodon_url = ${status.url},
            external_url = COALESCE(external_url, ${status.url})
          WHERE id = ${post.id}
          RETURNING *
        `;
        post = updated.rows[0];
      }
    } catch (err) {
      console.error(
        "GitHub weekly → Mastodon cross-post failed:",
        err,
      );
    }
  }

  if (ENABLE_BLUESKY && !alreadyBluesky) {
    try {
      const blueskyPost = await postToBluesky(body);
      if (blueskyPost && blueskyPost.uri) {
        const updated = await sql<Post>`
          UPDATE posts
          SET
            bluesky_uri = ${blueskyPost.uri},
            external_url = COALESCE(external_url, ${blueskyPost.uri})
          WHERE id = ${post.id}
          RETURNING *
        `;
        post = updated.rows[0];
      }
    } catch (err) {
      console.error(
        "GitHub weekly → Bluesky cross-post failed:",
        err,
      );
    }
  }

  return NextResponse.json({
    inserted,
    repos: repos.length,
    merged: totalMerged,
    bodyLength: body.length,
    message:
      inserted === 0 ? "weekly snapshot already exists for today" : undefined,
  });
}
