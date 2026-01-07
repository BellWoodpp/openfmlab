import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { ttsGenerations, ttsShares } from "@/lib/db/schema/tts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "no auth, please sign-in" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const generationId = normalizeString((body as { generationId?: unknown })?.generationId);
  if (!generationId) {
    return NextResponse.json({ error: "Missing generationId" }, { status: 400 });
  }

  const found = await db
    .select({ id: ttsGenerations.id })
    .from(ttsGenerations)
    .where(and(eq(ttsGenerations.id, generationId), eq(ttsGenerations.userId, userId)))
    .limit(1);

  if (!found[0]) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const existing = await db
    .select({ id: ttsShares.id })
    .from(ttsShares)
    .where(eq(ttsShares.generationId, generationId))
    .limit(1);

  const shareId = existing[0]?.id ?? nanoid(12);
  if (!existing[0]) {
    await db.insert(ttsShares).values({ id: shareId, generationId });
  }

  return NextResponse.json({
    id: shareId,
    url: `/api/tts/shared/${shareId}`,
  });
}

