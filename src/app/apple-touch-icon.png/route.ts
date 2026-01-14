import { NextResponse } from "next/server";

import { assetUrl } from "@/lib/asset-url";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.redirect(assetUrl("/photo/text-to-speech.png"));
}

