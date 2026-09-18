import type { NextConfig } from "next";

// This repo deploys to GitHub Pages at a sub-path
// (https://ttheseus.github.io/personal-website-react/), not the domain
// root, and GitHub Pages only serves static files — no Node server, no API
// routes at request time. `next build` (NODE_ENV=production) therefore
// needs a fully static export with that sub-path baked in as `basePath`.
//
// `next dev` (NODE_ENV=development) is untouched by the isProd branch below,
// so local development keeps working exactly as before at
// http://127.0.0.1:3000/ with no prefix and live API routes.
//
// If this ever moves to a custom domain (served from the root) or a
// differently-named repo, update BASE_PATH here and in
// src/app/lib/basePath.ts to match.
const isProd = process.env.NODE_ENV === "production";
const BASE_PATH = "/personal-website-react";

const nextConfig: NextConfig = {
  ...(isProd
    ? {
        output: "export" as const,
        basePath: BASE_PATH,
        assetPrefix: `${BASE_PATH}/`,
        trailingSlash: true,
      }
    : {}),
  // Static export can't run Next's image optimization server, and it's
  // simplest to just skip it in dev too so behavior matches.
  images: { unoptimized: true },
};

export default nextConfig;
