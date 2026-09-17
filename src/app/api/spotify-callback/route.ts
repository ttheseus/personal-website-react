// app/api/spotify-callback/route.ts
//
// Spotify redirects here after you approve access in /api/spotify-login.
// Exchanges the code for a refresh token and saves it to a local file
// (.spotify-tokens.json, gitignored) that /api/spotify-playlist reads from
// on every request going forward. This route only ever runs on your own
// machine during setup — visitors never hit it.
//
// DEV-ONLY — DELETE THIS FOLDER BEFORE A STATIC EXPORT BUILD (GitHub Pages).
// It reads a live query string and writes a file at request time, which
// `output: "export"` can't support. Delete it (and src/app/api/spotify-login)
// once you've completed the login and confirmed /api/spotify-playlist works.

import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

const TOKEN_FILE = path.join(process.cwd(), ".spotify-tokens.json");

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const authError = req.nextUrl.searchParams.get("error");

  if (authError) {
    return new NextResponse(`Spotify authorization failed: ${authError}`, { status: 400 });
  }
  if (!code) {
    return new NextResponse("Missing authorization code.", { status: 400 });
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri =
    process.env.SPOTIFY_REDIRECT_URI ?? `${req.nextUrl.origin}/api/spotify-callback`;

  if (!clientId || !clientSecret) {
    return new NextResponse(
      "Missing SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET in .env.local.",
      { status: 500 }
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
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }).toString(),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    return new NextResponse(`Token exchange failed (${res.status}): ${text}`, { status: 500 });
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  let savedToDisk = true;
  try {
    await fs.writeFile(
      TOKEN_FILE,
      JSON.stringify({ refresh_token: data.refresh_token }, null, 2),
      "utf-8"
    );
  } catch {
    // Read-only filesystem (e.g. serverless hosts) — fine, they'll use the
    // env var shown below instead.
    savedToDisk = false;
  }

  return new NextResponse(
    `<!doctype html>
<html>
  <head><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
  <body style="font-family:sans-serif;background:#0a0f18;color:#f2eef5;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;">
    <div style="max-width:640px;text-align:center;">
      <h2>Spotify connected ✓</h2>
      ${
        savedToDisk
          ? "<p>Saved locally for this dev server — you're all set here.</p>"
          : "<p>Couldn't write a local file on this host, but that's fine — use the env var below.</p>"
      }
      <p style="margin-top:24px;">To make this work on your <strong>deployed</strong> site (Vercel, etc.), copy this value into that host's environment variables as <code>SPOTIFY_REFRESH_TOKEN</code>, then redeploy:</p>
      <textarea readonly onclick="this.select()" style="width:100%;height:70px;margin-top:10px;padding:10px;font-family:monospace;font-size:13px;background:#151b26;color:#faccd0;border:1px solid #935ba8;border-radius:8px;">${data.refresh_token}</textarea>
      <p style="margin-top:16px;font-size:13px;opacity:0.7;">Keep this private — anyone with it can read this Spotify account's playlists. You only need to do this once; it doesn't expire on its own.</p>
      <p style="margin-top:24px;"><a href="/" style="color:#faccd0;">← Back to the site</a></p>
    </div>
  </body>
</html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
