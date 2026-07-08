import type { NextConfig } from "next";

// The site deploys to Vercel (supergana.fun). Static export was removed on
// 2026-07-07 to enable the API routes of the Mundial x Rotary campaign
// (Stripe webhook, ticket validation, admin panel). Pages without dynamic
// data are still statically generated at build time.
const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  // Kept for the asset() helpers that used to prefix GitHub Pages paths.
  env: {
    NEXT_PUBLIC_BASE_PATH: "",
  },
};

export default nextConfig;
