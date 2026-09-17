// app/api/spotify-playlist/route.ts
//
// Reads the playlist's tracks. As of Spotify's Feb 2026 API change, this
// requires a user-authorized token belonging to the playlist's owner — a
// plain app-only (Client Credentials) token gets a 403. So this route uses
// the refresh token saved by /api/spotify-callback (see /api/spotify-login
// for the one-time setup step) to mint access tokens on the fly.
//
// IMPORTANT for static hosting (e.g. GitHub Pages): this handler takes no
// `request` argument and doesn't read cookies/headers, so once you add
// `output: "export"` to next.config for a GitHub Pages build, Next renders
// this route ONCE at build time and bakes the result into a static file —
// nothing runs on a server for your visitors. That means:
//   1. Run the one-time login (/api/spotify-login) and make sure a valid
//      token exists BEFORE running the production build that you deploy —
//      whatever this returns at build time is frozen until your next build.
//   2. Playlist edits on Spotify won't show up until you rebuild + redeploy.
//   3. Before that export build, delete the spotify-login and
//      spotify-callback route folders — they read query params/write files
//      at request time, which static export can't support. This route is
//      fine to keep; those two are dev-only setup helpers.

import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-static";

const PLAYLIST_ID = "0IRFXY4kTsjzHWhphriDvx";
const PLAYLIST_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const TOKEN_FILE = path.join(process.cwd(), ".spotify-tokens.json");

type SpotifyTrack = {
  uri: string;
  name: string;
  artist: string;
  image: string | null;
  durationMs: number;
};

type StoredTokens = { refresh_token: string };

type PlaylistCache = { tracks: SpotifyTrack[]; fetchedAt: number };
let playlistCache: PlaylistCache | null = null;

let accessTokenCache: { token: string; expiresAt: number } | null = null;

async function readStoredTokens(): Promise<StoredTokens | null> {
  // Production (or any host without a persistent/writable filesystem, e.g.
  // Vercel serverless functions) should set SPOTIFY_REFRESH_TOKEN directly
  // as an environment variable — copy it from the /api/spotify-callback
  // confirmation page after the one-time login. That value never changes
  // per visitor; it's the same token for everyone, forever, until revoked.
  const envToken = process.env.SPOTIFY_REFRESH_TOKEN;
  if (envToken) return { refresh_token: envToken };

  // Local dev fallback: the file /api/spotify-callback wrote to disk.
  try {
    const raw = await fs.readFile(TOKEN_FILE, "utf-8");
    return JSON.parse(raw) as StoredTokens;
  } catch {
    return null;
  }
}

async function getUserAccessToken(): Promise<string> {
  if (accessTokenCache && accessTokenCache.expiresAt > Date.now() + 5_000) {
    return accessTokenCache.token;
  }

  const stored = await readStoredTokens();
  if (!stored?.refresh_token) {
    throw new Error(
      "NOT_CONNECTED: visit /api/spotify-login once in your browser to connect your Spotify account."
    );
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET. Add them to .env.local and restart the dev server."
    );
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: stored.refresh_token,
    }).toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Spotify token refresh failed (${res.status}): ${text}. Try visiting /api/spotify-login again.`
    );
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  };

  // Spotify sometimes rotates the refresh token on use — persist the new one
  // to disk when we're relying on the local file. (When SPOTIFY_REFRESH_TOKEN
  // is set via env var, there's nothing writable to update automatically —
  // this practically never happens for this flow, but if it ever does,
  // re-run the login step and update the env var by hand.)
  if (
    data.refresh_token &&
    data.refresh_token !== stored.refresh_token &&
    !process.env.SPOTIFY_REFRESH_TOKEN
  ) {
    try {
      await fs.writeFile(
        TOKEN_FILE,
        JSON.stringify({ refresh_token: data.refresh_token }, null, 2),
        "utf-8"
      );
    } catch {
      // Read-only filesystem (e.g. some hosts) — safe to ignore.
    }
  }

  accessTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return accessTokenCache.token;
}

// Spotify's Feb 2026 rewrite didn't just move /tracks to /items — the field
// nested inside each entry was renamed from "track" to "item" too.
type SpotifyApiItem = {
  item: {
    uri: string;
    name: string;
    duration_ms: number;
    artists: { name: string }[];
    album?: { images?: { url: string }[] };
  } | null;
};

async function fetchAllTracks(token: string): Promise<SpotifyTrack[]> {
  const tracks: SpotifyTrack[] = [];

  let url: string | null =
    `https://api.spotify.com/v1/playlists/${PLAYLIST_ID}/items` +
    `?fields=next,items(item(uri,name,duration_ms,artists(name),album(images)))&limit=50`;

  while (url) {
    const res: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Spotify playlist request failed (${res.status}): ${text}`);
    }

    const data: { items: SpotifyApiItem[]; next: string | null } = await res.json();

    for (const entry of data.items ?? []) {
      const track = entry?.item;
      if (!track || !track.uri || track.uri.startsWith("spotify:local")) continue;

      tracks.push({
        uri: track.uri,
        name: track.name ?? "Untitled",
        artist:
          (track.artists ?? []).map((a) => a.name).join(", ") || "Unknown artist",
        image: track.album?.images?.[0]?.url ?? null,
        durationMs: track.duration_ms ?? 0,
      });
    }

    url = data.next ?? null;
  }

  return tracks;
}

export async function GET() {
  try {
    if (playlistCache && Date.now() - playlistCache.fetchedAt < PLAYLIST_CACHE_TTL_MS) {
      return NextResponse.json({ tracks: playlistCache.tracks });
    }

    const token = await getUserAccessToken();
    const tracks = await fetchAllTracks(token);

    if (tracks.length === 0) {
      // TEMP DEBUGGING — remove once we know why this playlist returns
      // zero parsed tracks. Fetches the raw first page with no `fields`
      // filter so we can see exactly what Spotify sends back.
      const rawRes = await fetch(
        `https://api.spotify.com/v1/playlists/${PLAYLIST_ID}/items?limit=5`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const rawText = await rawRes.text();
      return NextResponse.json({
        tracks: [],
        _debugStatus: rawRes.status,
        _debugRaw: rawText.slice(0, 4000),
      });
    }

    playlistCache = { tracks, fetchedAt: Date.now() };

    return NextResponse.json({ tracks });
  } catch (err) {
    console.error("[spotify-playlist]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error", tracks: [] },
      { status: 500 }
    );
  }
}
