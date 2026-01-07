import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { ttsGenerations } from "@/lib/db/schema/tts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers });
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ error: "no auth, please sign-in" }, { status: 401 });
  }

  const { id } = await params;

  const rows = await db
    .select({
      audio: ttsGenerations.audio,
      mimeType: ttsGenerations.mimeType,
      voice: ttsGenerations.voice,
    })
    .from(ttsGenerations)
    .where(and(eq(ttsGenerations.id, id), eq(ttsGenerations.userId, userId)))
    .limit(1);

  const found = rows[0];
  if (!found) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const filename = `voiceslab-${found.voice}-${id}.mp3`;
  return new Response(new Uint8Array(found.audio), {
    headers: {
      "Content-Type": found.mimeType || "audio/mpeg",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
