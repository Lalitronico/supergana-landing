import type { NextConfig } from "next";

// GitHub Pages serves under /<repo-name>/ — set GITHUB_PAGES=true at build time
// to apply basePath/assetPrefix. Local dev (npm run dev) keeps clean URLs.
const isGithubPages = process.env.GITHUB_PAGES === "true";
const repo = "supergana-landing";
const basePath = isGithubPages ? `/${repo}` : "";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  basePath,
  assetPrefix: isGithubPages ? `/${repo}/` : "",
  trailingSlash: true,
  // Expose basePath to the client so we can manually prefix asset URLs
  // (Next 16 + output:export + unoptimized images doesn't auto-prefix <Image src>).
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
