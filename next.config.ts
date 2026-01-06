import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
    // In dev we prefer avoiding the image optimizer (it can time out on remote hosts).
    unoptimized: process.env.NODE_ENV === "development",
    // Needed for placeholder endpoints that return SVG (e.g. /api/placeholder/*).
    // Keep a strict CSP to reduce SVG-related risk when optimization is enabled.
    dangerouslyAllowSVG: true,
    contentSecurityPolicy:
      "default-src 'none'; img-src 'self' https: data:; sandbox;",
  },
};

export default nextConfig;
