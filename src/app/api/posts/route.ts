// app/api/posts/route.ts
import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { initDb, fetchPostsPage, type Post } from "@/lib/db";

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

  const data = await request.json();
  const body: string = (data.body ?? "").toString().trim();
  const imageData: string | null = data.imageData ?? null;

  if (!body) {
    return NextResponse.json({ error: "Body is required" }, { status: 400 });
  }

  if (body.length > 120) {
    return NextResponse.json({ error: "Body is too long" }, { status: 400 });
  }

  if (imageData && typeof imageData !== "string") {
    return NextResponse.json(
      { error: "Invalid image data" },
      { status: 400 }
    );
  }

  const kind: "text" | "photo" = imageData ? "photo" : "text";

  const { rows } = await sql<Post>`
    INSERT INTO posts (kind, body, image_data)
    VALUES (${kind}, ${body}, ${imageData})
    RETURNING *
  `;

  const post = rows[0];
  return NextResponse.json({ post });
}

