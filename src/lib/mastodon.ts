// src/lib/mastodon.ts

const ENV_BASE_URL = process.env.MASTODON_BASE_URL;
const ENV_TOKEN = process.env.MASTODON_ACCESS_TOKEN;

function getConfig() {
  return { baseUrl: ENV_BASE_URL, token: ENV_TOKEN };
}

function requireConfig(): { baseUrl: string; token: string } {
  const { baseUrl, token } = getConfig();
  if (!baseUrl || !token) {
    throw new Error(
      "Mastodon not configured (MASTODON_BASE_URL / MASTODON_ACCESS_TOKEN missing)",
    );
  }
  return { baseUrl, token };
}
// Types for reading timelines

type MastodonStatus = {
  id: string;
  url: string;
  created_at: string;
  content: string; // HTML
  visibility: string;
  reblog: MastodonStatus | null;
  media_attachments: {
    id: string;
    type: string;
    url: string;
    preview_url: string;
  }[];
};

type MastodonAccount = {
  id: string;
  username: string;
  acct: string;
  url: string;
};

// generic JSON fetch with auth
async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const { baseUrl, token } = requireConfig();

  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });

  const text = await res.text();
  if (!res.ok) {
    console.error("Mastodon fetch error:", res.status, text);
    throw new Error(`Mastodon fetch failed: ${res.status}`);
  }

  return JSON.parse(text) as T;
}
/**
 * Convert a data URL (data:image/...;base64,...) into a Blob we can upload.
 */
function dataUrlToBlob(dataUrl: string): Blob {
  const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
  if (!match) {
    throw new Error("Invalid data URL for imageData");
  }
  const mime = match[1];
  const base64 = match[2];

  // Node 18+ has Buffer + Blob available in the runtime Next uses
  const binary = Buffer.from(base64, "base64");
  return new Blob([binary], { type: mime });
}

export async function getOwnAccount(): Promise<MastodonAccount> {
  return await fetchJson<MastodonAccount>("/api/v1/accounts/verify_credentials");
}

/**
 * Fetch a page of your own statuses.
 *
 * @param accountId - your Mastodon account ID
 * @param limit - 1–40
 * @param maxId - for pagination; returns statuses with id <= maxId
 */
export async function fetchOwnStatusesPage(
  accountId: string,
  {
    limit = 40,
    maxId,
  }: { limit?: number; maxId?: string | null } = {},
): Promise<MastodonStatus[]> {
  const params = new URLSearchParams();
  params.set("limit", String(Math.min(limit, 40)));
  // you can tune these later
  params.set("exclude_replies", "false");
  params.set("exclude_reblogs", "false");
  if (maxId) params.set("max_id", maxId);

  const path = `/api/v1/accounts/${accountId}/statuses?${params.toString()}`;
  return await fetchJson<MastodonStatus[]>(path);
}


/**
 * Upload an image to Mastodon and return its media_id.
 * Expects `imageData` to be a data URL string.
 */
export async function uploadMediaToMastodon(imageData: string): Promise<string> {
  const { baseUrl, token } = requireConfig();

  const blob = dataUrlToBlob(imageData);

  const formData = new FormData();
  // filename doesn't really matter; use a generic one
  formData.append("file", blob, "image.jpg");

  const res = await fetch(`${baseUrl}/api/v2/media`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      // DO NOT set Content-Type here; fetch will set the correct multipart boundary
    },
    body: formData,
  });

  const text = await res.text();
  if (!res.ok) {
    console.error("Mastodon media error:", res.status, text);
    throw new Error(`Mastodon media upload failed: ${res.status}`);
  }

  const json = JSON.parse(text) as { id: string };
  return json.id;
}

/**
 * Cross-post a status to Mastodon, optionally with attached media_ids.
 */
type MastodonStatusPayload = {
  status: string;
  visibility: "public" | "unlisted" | "private" | "direct";
  media_ids?: string[];
};

export async function postToMastodon(
  status: string,
  mediaIds?: string[],
) {
  const { baseUrl, token } = getConfig();
  if (!baseUrl || !token) {
    // Integration disabled if env vars are missing
    return null;
  }

  const payload: MastodonStatusPayload = {
    status,
    visibility: "public",
  };

  if (mediaIds && mediaIds.length > 0) {
    payload.media_ids = mediaIds;
  }

  const res = await fetch(`${baseUrl}/api/v1/statuses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error("Mastodon status error:", res.status, text);
    throw new Error(`Mastodon POST failed: ${res.status}`);
  }

  return JSON.parse(text);
}
