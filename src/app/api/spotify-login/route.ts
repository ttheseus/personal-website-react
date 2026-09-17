// app/api/spotify-login/route.ts
//
// One-time setup route: visit this in your browser once (as the account
// that owns the playlist) to authorize the app. Spotify changed its API in
// Feb 2026 so that reading a playlist's tracks requires a user-authorized
// token belonging to the playlist's owner — an app-only token is no longer
// enough. This kicks off that authorization.
//
// DEV-ONLY — DELETE THIS FOLDER BEFORE A STATIC EXPORT BUILD (GitHub Pages).
// It reads a live query string, which `output: "export"` can't support.
// Run the login once locally, confirm /api/spotify-playlist returns real
// tracks, THEN delete src/app/api/spotify-login and
// src/app/api/spotify-callback before building for GitHub Pages.

import { NextRequest, NextResponse } from "next/server";

const SCOPES = ["playlist-read-private", "playlist-read-collaborative"].join(" ");

export async function GET(req: NextRequest) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;

  if (!clientId) {
    return new NextResponse(
      "Missing SPOTIFY_CLIENT_ID. Add it to .env.local and restart the dev server.",
      { status: 500 }
    );
  }

  const redirectUri =
    process.env.SPOTIFY_REDIRECT_URI ?? `${req.nextUrl.origin}/api/spotify-callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: SCOPES,
  });

  return NextResponse.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
}
