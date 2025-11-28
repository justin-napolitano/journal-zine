// src/lib/url.ts

const URL_REGEX =
  /\bhttps?:\/\/[^\s/$.?#].[^\s]*/gi;

export function extractSingleUrl(text: string): string | null {
  if (!text) return null;
  const matches = [...text.matchAll(URL_REGEX)].map((m) => m[0]);
  if (matches.length !== 1) return null;
  return matches[0];
}

