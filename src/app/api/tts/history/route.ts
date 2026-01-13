import { NextRequest, NextResponse } from "next/server";
import { desc, eq, and, lt, inArray, sql } from "drizzle-orm";

import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { ttsGenerations } from "@/lib/db/schema/tts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isUndefinedColumnError(err: unknown, column: string): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  const message = (err as { message?: unknown }).message;
  if (code === "42703") return typeof message === "string" ? message.includes(column) : true;
  return typeof message === "string" && message.includes(`column \"${column}\" does not exist`);
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.floor(n);
}

function intParam(value: string | null, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

const POLICY = {
  maxItems: Math.max(1, envInt("TTS_HISTORY_MAX_ITEMS", 20)),
  maxDays: Math.max(1, envInt("TTS_HISTORY_MAX_DAYS", 7)),
  maxTotalBytes: Math.max(1, envInt("TTS_HISTORY_MAX_TOTAL_BYTES", 50 * 1024 * 1024)),
};

async function applyRetention(userId: string): Promise<{ deletedOld: number; deletedOverflow: number }> {
  const cutoff = new Date(Date.now() - POLICY.maxDays * 24 * 60 * 60 * 1000);
  const deletedOldRows = await db
    .delete(ttsGenerations)
    .where(and(eq(ttsGenerations.userId, userId), lt(ttsGenerations.createdAt, cutoff)))
    .returning({ id: ttsGenerations.id });

  let deletedOverflow = 0;
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
    deletedOverflow += overflow.length;
  }

  return { deletedOld: deletedOldRows.length, deletedOverflow };
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

export async function GET(req: NextRequest) {
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

  await applyRetention(userId);

  const { searchParams } = new URL(req.url);
  const limit = intParam(searchParams.get("limit"), 20, 1, 100);
  const offset = intParam(searchParams.get("offset"), 0, 0, 10_000);

  let rows: Array<{
    id: string;
    createdAt: Date;
    input: string;
    voice: string;
    tone: string;
    format: string;
    mimeType: string;
    title?: string | null;
  }> = [];

  try {
    rows = await db
      .select({
        id: ttsGenerations.id,
        createdAt: ttsGenerations.createdAt,
        title: ttsGenerations.title,
        input: ttsGenerations.input,
        voice: ttsGenerations.voice,
        tone: ttsGenerations.tone,
        format: ttsGenerations.format,
        mimeType: ttsGenerations.mimeType,
      })
      .from(ttsGenerations)
      .where(eq(ttsGenerations.userId, userId))
      .orderBy(desc(ttsGenerations.createdAt))
      .limit(limit)
      .offset(offset);
  } catch (err) {
    if (!isUndefinedColumnError(err, "title")) throw err;
    rows = await db
      .select({
        id: ttsGenerations.id,
        createdAt: ttsGenerations.createdAt,
        input: ttsGenerations.input,
        voice: ttsGenerations.voice,
        tone: ttsGenerations.tone,
        format: ttsGenerations.format,
        mimeType: ttsGenerations.mimeType,
      })
      .from(ttsGenerations)
      .where(eq(ttsGenerations.userId, userId))
      .orderBy(desc(ttsGenerations.createdAt))
      .limit(limit)
      .offset(offset);
  }

  const usage = await getUsage(userId);

  return NextResponse.json({
    items: rows.map((r) => ({
      ...r,
      audioUrl: `/api/tts/audio/${r.id}`,
    })),
    policy: {
      maxItems: POLICY.maxItems,
      maxDays: POLICY.maxDays,
      maxTotalBytes: POLICY.maxTotalBytes,
    },
    usage,
    pagination: {
      limit,
      offset,
      hasMore: rows.length === limit,
    },
  });
}

export async function DELETE(req: NextRequest) {
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

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    // allow empty body
  }

  const all = Boolean((body as { all?: unknown })?.all);
  const idRaw = (body as { id?: unknown })?.id;
  const id = typeof idRaw === "string" ? idRaw.trim() : "";

  if (all) {
    await db.delete(ttsGenerations).where(eq(ttsGenerations.userId, userId));
  } else if (id) {
    await db
      .delete(ttsGenerations)
      .where(and(eq(ttsGenerations.userId, userId), eq(ttsGenerations.id, id)));
  } else {
    return NextResponse.json({ error: "Missing delete target" }, { status: 400 });
  }

  const usage = await getUsage(userId);
  return NextResponse.json({ ok: true, usage });
}
