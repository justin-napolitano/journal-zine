// src/lib/text.ts

export const POST_LIMITS = {
  journal: 1000,
  mastodon: 500,
  bluesky: 300,
} as const;

let cachedSegmenter: Intl.Segmenter | null | undefined;

type IntlWithSegmenter = typeof Intl & {
  Segmenter?: typeof Intl.Segmenter;
};

function getSegmenter(): Intl.Segmenter | null {
  if (cachedSegmenter !== undefined) return cachedSegmenter;
  const hasSegmenter =
    typeof Intl !== "undefined" &&
    typeof (Intl as IntlWithSegmenter).Segmenter === "function";
  cachedSegmenter = hasSegmenter
    ? new Intl.Segmenter("en", { granularity: "grapheme" })
    : null;
  return cachedSegmenter;
}

export function graphemeLength(value: string): number {
  if (!value) return 0;
  const segmenter = getSegmenter();
  if (!segmenter) {
    return Array.from(value).length;
  }

  return Array.from(segmenter.segment(value)).length;
}

export function getEffectivePostLimit(opts: {
  includeMastodon: boolean;
  includeBluesky: boolean;
}): number {
  let limit = POST_LIMITS.journal;
  if (opts.includeMastodon) {
    limit = Math.min(limit, POST_LIMITS.mastodon);
  }
  if (opts.includeBluesky) {
    limit = Math.min(limit, POST_LIMITS.bluesky);
  }
  return limit;
}
