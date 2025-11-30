// src/lib/spotify.ts

type SpotifyExternalUrls = {
  spotify?: string;
};

type SpotifyArtist = {
  id: string;
  name: string;
  genres?: string[];
  external_urls: SpotifyExternalUrls;
};

type SpotifyTrackArtist = {
  id: string;
  name: string;
};

type SpotifyTrack = {
  id: string;
  name: string;
  artists: SpotifyTrackArtist[];
  external_urls: SpotifyExternalUrls;
};

type SpotifyTopArtistsResponse = {
  items: SpotifyArtist[];
};

type SpotifyTopTracksResponse = {
  items: SpotifyTrack[];
};

type SpotifyTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

function getSpotifyConfig() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  return { clientId, clientSecret, refreshToken };
}

async function fetchAccessToken(): Promise<string | null> {
  const cfg = getSpotifyConfig();
  if (!cfg) return null;

  const params = new URLSearchParams();
  params.set("grant_type", "refresh_token");
  params.set("refresh_token", cfg.refreshToken);

  const basic = Buffer.from(
    `${cfg.clientId}:${cfg.clientSecret}`,
    "utf8",
  ).toString("base64");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
    cache: "no-store",
  });

  if (!res.ok) {
    console.error("Spotify token error", res.status);
    return null;
  }

  const json = (await res.json()) as SpotifyTokenResponse;
  return json.access_token;
}

async function spotifyGet<T>(path: string): Promise<T | null> {
  const accessToken = await fetchAccessToken();
  if (!accessToken) return null;

  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    console.error(
      "Spotify API error",
      res.status,
      path,
      await res.text().catch(() => ""),
    );
    return null;
  }

  const json = (await res.json()) as T;
  return json;
}

export async function fetchTopArtists(
  timeRange: "short_term" | "medium_term" | "long_term" = "short_term",
  limit = 5,
): Promise<SpotifyArtist[]> {
  const clamped = Math.min(Math.max(limit, 1), 50);
  const res = await spotifyGet<SpotifyTopArtistsResponse>(
    `/me/top/artists?time_range=${timeRange}&limit=${clamped}`,
  );
  return res?.items ?? [];
}

export async function fetchTopTracks(
  timeRange: "short_term" | "medium_term" | "long_term" = "short_term",
  limit = 5,
): Promise<SpotifyTrack[]> {
  const clamped = Math.min(Math.max(limit, 1), 50);
  const res = await spotifyGet<SpotifyTopTracksResponse>(
    `/me/top/tracks?time_range=${timeRange}&limit=${clamped}`,
  );
  return res?.items ?? [];
}

export function formatTrackTitle(track: SpotifyTrack): string {
  const artistNames = track.artists.map((a) => a.name).join(", ");
  return `${artistNames} – ${track.name}`;
}

export function getTrackUrl(track: SpotifyTrack): string | null {
  return track.external_urls.spotify ?? null;
}

