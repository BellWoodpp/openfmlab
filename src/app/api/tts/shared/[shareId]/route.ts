import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { ttsGenerations, ttsShares } from "@/lib/db/schema/tts";
import { siteConfig } from "@/lib/site-config";
import { isR2Configured, r2GetObject } from "@/lib/storage/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isUndefinedColumnError(err: unknown, column: string): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  const message = (err as { message?: unknown }).message;
  if (code === "42703") return typeof message === "string" ? message.includes(column) : true;
  return typeof message === "string" && message.includes(`column \"${column}\" does not exist`);
}

function safeFilenamePart(value: string): string {
  return value.replace(/[^\w\-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "voice";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ shareId: string }> },
) {
  if (!process.env.DATABASE_URL) {
    return Response.json(
      { error: "Sharing is disabled. Set DATABASE_URL and run migrations to enable it." },
      { status: 501 },
    );
  }

  const { shareId } = await params;

  let rows: Array<{
    audio: Buffer | null;
    audioKey?: string | null;
    mimeType: string;
    voice: string;
    generationId: string;
    title?: string | null;
  }> = [];
  try {
    rows = await db
      .select({
        audio: ttsGenerations.audio,
        audioKey: ttsGenerations.audioKey,
        mimeType: ttsGenerations.mimeType,
        voice: ttsGenerations.voice,
        title: ttsGenerations.title,
        generationId: ttsGenerations.id,
      })
      .from(ttsShares)
      .innerJoin(ttsGenerations, eq(ttsShares.generationId, ttsGenerations.id))
      .where(eq(ttsShares.id, shareId))
      .limit(1);
  } catch (err) {
    if (isUndefinedColumnError(err, "audio_key")) {
      try {
        rows = await db
          .select({
            audio: ttsGenerations.audio,
            mimeType: ttsGenerations.mimeType,
            voice: ttsGenerations.voice,
            title: ttsGenerations.title,
            generationId: ttsGenerations.id,
          })
          .from(ttsShares)
          .innerJoin(ttsGenerations, eq(ttsShares.generationId, ttsGenerations.id))
          .where(eq(ttsShares.id, shareId))
          .limit(1);
      } catch (err2) {
        if (!isUndefinedColumnError(err2, "title")) throw err2;
        rows = await db
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
      }
    } else {
      if (!isUndefinedColumnError(err, "title")) throw err;
      rows = await db
        .select({
          audio: ttsGenerations.audio,
          audioKey: ttsGenerations.audioKey,
          mimeType: ttsGenerations.mimeType,
          voice: ttsGenerations.voice,
          generationId: ttsGenerations.id,
        })
        .from(ttsShares)
        .innerJoin(ttsGenerations, eq(ttsShares.generationId, ttsGenerations.id))
        .where(eq(ttsShares.id, shareId))
        .limit(1);
    }
  }

  const found = rows[0];
  if (!found) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const nameBase = safeFilenamePart(typeof found.title === "string" && found.title.trim() ? found.title : found.voice);
  const filename = `${siteConfig.downloadPrefix}-${nameBase}-${found.generationId}.mp3`;

  const mimeType = found.mimeType || "audio/mpeg";
  const baseHeaders: HeadersInit = {
    "Content-Type": mimeType,
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": `inline; filename="${filename}"`,
  };

  const hasInlineAudio = found.audio && Buffer.byteLength(found.audio) > 0;
  const audioKey = typeof found.audioKey === "string" && found.audioKey.trim() ? found.audioKey.trim() : null;

  if (!hasInlineAudio && audioKey) {
    if (!isR2Configured()) {
      return Response.json({ error: "Audio is stored in object storage but R2 is not configured." }, { status: 500 });
    }
    const r2Res = await r2GetObject({ key: audioKey, range: null });
    const contentLength = r2Res.headers.get("content-length");
    return new Response(r2Res.body, {
      headers: {
        ...baseHeaders,
        ...(contentLength ? { "Content-Length": contentLength } : {}),
      },
    });
  }

  if (!hasInlineAudio) {
    return Response.json({ error: "Audio blob is missing." }, { status: 500 });
  }

  return new Response(new Uint8Array(found.audio as Buffer), { headers: baseHeaders });
}
