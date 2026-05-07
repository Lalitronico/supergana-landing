import type { NextConfig } from "next";

// GitHub Pages serves under /<repo-name>/ — set GITHUB_PAGES=true at build time
// to apply basePath/assetPrefix. Local dev (npm run dev) keeps clean URLs.
const isGithubPages = process.env.GITHUB_PAGES === "true";
const repo = "supergana-landing";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  basePath: isGithubPages ? `/${repo}` : "",
  assetPrefix: isGithubPages ? `/${repo}/` : "",
  trailingSlash: true,
};

export default nextConfig;
