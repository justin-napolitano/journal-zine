// src/app/api/posts/route.ts
import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { initDb, fetchPostsPage, type Post } from "@/lib/db";
import { isRequestAuthed } from "@/lib/auth";
import { postToMastodon, uploadMediaToMastodon } from "@/lib/mastodon";
import { extractSingleUrl } from "@/lib/url";

export async function GET(request: Request) {
  await initDb();

  const { searchParams } = new URL(request.url);
  const cursorParam = searchParams.get("cursor");
  const limitParam = searchParams.get("limit");

  const cursor = cursorParam ? Number(cursorParam) : null;
  const limit = limitParam ? Math.min(Number(limitParam), 50) : 12;

  const posts = await fetchPostsPage(cursor, limit);
  const nextCursor = posts.length ? posts[posts.length - 1].id : null;

  return NextResponse.json({ posts, nextCursor });
}

export async function POST(request: Request) {
  await initDb();

  if (!(await isRequestAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let data: any;
  try {
    data = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawBody = (data.body ?? "").toString();
  const body = rawBody.trim();
  const imageData: string | null =
    typeof data.imageData === "string" ? data.imageData : null;

  const rawTargets: unknown = data.targets;
  const targets: string[] = Array.isArray(rawTargets)
    ? rawTargets.filter((t): t is string => typeof t === "string")
    : [];

  const wantsMastodon = targets.includes("mastodon");

  if (!body && !imageData) {
    return NextResponse.json(
      { error: "Body or image is required" },
      { status: 400 },
    );
  }

  // Character limits – journal vs Mastodon
  const maxForJournal = 1000;
  const maxForMastodon = 500;
  const effectiveMax = wantsMastodon ? maxForMastodon : maxForJournal;

  if (body.length > effectiveMax) {
    return NextResponse.json(
      {
        error: `Body is too long (max ${effectiveMax} characters for selected targets)`,
      },
      { status: 400 },
    );
  }

  // Detect link-style posts
  const linkUrl = extractSingleUrl(body);
  const kind: "text" | "photo" | "link" =
    imageData ? "photo" : linkUrl ? "link" : "text";

  // Store locally first
  const { rows } = await sql<Post>`
    INSERT INTO posts (
      kind,
      body,
      image_data,
      source,
      external_id,
      external_url,
      link_url
    )
    VALUES (
      ${kind},
      ${body},
      ${imageData},
      'local',
      NULL,
      NULL,
      ${linkUrl}
    )
    RETURNING *
  `;

  let post = rows[0];

  // Optional: cross-post to Mastodon
  if (wantsMastodon) {
    try {
      // You already have these helpers in lib/mastodon.ts
      // If names differ, adjust accordingly.
      // import { uploadMediaToMastodon, postToMastodon } from "@/lib/mastodon";
      let mediaIds: string[] | undefined = undefined;

      if (imageData) {
        const mediaId = await uploadMediaToMastodon(imageData);
        mediaIds = [mediaId];
      }

      await postToMastodon(body, mediaIds);

      // If later you want to capture mastodon id/url here,
      // you can read the response from postToMastodon and UPDATE this post.
    } catch (err) {
      console.error("Failed to cross-post to Mastodon from POST /api/posts:", err);
      // but we don't fail the local create
    }
  }

  return NextResponse.json({ post });
}

