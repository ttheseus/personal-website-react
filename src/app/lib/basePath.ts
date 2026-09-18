// app/lib/basePath.ts
//
// GitHub Pages serves this repo at a sub-path (https://ttheseus.github.io/personal-website-react/),
// not the domain root, so every absolute reference to a static asset or an
// API route needs that sub-path prefixed on it or it 404s once deployed.
//
// next.config.ts only turns this on for production builds (`next build`) —
// local dev (`next dev`) stays prefix-free, so http://127.0.0.1:3000/ keeps
// working exactly as it does today. Keep this string in sync with the
// `basePath` in next.config.ts.
export const BASE_PATH = process.env.NODE_ENV === "production" ? "/personal-website-react" : "";

// Prefixes an absolute local path (e.g. "/assets/foo.png", "/api/bar") with
// the base path. Leaves external URLs (http://, https://, data:) untouched.
export function withBasePath(path: string): string {
  if (!path.startsWith("/")) return path;
  return `${BASE_PATH}${path}`;
}
