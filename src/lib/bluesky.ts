// src/lib/bluesky.ts
import { BskyAgent } from "@atproto/api";

const DEFAULT_SERVICE = "https://bsky.social";

let agent: BskyAgent | null = null;

function getServiceUrl(): string {
  return process.env.BLUESKY_SERVICE_URL || DEFAULT_SERVICE;
}

function isConfigured(): boolean {
  return !!(
    process.env.BLUESKY_IDENTIFIER &&
    process.env.BLUESKY_APP_PASSWORD
  );
}

/**
 * Lazily-initialized BskyAgent.
 *
 * We still login per call to keep it simple/safe across serverless runs.
 */
function getAgent(): BskyAgent {
  if (!agent) {
    agent = new BskyAgent({ service: getServiceUrl() });
  }
  return agent;
}

export async function postToBluesky(
  text: string,
): Promise<{ uri: string; cid: string } | null> {
  if (!isConfigured()) {
    console.warn(
      "Bluesky not configured (BLUESKY_IDENTIFIER / BLUESKY_APP_PASSWORD missing)",
    );
    return null;
  }

  const identifier = process.env.BLUESKY_IDENTIFIER!;
  const password = process.env.BLUESKY_APP_PASSWORD!;

  const agent = getAgent();

  // login for this request
  await agent.login({ identifier, password });

  const res = await agent.post({
    text,
    createdAt: new Date().toISOString(),
  });

  // res has uri + cid for the post
  return { uri: res.uri, cid: res.cid };
}

