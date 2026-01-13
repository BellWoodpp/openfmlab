import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, sql } from "drizzle-orm";

import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { ttsGenerations } from "@/lib/db/schema/tts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isMissingRelationError(err: unknown, relation: string): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  const message = (err as { message?: unknown }).message;
  const relationName = (err as { relation?: unknown }).relation;
  if (relationName === relation) return true;
  if (code === "42P01") return typeof message === "string" && message.includes(relation);
  return typeof message === "string" && message.includes(`relation \"${relation}\" does not exist`);
}

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "no auth, please sign-in" }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: false, error: "DB_REQUIRED" }, { status: 501 });
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  try {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(ttsGenerations)
      .where(and(eq(ttsGenerations.userId, userId), gte(ttsGenerations.createdAt, startOfDay)))
      .limit(1);

    const [totalRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(ttsGenerations)
      .where(eq(ttsGenerations.userId, userId))
      .limit(1);

    const today = Number(row?.count ?? 0) || 0;
    const total = Number(totalRow?.count ?? 0) || 0;

    return NextResponse.json({
      ok: true,
      data: {
        today,
        total,
        startOfDay: startOfDay.toISOString(),
      },
    });
  } catch (err) {
    if (isMissingRelationError(err, "tts_generations")) {
      return NextResponse.json({ ok: true, data: { today: 0, total: 0 }, warning: "tts_table_missing" }, { status: 200 });
    }
    return NextResponse.json({ ok: true, data: { today: 0, total: 0 }, warning: "error" }, { status: 200 });
  }
}
