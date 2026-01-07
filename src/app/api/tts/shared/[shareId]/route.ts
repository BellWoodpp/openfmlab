import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { ttsGenerations, ttsShares } from "@/lib/db/schema/tts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ shareId: string }> },
) {
  const { shareId } = await params;

  const rows = await db
    .select({
      audio: ttsGenerations.audio,
      mimeType: ttsGenerations.mimeType,
      voice: ttsGenerations.voice,
      generationId: ttsGenerations.id,
    })
    .from(ttsShares)
    .innerJoin(ttsGenerations, eq(ttsShares.generationId, ttsGenerations.id))
    .where(eq(ttsShares.id, shareId))
    .limit(1);

  const found = rows[0];
  if (!found) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const filename = `voiceslab-${found.voice}-${found.generationId}.mp3`;
  return new Response(new Uint8Array(found.audio), {
    headers: {
      "Content-Type": found.mimeType || "audio/mpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
