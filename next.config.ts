import type { NextConfig } from "next";

function assetRemotePatterns(): Array<{ protocol: "http" | "https"; hostname: string }> {
  const patterns: Array<{ protocol: "http" | "https"; hostname: string }> = [];

  // Allow the configured public asset host (e.g. Cloudflare R2 public domain).
  const base = process.env.NEXT_PUBLIC_ASSET_BASE_URL?.trim();
  if (base) {
    try {
      const url = new URL(base);
      const protocol = url.protocol === "http:" ? "http" : "https";
      patterns.push({ protocol, hostname: url.hostname });
    } catch {
      // ignore invalid URL
    }
  }

  // Allow common RTVox asset hosts (covers r2.rtvox.com, assets.rtvox.com, etc).
  patterns.push({ protocol: "https", hostname: "**.rtvox.com" });

  return patterns;
}

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: assetRemotePatterns(),
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
