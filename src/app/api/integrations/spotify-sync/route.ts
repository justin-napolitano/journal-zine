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

const ENABLE_MASTO =
  process.env.SPOTIFY_SYNC_ENABLE_MASTODON === "true";
const CRON_SECRET = process.env.CRON_SECRET;

const MAX_BODY_CHARS = 300;
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

  lines.push(`listening snapshot (${rangeLabel}):`);

  if (artists.length > 0) {
    lines.push("");
    lines.push("top artists:");
    artists.forEach((a, idx) => {
      lines.push(`${idx + 1}. ${a.name}`);
    });
  }

  if (tracks.length > 0) {
    lines.push("");
    lines.push("top tracks:");
    tracks.forEach((t, idx) => {
      lines.push(`${idx + 1}. ${t.title}`);
    });
  }

  // First build the core body (without tags)
  let core = lines.join("\n").trimEnd();

  // Ensure core + tags fits in MAX_BODY_CHARS by dropping full lines
  const sep = core ? "\n\n" : "";
  while (
    core.length + sep.length + TAG_LINE.length >
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

  if (existing.rows.length > 0) {
    return NextResponse.json({
      inserted: 0,
      message: "snapshot already exists for today",
    });
  }

  // insert as a single text-style summary post
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

  let post = rows[0];

  // optional: cross-post the same text to Mastodon
  if (ENABLE_MASTO) {
    try {
      const status = await postToMastodon(body, undefined);

      if (status && status.url) {
        const updated = await sql<Post>`
          UPDATE posts
          SET external_url = ${status.url}
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

  return NextResponse.json({
    inserted: 1,
    timeRange,
    artistsCount: topArtists.length,
    tracksCount: topTracks.length,
    bodyLength: body.length,
  });
}

