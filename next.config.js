/** @type {import('next').NextConfig} */

// GitHub Pages serves this repo from https://<user>.github.io/<repo>/, so every
// asset URL needs the repo name prefixed or the page loads with no CSS or JS.
// Gated on an env var the deploy workflow sets, so `npm run dev` stays at "/".
// If you rename the repository, change `repo` to match or the deploy breaks.
const repo = "gtm-engine-pb2026";
const isPages = process.env.GITHUB_PAGES === "true";

const nextConfig = {
  reactStrictMode: true,
  // The whole app is client-side — no API routes, no server fetching — so it
  // exports to static files and needs no running server.
  output: "export",
  basePath: isPages ? `/${repo}` : "",
  assetPrefix: isPages ? `/${repo}/` : "",
};

module.exports = nextConfig;
