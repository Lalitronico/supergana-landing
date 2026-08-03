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
  // Dev-only: lets a phone on the same Wi-Fi load dev-mode JS for the mobile
  // pass. Without it Next blocks cross-origin dev assets and the page reaches
  // the phone as HTML that never hydrates — dead buttons, eternal "Cargando".
  allowedDevOrigins: ["192.168.1.19"],
  // Kept for the asset() helpers that used to prefix GitHub Pages paths.
  env: {
    NEXT_PUBLIC_BASE_PATH: "",
  },
};

export default nextConfig;
