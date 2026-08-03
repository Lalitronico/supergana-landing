import os from "node:os";
import type { NextConfig } from "next";

/**
 * Every IPv4 address this machine answers on, for `allowedDevOrigins`.
 *
 * Without it Next blocks cross-origin requests to dev-only assets and the page
 * reaches the phone as HTML that never hydrates — dead buttons, eternal
 * "Cargando". This used to be one hardcoded address, which is exactly the kind
 * of value that goes stale silently: the entry said 192.168.1.19 and the laptop
 * had long since moved to another network, so the mobile pass broke in a way
 * that looks like a bug in the app.
 *
 * Reading the interfaces means it covers whatever network the laptop is on today
 * — LAN, hotspot, and the Tailscale address, which is often the only one that
 * works when the Wi-Fi is classed Public and Windows Firewall drops inbound.
 *
 * Dev only. `allowedDevOrigins` is ignored by `next build`, and the guard keeps
 * a Vercel build from enumerating its container's interfaces for nothing.
 */
const devOrigins = (): string[] => {
  if (process.env.NODE_ENV !== "development") return [];
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((iface) => iface && iface.family === "IPv4" && !iface.internal)
    .map((iface) => iface!.address);
};

// The site deploys to Vercel (supergana.fun). Static export was removed on
// 2026-07-07 to enable the API routes of the Mundial x Rotary campaign
// (Stripe webhook, ticket validation, admin panel). Pages without dynamic
// data are still statically generated at build time.
const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  // Dev-only: lets a phone reach the dev server for the mobile pass.
  allowedDevOrigins: devOrigins(),
  // Kept for the asset() helpers that used to prefix GitHub Pages paths.
  env: {
    NEXT_PUBLIC_BASE_PATH: "",
  },
};

export default nextConfig;
