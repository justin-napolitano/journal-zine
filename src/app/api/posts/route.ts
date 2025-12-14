// src/app/api/posts/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sql } from "@vercel/postgres";
import {
  initDb,
  fetchPostsPage,
  type Post,
  type PostFilters,
} from "@/lib/db";
import { postToMastodon, uploadMediaToMastodon } from "@/lib/mastodon";
import { postToBluesky } from "@/lib/bluesky";
import { extractSingleUrl } from "@/lib/url";

const MAX_FOR_JOURNAL = 1000;
const MAX_FOR_MASTODON = 500;
const MAX_FOR_BLUESKY = 300;
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;

async function isRequestAuthed(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get("journal_session")?.value;
  const secret = process.env.ADMIN_SESSION_SECRET;

  // Dev convenience: allow the old "1" cookie value locally
  if (process.env.NODE_ENV === "development" && session === "1") {
    return true;
  }

  if (!secret) {
    // No secret configured → treat as locked-down rather than wide open
    return false;
  }

  return session === secret;
}

function normalizeSource(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const v = value.toLowerCase();
  if (v === "journal" || v === "local") return "local";
  if (v === "mastodon" || v === "masto") return "mastodon";
  return v;
}

function normalizeKind(
  value: string | null | undefined,
): PostFilters["kind"] | undefined {
  if (!value) return undefined;
  const v = value.toLowerCase();
  if (v === "all") return "all";
  if (v === "text" || v === "note" || v === "notes") return "text";
  if (v === "photo" || v === "photos" || v === "image" || v === "images")
    return "photo";
  if (v === "link" || v === "links" || v === "url" || v === "urls")
    return "link";
  return undefined;
}

// Parse a single q string into filters + remaining free-text q
function parseSearchToFilters(rawQ: string | null): PostFilters {
  if (!rawQ) return {};

  const tokens = rawQ.trim().split(/\s+/);
  let source: string | undefined;
  let kind: PostFilters["kind"] | undefined;
  let tag: string | undefined;
  const free: string[] = [];

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    const lower = token.toLowerCase();

    // :tag foo
    if ((lower === ":tag" || lower === "tag") && i + 1 < tokens.length) {
      tag = tokens[i + 1].replace(/^#/, "");
      i += 2;
      continue;
    }

    // tag:foo
    if (lower.startsWith("tag:")) {
      tag = lower.slice(4).replace(/^#/, "");
      i += 1;
      continue;
    }

    // #foo, treat as tag if we don't already have one
    if (lower.startsWith("#") && !tag) {
      tag = lower.slice(1);
      i += 1;
      continue;
    }

    // type:notes / type:photo / type:link
    if (lower.startsWith("type:")) {
      const raw = lower.slice(5);
      const norm = normalizeKind(raw);
      if (norm) {
        kind = norm;
        i += 1;
        continue;
      }
    }

    // source:mastodon / source:journal
    if (lower.startsWith("source:")) {
      const raw = lower.slice(7);
      const norm = normalizeSource(raw);
      if (norm) {
        source = norm;
        i += 1;
        continue;
      }
    }

    // otherwise it's free text
    free.push(token);
    i += 1;
  }

  const q = free.join(" ").trim() || undefined;

  const filters: PostFilters = {};
  if (source) filters.source = source;
  if (kind) filters.kind = kind;
  if (tag) filters.tag = tag;
  if (q) filters.q = q;

  return filters;
}

export async function GET(request: Request) {
  await initDb();

  const { searchParams } = new URL(request.url);
  const cursorParam = searchParams.get("cursor");
  const limitParam = searchParams.get("limit");

  const cursor = cursorParam ? Number(cursorParam) : null;
  const limit = limitParam
    ? Math.min(Number(limitParam), MAX_LIMIT)
    : DEFAULT_LIMIT;

  const rawQ = searchParams.get("q");
  const parsedFromQ = parseSearchToFilters(rawQ);

  // still allow explicit query params to override
  const sourceParam = normalizeSource(searchParams.get("source"));
  const kindParam = normalizeKind(searchParams.get("kind"));
  const tagParam = searchParams.get("tag") ?? undefined;

  const filters: PostFilters = {
    source: sourceParam ?? parsedFromQ.source,
    kind: kindParam ?? parsedFromQ.kind,
    tag: tagParam ?? parsedFromQ.tag,
    q: parsedFromQ.q,
  };

  const posts = await fetchPostsPage(cursor, limit, filters);
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
    typeof data.imageData === "string" && data.imageData.length > 0
      ? data.imageData
      : null;

  const rawTargets: unknown = data.targets;
  const targets: string[] = Array.isArray(rawTargets)
    ? rawTargets.filter((t): t is string => typeof t === "string")
    : [];

  const wantsMastodon = targets.includes("mastodon");
  const wantsBluesky = targets.includes("bluesky");

  if (!body && !imageData) {
    return NextResponse.json(
      { error: "Body or image is required" },
      { status: 400 },
    );
  }

  // Character limits – keep everything within Bluesky if selected
  let effectiveMax = MAX_FOR_JOURNAL;
  if (wantsMastodon) {
    effectiveMax = Math.min(effectiveMax, MAX_FOR_MASTODON);
  }
  if (wantsBluesky) {
    effectiveMax = Math.min(effectiveMax, MAX_FOR_BLUESKY);
  }

  if (body.length > effectiveMax) {
    return NextResponse.json(
      {
        error: `Body is too long (max ${effectiveMax} characters for selected targets)`,
      },
      { status: 400 },
    );
  }

  const linkUrl = extractSingleUrl(body);
  const kind: Post["kind"] =
    imageData ? "photo" : linkUrl ? "link" : "text";

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
      let mediaIds: string[] | undefined = undefined;

      if (imageData) {
        const mediaId = await uploadMediaToMastodon(imageData);
        if (mediaId) {
          mediaIds = [mediaId];
        }
      }

      await postToMastodon(body, mediaIds);
    } catch (err) {
      console.error(
        "Failed to cross-post to Mastodon from POST /api/posts:",
        err,
      );
    }
  }

  // Optional: cross-post to Bluesky
  if (wantsBluesky) {
    try {
      await postToBluesky(body);
    } catch (err) {
      console.error(
        "Failed to cross-post to Bluesky from POST /api/posts:",
        err,
      );
    }
  }

  return NextResponse.json({ post });
}

