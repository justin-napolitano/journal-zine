// src/lib/mastodon.ts
const baseUrl = process.env.MASTODON_BASE_URL;
const token = process.env.MASTODON_ACCESS_TOKEN;

/**
 * Cross-post a status to Mastodon.
 * Returns the created status JSON or null if Mastodon is not configured.
 */
export async function postToMastodon(status: string) {
  if (!baseUrl || !token) {
    // Mastodon integration disabled if env vars are missing
    return null;
  }

  const res = await fetch(`${baseUrl}/api/v1/statuses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      status,
      visibility: "public",
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error("Mastodon error:", txt);
    throw new Error(`Mastodon POST failed: ${res.status}`);
  }

  return res.json();
}

