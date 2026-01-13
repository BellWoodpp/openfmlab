import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, sql } from "drizzle-orm";

import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { ttsGenerations } from "@/lib/db/schema/tts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type VoiceTier = "standard" | "wavenet" | "neural2" | "studio" | "chirp3-hd" | "unknown";

function isMissingRelationError(err: unknown, relation: string): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  const message = (err as { message?: unknown }).message;
  const relationName = (err as { relation?: unknown }).relation;
  if (relationName === relation) return true;
  if (code === "42P01") return typeof message === "string" && message.includes(relation);
  return typeof message === "string" && message.includes(`relation \"${relation}\" does not exist`);
}

function classifyVoiceTier(voice: string): VoiceTier {
  const v = voice.toLowerCase();
  if (v.includes("chirp3") || v.includes("chirp3-hd")) return "chirp3-hd";
  if (v.includes("studio")) return "studio";
  if (v.includes("neural2")) return "neural2";
  if (v.includes("wavenet")) return "wavenet";
  if (v.includes("standard")) return "standard";
  return "unknown";
}

function hoursAgo(date: Date, hours: number): Date {
  return new Date(date.getTime() - hours * 60 * 60 * 1000);
}

function startOfHour(date: Date): Date {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  return d;
}

function toHourKey(date: Date): string {
  // ISO hour key (UTC) to keep server deterministic; client can localize display.
  return date.toISOString().slice(0, 13) + ":00:00.000Z";
}

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ ok: false, message: "AUTH_REQUIRED" }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: false, message: "DB_REQUIRED" }, { status: 501 });
  }

  const now = new Date();
  const endHour = startOfHour(now);
  const startHour = hoursAgo(endHour, 24);

  try {
    const hourBucketExpr = sql<string>`date_trunc('hour', ${ttsGenerations.createdAt})`;
    const rows = await db
      .select({
        bucket: hourBucketExpr,
        calls: sql<number>`count(*)::int`,
        chars: sql<number>`coalesce(sum(length(${ttsGenerations.input})), 0)::int`,
      })
      .from(ttsGenerations)
      .where(and(eq(ttsGenerations.userId, userId), gte(ttsGenerations.createdAt, startHour)))
      .groupBy(hourBucketExpr)
      .orderBy(hourBucketExpr);

    const byHour = new Map<string, { calls: number; chars: number }>();
    for (const row of rows) {
      const bucket = row.bucket ? new Date(row.bucket).toISOString() : null;
      if (!bucket) continue;
      byHour.set(toHourKey(new Date(bucket)), {
        calls: Number(row.calls ?? 0) || 0,
        chars: Number(row.chars ?? 0) || 0,
      });
    }

    const hourly: Array<{ ts: string; calls: number; chars: number }> = [];
    let totalCalls = 0;
    let totalChars = 0;
    for (let i = 0; i < 24; i += 1) {
      const tsDate = hoursAgo(endHour, 23 - i);
      const key = toHourKey(tsDate);
      const v = byHour.get(key) ?? { calls: 0, chars: 0 };
      hourly.push({ ts: key, calls: v.calls, chars: v.chars });
      totalCalls += v.calls;
      totalChars += v.chars;
    }

    // Distribution + ranking over a slightly longer window for more meaningful charts.
    const breakdownStart = hoursAgo(endHour, 24 * 30);
    const breakdownRows = await db
      .select({
        voice: ttsGenerations.voice,
        calls: sql<number>`count(*)::int`,
        chars: sql<number>`coalesce(sum(length(${ttsGenerations.input})), 0)::int`,
      })
      .from(ttsGenerations)
      .where(and(eq(ttsGenerations.userId, userId), gte(ttsGenerations.createdAt, breakdownStart)))
      .groupBy(ttsGenerations.voice);

    const tierAgg = new Map<VoiceTier, { calls: number; chars: number }>();
    const voiceAgg: Array<{ voice: string; calls: number; chars: number }> = [];
    for (const row of breakdownRows) {
      const voice = row.voice ?? "unknown";
      const calls = Number(row.calls ?? 0) || 0;
      const chars = Number(row.chars ?? 0) || 0;
      voiceAgg.push({ voice, calls, chars });

      const tier = classifyVoiceTier(voice);
      const prev = tierAgg.get(tier) ?? { calls: 0, chars: 0 };
      tierAgg.set(tier, { calls: prev.calls + calls, chars: prev.chars + chars });
    }

    const tiers = Array.from(tierAgg.entries())
      .map(([tier, v]) => ({ tier, calls: v.calls, chars: v.chars }))
      .sort((a, b) => b.chars - a.chars);

    const topVoices = voiceAgg
      .sort((a, b) => b.calls - a.calls || b.chars - a.chars || a.voice.localeCompare(b.voice))
      .slice(0, 10);

    return NextResponse.json({
      ok: true,
      data: {
        window: { start: startHour.toISOString(), end: now.toISOString(), hours: 24 },
        totals: { calls: totalCalls, chars: totalChars },
        hourly,
        tiers,
        topVoices,
      },
    });
  } catch (err) {
    if (isMissingRelationError(err, "tts_generations")) {
      return NextResponse.json({ ok: false, message: "DB_REQUIRED" }, { status: 501 });
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

