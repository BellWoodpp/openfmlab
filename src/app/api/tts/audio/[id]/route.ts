import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { ttsGenerations } from "@/lib/db/schema/tts";
import { siteConfig } from "@/lib/site-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeFilenamePart(value: string): string {
  return value.replace(/[^\w\-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "voice";
}

function fileExtensionFromMimeType(mimeType: string | null): string {
  const t = (mimeType || "").toLowerCase();
  if (t.includes("wav")) return "wav";
  if (t.includes("ogg")) return "ogg";
  if (t.includes("webm")) return "webm";
  if (t.includes("mpeg") || t.includes("mp3")) return "mp3";
  return "bin";
}

function parseRangeHeader(range: string | null, size: number): { start: number; end: number } | null {
  if (!range) return null;
  const m = /^bytes=(\d*)-(\d*)$/i.exec(range.trim());
  if (!m) return null;

  const startRaw = m[1];
  const endRaw = m[2];

  if (!startRaw && !endRaw) return null;

  if (startRaw && !endRaw) {
    const start = Number(startRaw);
    if (!Number.isFinite(start) || start < 0) return null;
    return { start, end: size - 1 };
  }

  if (!startRaw && endRaw) {
    const suffixLength = Number(endRaw);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return null;
    const length = Math.min(size, Math.floor(suffixLength));
    return { start: Math.max(0, size - length), end: size - 1 };
  }

  const start = Number(startRaw);
  const end = Number(endRaw);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start < 0 || end < start) return null;
  return { start: Math.floor(start), end: Math.floor(end) };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!process.env.DATABASE_URL) {
    return Response.json(
      { error: "TTS history is disabled. Set DATABASE_URL and run migrations to enable it." },
      { status: 501 },
    );
  }

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

  const mimeType = found.mimeType || "audio/mpeg";
  const ext = fileExtensionFromMimeType(mimeType);
  const filename = `${siteConfig.downloadPrefix}-${safeFilenamePart(found.voice)}-${id}.${ext}`;

  const audioBuffer = Buffer.from(found.audio);
  const size = audioBuffer.length;
  const range = parseRangeHeader(req.headers.get("range"), size);

  const baseHeaders: HeadersInit = {
    "Content-Type": mimeType,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": `inline; filename="${filename}"`,
    "Accept-Ranges": "bytes",
  };

  if (!range) {
    return new Response(audioBuffer, {
      headers: {
        ...baseHeaders,
        "Content-Length": String(size),
      },
    });
  }

  const start = Math.max(0, range.start);
  const end = Math.min(size - 1, range.end);

  if (size === 0 || start >= size) {
    return new Response(null, {
      status: 416,
      headers: {
        ...baseHeaders,
        "Content-Range": `bytes */${size}`,
      },
    });
  }

  const chunk = audioBuffer.subarray(start, end + 1);
  return new Response(chunk, {
    status: 206,
    headers: {
      ...baseHeaders,
      "Content-Length": String(chunk.length),
      "Content-Range": `bytes ${start}-${end}/${size}`,
    },
  });
}
