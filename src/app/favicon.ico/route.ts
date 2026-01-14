import { NextResponse } from "next/server";

import { assetUrl } from "@/lib/asset-url";

export const runtime = "nodejs";

export function GET() {
  // Browsers often request /favicon.ico directly (ignoring <link rel="icon">),
  // so redirect it to the configured public asset host (R2 custom domain).
  return NextResponse.redirect(assetUrl("/photo/text-to-speech.ico"));
}

