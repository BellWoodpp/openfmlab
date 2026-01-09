import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";

import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { ttsGenerations } from "@/lib/db/schema/tts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.floor(n);
}

const POLICY = {
  maxItems: Math.max(1, envInt("TTS_HISTORY_MAX_ITEMS", 20)),
  maxDays: Math.max(1, envInt("TTS_HISTORY_MAX_DAYS", 7)),
  maxTotalBytes: Math.max(1, envInt("TTS_HISTORY_MAX_TOTAL_BYTES", 50 * 1024 * 1024)),
};

async function applyRetention(userId: string): Promise<void> {
  const cutoff = new Date(Date.now() - POLICY.maxDays * 24 * 60 * 60 * 1000);
  await db
    .delete(ttsGenerations)
    .where(and(eq(ttsGenerations.userId, userId), lt(ttsGenerations.createdAt, cutoff)));

  while (true) {
    const overflow = await db
      .select({ id: ttsGenerations.id })
      .from(ttsGenerations)
      .where(eq(ttsGenerations.userId, userId))
      .orderBy(desc(ttsGenerations.createdAt))
      .offset(POLICY.maxItems)
      .limit(200);

    if (overflow.length === 0) break;
    await db.delete(ttsGenerations).where(inArray(ttsGenerations.id, overflow.map((r) => r.id)));
  }
}

async function getUsage(userId: string): Promise<{ totalItems: number; totalBytes: number }> {
  const [row] = await db
    .select({
      totalItems: sql<number>`count(*)::int`,
      totalBytes: sql<number>`coalesce(sum(octet_length(${ttsGenerations.audio})), 0)::bigint`,
    })
    .from(ttsGenerations)
    .where(eq(ttsGenerations.userId, userId));

  return {
    totalItems: row?.totalItems ?? 0,
    totalBytes: Number(row?.totalBytes ?? 0),
  };
}

function isAudioFile(file: File): boolean {
  const t = (file.type || "").toLowerCase();
  if (t.startsWith("audio/")) return true;
  const name = file.name.toLowerCase();
  return name.endsWith(".mp3") || name.endsWith(".wav") || name.endsWith(".ogg") || name.endsWith(".m4a") || name.endsWith(".webm");
}

export async function POST(req: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "History is disabled. Set DATABASE_URL and run migrations to enable it." },
      { status: 501 },
    );
  }

  const session = await auth.api.getSession({ headers: req.headers });
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "no auth, please sign-in" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (!isAudioFile(file)) {
    return NextResponse.json({ error: "Unsupported audio file" }, { status: 400 });
  }

  // Keep this aligned with UI: 10MB per file.
  const maxBytes = 10 * 1024 * 1024;
  if (file.size > maxBytes) {
    return NextResponse.json({ error: `File too large (max ${maxBytes} bytes)` }, { status: 400 });
  }

  const input = normalizeString(form.get("input")) || "Recording sample";
  const voice = normalizeString(form.get("voice")) || "mic-recording";
  const mimeType = normalizeString(file.type) || "audio/wav";
  const format = mimeType.includes("wav")
    ? "wav"
    : mimeType.includes("ogg")
      ? "ogg"
      : mimeType.includes("webm")
        ? "webm"
        : mimeType.includes("mp3") || mimeType.includes("mpeg")
          ? "mp3"
          : "audio";

  const id = nanoid(12);
  const audioBytes = Buffer.from(await file.arrayBuffer());

  try {
    await applyRetention(userId);

    const [inserted] = await db
      .insert(ttsGenerations)
      .values({
        id,
        userId,
        input: input.slice(0, 5000),
        voice: voice.slice(0, 256),
        tone: "neutral",
        speakingRateMode: "auto",
        speakingRate: null,
        volumeGainDb: 0,
        format,
        mimeType,
        audio: audioBytes,
      })
      .returning({ createdAt: ttsGenerations.createdAt });

    await applyRetention(userId);

    const usage = await getUsage(userId);
    if (usage.totalBytes > POLICY.maxTotalBytes) {
      await db.delete(ttsGenerations).where(and(eq(ttsGenerations.userId, userId), eq(ttsGenerations.id, id)));
      return NextResponse.json(
        {
          error: "Storage quota exceeded. Please delete some history and try again.",
          code: "QUOTA_EXCEEDED",
          policy: POLICY,
          usage,
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      id,
      audioUrl: `/api/tts/audio/${id}`,
      createdAt: inserted?.createdAt ? inserted.createdAt.toISOString() : null,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to upload audio" },
      { status: 502 },
    );
  }
}

