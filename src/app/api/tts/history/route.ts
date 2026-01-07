import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { ttsGenerations } from "@/lib/db/schema/tts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function intParam(value: string | null, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "no auth, please sign-in" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = intParam(searchParams.get("limit"), 20, 1, 100);
  const offset = intParam(searchParams.get("offset"), 0, 0, 10_000);

  const rows = await db
    .select({
      id: ttsGenerations.id,
      createdAt: ttsGenerations.createdAt,
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

  return NextResponse.json({
    items: rows.map((r) => ({
      ...r,
      audioUrl: `/api/tts/audio/${r.id}`,
    })),
    pagination: {
      limit,
      offset,
      hasMore: rows.length === limit,
    },
  });
}

