// src/app/api/posts/route.ts
import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { initDb, fetchPostsPage, type Post } from "@/lib/db";
import { isRequestAuthed } from "@/lib/auth";
import { postToMastodon, uploadMediaToMastodon } from "@/lib/mastodon";

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

  const data = await request.json();
  const rawBody = (data.body ?? "").toString();
  const body = rawBody.trim();
  const imageData: string | null = data.imageData ?? null;

  const targets: string[] = Array.isArray(data.targets)
    ? data.targets.filter((t) => typeof t === "string")
    : [];

  const wantsMastodon = targets.includes("mastodon");

  if (!body) {
    return NextResponse.json({ error: "Body is required" }, { status: 400 });
  }

  // per-site limits
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

  if (imageData && typeof imageData !== "string") {
    return NextResponse.json(
      { error: "Invalid image data" },
      { status: 400 },
    );
  }

  const kind: "text" | "photo" = imageData ? "photo" : "text";

  // 1) create local post in your DB
  const { rows } = await sql<Post>`
    INSERT INTO posts (kind, body, image_data)
    VALUES (${kind}, ${body}, ${imageData})
    RETURNING *
  `;
  const post = rows[0];

  // 2) cross-post to Mastodon only if requested
  if (wantsMastodon) {
    try {
      let mediaIds: string[] | undefined = undefined;

      // If this post has an image, upload it to Mastodon first
      if (imageData) {
        const mediaId = await uploadMediaToMastodon(imageData);
        mediaIds = [mediaId];
      }

      await postToMastodon(body, mediaIds);
    } catch (err) {
      console.error("Failed to cross-post to Mastodon:", err);
      // v1: log only; later you could store status in DB
    }
  }

  return NextResponse.json({ post });
}

