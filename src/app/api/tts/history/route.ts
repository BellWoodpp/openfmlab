import { NextRequest, NextResponse } from "next/server";
import { desc, eq, and, lt, inArray, sql } from "drizzle-orm";

import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { ttsGenerations } from "@/lib/db/schema/tts";
import { inferGoogleBillingTier, type TtsBillingTier, type TtsProvider } from "@/lib/tts";
import { estimateTokensForRequest } from "@/lib/tts-tokens";
import { isR2Configured, r2DeleteObjects } from "@/lib/storage/r2";

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

function guessProviderAndTierFromVoiceInput(voiceInput: string): { provider: TtsProvider; billingTier: TtsBillingTier } {
  const v = (voiceInput || "").trim();
  if (v.startsWith("azure:")) return { provider: "azure", billingTier: "azure" };
  if (v.startsWith("elevenlabs:")) return { provider: "elevenlabs", billingTier: "elevenlabs" };
  if (v.startsWith("clone:")) return { provider: "google", billingTier: "chirp-voice-cloning" };
  if (/^[a-z]{2,3}-[A-Z]{2}-/.test(v)) return { provider: "google", billingTier: inferGoogleBillingTier(v) };
  return { provider: "openai", billingTier: "openai" };
}

async function applyRetention(userId: string): Promise<{ deletedOld: number; deletedOverflow: number }> {
  const cutoff = new Date(Date.now() - POLICY.maxDays * 24 * 60 * 60 * 1000);
  const deletedOldKeys: string[] = [];
  const deletedOldRows = await (async () => {
    try {
      const rows = await db
        .delete(ttsGenerations)
        .where(and(eq(ttsGenerations.userId, userId), lt(ttsGenerations.createdAt, cutoff)))
        .returning({ id: ttsGenerations.id, audioKey: ttsGenerations.audioKey });
      for (const r of rows) {
        if (typeof r.audioKey === "string" && r.audioKey.trim()) deletedOldKeys.push(r.audioKey.trim());
      }
      return rows;
    } catch (err) {
      if (!isUndefinedColumnError(err, "audio_key")) throw err;
      return await db
        .delete(ttsGenerations)
        .where(and(eq(ttsGenerations.userId, userId), lt(ttsGenerations.createdAt, cutoff)))
        .returning({ id: ttsGenerations.id });
    }
  })();

  if (deletedOldKeys.length && isR2Configured()) {
    try {
      await r2DeleteObjects(deletedOldKeys);
    } catch {
      // ignore (best-effort cleanup)
    }
  }

  let deletedOverflow = 0;
  while (true) {
    const overflow = await (async () => {
      try {
        return await db
          .select({ id: ttsGenerations.id, audioKey: ttsGenerations.audioKey })
          .from(ttsGenerations)
          .where(eq(ttsGenerations.userId, userId))
          .orderBy(desc(ttsGenerations.createdAt))
          .offset(POLICY.maxItems)
          .limit(200);
      } catch (err) {
        if (!isUndefinedColumnError(err, "audio_key")) throw err;
        return await db
          .select({ id: ttsGenerations.id })
          .from(ttsGenerations)
          .where(eq(ttsGenerations.userId, userId))
          .orderBy(desc(ttsGenerations.createdAt))
          .offset(POLICY.maxItems)
          .limit(200);
      }
    })();

    if (overflow.length === 0) break;

    await db.delete(ttsGenerations).where(inArray(ttsGenerations.id, overflow.map((r) => r.id)));
    deletedOverflow += overflow.length;

    const keys = overflow
      .map((r) => (r as { audioKey?: unknown }).audioKey)
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .map((v) => v.trim());
    if (keys.length && isR2Configured()) {
      try {
        await r2DeleteObjects(keys);
      } catch {
        // ignore (best-effort cleanup)
      }
    }
  }

  return { deletedOld: deletedOldRows.length, deletedOverflow };
}

async function getUsage(userId: string): Promise<{ totalItems: number; totalBytes: number }> {
  const [row] = await (async () => {
    try {
      return await db
        .select({
          totalItems: sql<number>`count(*)::int`,
          totalBytes: sql<number>`coalesce(sum(coalesce(${ttsGenerations.audioSize}, octet_length(${ttsGenerations.audio}))), 0)::bigint`,
        })
        .from(ttsGenerations)
        .where(eq(ttsGenerations.userId, userId));
    } catch (err) {
      if (!isUndefinedColumnError(err, "audio_size")) throw err;
      return await db
        .select({
          totalItems: sql<number>`count(*)::int`,
          totalBytes: sql<number>`coalesce(sum(octet_length(${ttsGenerations.audio})), 0)::bigint`,
        })
        .from(ttsGenerations)
        .where(eq(ttsGenerations.userId, userId));
    }
  })();

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
      tokensUsed: estimateTokensForRequest({
        ...guessProviderAndTierFromVoiceInput(r.voice),
        chars: r.input.length,
      }).tokens,
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
    const keys = await (async () => {
      try {
        const rows = await db
          .select({ audioKey: ttsGenerations.audioKey })
          .from(ttsGenerations)
          .where(eq(ttsGenerations.userId, userId))
          .limit(10_000);
        return rows
          .map((r) => r.audioKey)
          .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
          .map((v) => v.trim());
      } catch (err) {
        if (!isUndefinedColumnError(err, "audio_key")) throw err;
        return [] as string[];
      }
    })();

    await db.delete(ttsGenerations).where(eq(ttsGenerations.userId, userId));
    if (keys.length && isR2Configured()) {
      try {
        await r2DeleteObjects(keys);
      } catch {
        // ignore
      }
    }
  } else if (id) {
    const keys = await (async () => {
      try {
        const rows = await db
          .select({ audioKey: ttsGenerations.audioKey })
          .from(ttsGenerations)
          .where(and(eq(ttsGenerations.userId, userId), eq(ttsGenerations.id, id)))
          .limit(1);
        const key = rows[0]?.audioKey;
        return typeof key === "string" && key.trim() ? [key.trim()] : [];
      } catch (err) {
        if (!isUndefinedColumnError(err, "audio_key")) throw err;
        return [] as string[];
      }
    })();

    await db
      .delete(ttsGenerations)
      .where(and(eq(ttsGenerations.userId, userId), eq(ttsGenerations.id, id)));
    if (keys.length && isR2Configured()) {
      try {
        await r2DeleteObjects(keys);
      } catch {
        // ignore
      }
    }
  } else {
    return NextResponse.json({ error: "Missing delete target" }, { status: 400 });
  }

  const usage = await getUsage(userId);
  return NextResponse.json({ ok: true, usage });
}
