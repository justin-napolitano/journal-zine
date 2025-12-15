// src/app/api/mastodon-sync/route.ts
import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { initDb, type Post } from "@/lib/db";
import { isRequestAuthed } from "@/lib/auth";
import { getOwnAccount, fetchOwnStatusesPage } from "@/lib/mastodon";
import { extractSingleUrl } from "@/lib/url";

type MastodonStatus = {
  id: string;
  url: string;
  created_at: string;
  content: string;
  visibility: string;
  reblog: MastodonStatus | null;
  media_attachments: {
    id: string;
    type: string;
    url: string;
    preview_url: string;
  }[];
};

// tiny HTML → plaintext stripper for Mastodon content
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

async function runSync(request: Request) {
  await initDb();

  if (!(await isRequestAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const maxStatuses = Number(searchParams.get("max") ?? "120"); // cap how many we pull
  const perPage = 40;

  const account = await getOwnAccount();

  const remoteStatuses: MastodonStatus[] = [];
  let pageMaxId: string | null = null;

  while (remoteStatuses.length < maxStatuses) {
    const page = await fetchOwnStatusesPage(account.id, {
      limit: perPage,
      maxId: pageMaxId,
    });

    if (page.length === 0) break;

    remoteStatuses.push(...page);
    pageMaxId = page[page.length - 1].id;

    if (page.length < perPage) break;
  }

  // Filter down to statuses you actually want mirrored
  const visibleStatuses = remoteStatuses.filter((st) => {
    if (st.visibility === "direct") return false; // skip DMs
    if (st.reblog) return false; // skip boosts; only your originals
    return true;
  });

  const remoteIds = visibleStatuses.map((st) => st.id);
  const remoteIdSet = new Set(remoteIds);

  let importedCount = 0;
  let reactivatedCount = 0;
  let markedDeleted = 0;

  // Upsert visible statuses as posts
  for (const st of visibleStatuses) {
    const body = stripHtml(st.content);
    if (!body) continue;

    const hasMedia =
      st.media_attachments && st.media_attachments.length > 0;
    const imageUrl = hasMedia ? st.media_attachments[0].url : null;

    // detect link-style posts
    const linkUrl = extractSingleUrl(body);
    const kind: "text" | "photo" | "link" =
      hasMedia ? "photo" : linkUrl ? "link" : "text";

    const existing = await sql<Post>`
      SELECT *
      FROM posts
      WHERE source = 'mastodon'
        AND external_id = ${st.id}
      LIMIT 1
    `;

    if (existing.rows.length === 0) {
      await sql`
        INSERT INTO posts (
          kind,
          body,
          image_data,
          created_at,
          source,
          external_id,
          external_url,
          source_deleted,
          link_url,
          mastodon_url
        )
        VALUES (
          ${kind},
          ${body},
          ${imageUrl},
          ${st.created_at},
          'mastodon',
          ${st.id},
          ${st.url},
          FALSE,
          ${linkUrl},
          ${st.url}
        )
      `;
      importedCount++;
    } else {
      const row = existing.rows[0];
      const wasDeleted = row.source_deleted;

      // keep body/image/link/kind fresh, and ensure it's visible again
      await sql`
        UPDATE posts
        SET
          kind = ${kind},
          body = ${body},
          image_data = ${imageUrl},
          link_url = ${linkUrl},
          mastodon_url = ${st.url},
          source_deleted = FALSE
        WHERE id = ${row.id}
      `;

      if (wasDeleted) {
        reactivatedCount++;
      }
    }
  }

  // Soft-delete Mastodon posts that vanished from the recent remote window
  if (visibleStatuses.length > 0) {
    const oldestRemoteCreatedAt = visibleStatuses
      .map((st) => new Date(st.created_at).toISOString())
      .sort()[0];

    const locals = await sql<Pick<Post, "id" | "external_id">>`
      SELECT id, external_id
      FROM posts
      WHERE source = 'mastodon'
        AND source_deleted = FALSE
        AND external_id IS NOT NULL
        AND created_at >= ${oldestRemoteCreatedAt}
    `;

    for (const row of locals.rows) {
      if (row.external_id && !remoteIdSet.has(row.external_id)) {
        await sql`
          UPDATE posts
          SET source_deleted = TRUE
          WHERE id = ${row.id}
        `;
        markedDeleted++;
      }
    }
  }

  return NextResponse.json({
    imported: importedCount,
    reactivated: reactivatedCount,
    markedDeleted,
    scannedRemote: visibleStatuses.length,
  });
}

// ✅ Allow both GET and POST to run the sync
export async function GET(request: Request) {
  return runSync(request);
}

export async function POST(request: Request) {
  return runSync(request);
}
