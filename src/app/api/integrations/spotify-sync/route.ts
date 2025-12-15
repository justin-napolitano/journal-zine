// src/app/api/integrations/spotify-sync/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import type { Post } from "@/lib/db";
import {
  fetchTopArtists,
  fetchTopTracks,
  formatTrackTitle,
} from "@/lib/spotify";
import { postToMastodon } from "@/lib/mastodon";
import { postToBluesky } from "@/lib/bluesky";
import { graphemeLength, POST_LIMITS } from "@/lib/text";
import { hasBlueskyShare, hasMastodonShare } from "@/lib/crosspost";

const ENABLE_MASTO =
  process.env.SPOTIFY_SYNC_ENABLE_MASTODON === "true";
const ENABLE_BLUESKY =
  process.env.SPOTIFY_SYNC_ENABLE_BLUESKY === "true";
const CRON_SECRET = process.env.CRON_SECRET;

const MAX_BODY_CHARS = POST_LIMITS.bluesky;
const TAG_LINE = "#listening #spotify #top";

/**
 * Build a snapshot body and enforce MAX_BODY_CHARS
 * by dropping whole lines from the bottom (no mid-line truncation).
 */
function buildSnapshotBody(opts: {
  timeRange: "short_term" | "medium_term" | "long_term";
  artists: { name: string }[];
  tracks: { title: string }[];
}): string {
  const { timeRange, artists, tracks } = opts;

  const rangeLabel =
    timeRange === "short_term"
      ? "recent weeks"
      : timeRange === "medium_term"
        ? "last few months"
        : "long term";

  const lines: string[] = [];

  lines.push(`listening log - ${rangeLabel}`);
  lines.push("-------------------------");

  const hasArtists = artists.length > 0;
  const hasTracks = tracks.length > 0;

  if (!hasArtists && !hasTracks) {
    lines.push("no standouts this time - rediscovering old favorites");
  }

  if (hasArtists) {
    lines.push("");
    lines.push("top artists:");
    artists.forEach((a, idx) => {
      lines.push(`${idx + 1}) ${a.name}`);
    });
  }

  if (hasTracks) {
    lines.push("");
    lines.push("top tracks:");
    tracks.forEach((t, idx) => {
      lines.push(`${idx + 1}) ${t.title}`);
    });
  }

  // First build the core body (without tags)
  let core = lines.join("\n").trimEnd();

  const tagLength = graphemeLength(TAG_LINE);
  const separatorLength = graphemeLength("\n\n");

  // Ensure core + tags fits in MAX_BODY_CHARS by dropping full lines
  while (
    graphemeLength(core) + (core ? separatorLength : 0) + tagLength >
    MAX_BODY_CHARS
  ) {
    const lastNewline = core.lastIndexOf("\n");
    if (lastNewline === -1) {
      // nothing left to trim; just use tags
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
 * GET /api/integrations/spotify-sync
 *
 * Query params:
 *   - key: CRON_SECRET (optional, if set in env)
 *   - timeRange: short_term | medium_term | long_term (default short_term)
 *   - artists: number of artists to show (default 5)
 *   - tracks: number of tracks to show (default 5)
 *
 * Example (weekly cron):
 *   /api/integrations/spotify-sync?key=YOUR_SECRET&timeRange=short_term
 */
export async function GET(request: Request) {
  // optional protection
  if (CRON_SECRET) {
    const url = new URL(request.url);
    const key = url.searchParams.get("key");
    if (key !== CRON_SECRET) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  const url = new URL(request.url);
  const timeRangeParam = url.searchParams.get("timeRange");
  const timeRange =
    timeRangeParam === "medium_term" || timeRangeParam === "long_term"
      ? timeRangeParam
      : ("short_term" as const);

  const artistsParam = url.searchParams.get("artists");
  const tracksParam = url.searchParams.get("tracks");
  const artistsLimit = artistsParam ? Number(artistsParam) : 5;
  const tracksLimit = tracksParam ? Number(tracksParam) : 5;

  const [artists, tracks] = await Promise.all([
    fetchTopArtists(timeRange, artistsLimit),
    fetchTopTracks(timeRange, tracksLimit),
  ]);

  if (!artists.length && !tracks.length) {
    return NextResponse.json({
      inserted: 0,
      message: "no top artists or tracks returned from Spotify",
    });
  }

  const topArtists = artists.map((a) => ({ name: a.name }));
  const topTracks = tracks.map((t) => ({
    title: formatTrackTitle(t),
  }));

  const body = buildSnapshotBody({
    timeRange,
    artists: topArtists,
    tracks: topTracks,
  });

  // one snapshot per day + timeRange
  const todayKey = new Date().toISOString().slice(0, 10);
  const externalId = `spotify-top-${timeRange}-${todayKey}`;

  // dedupe by source + external_id
  const existing = await sql<Post>`
    SELECT *
    FROM posts
    WHERE source = 'spotify'
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
        'spotify',
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

  // optional: cross-post the same text to Mastodon
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
        "Spotify top → Mastodon cross-post failed:",
        err,
      );
    }
  }

  // optional: cross-post to Bluesky
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
        "Spotify top → Bluesky cross-post failed:",
        err,
      );
    }
  }

  return NextResponse.json({
    inserted,
    timeRange,
    artistsCount: topArtists.length,
    tracksCount: topTracks.length,
    bodyLength: body.length,
    message:
      inserted === 0 ? "snapshot already exists for today" : undefined,
  });
}
