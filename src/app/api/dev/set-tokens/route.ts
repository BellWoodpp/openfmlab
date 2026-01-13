import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function intParam(value: string | null, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "Not available in production" }, { status: 404 });
  }

  const session = await auth.api.getSession({ headers: req.headers });
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "no auth, please sign-in" }, { status: 401 });
  }

  // Keep within JS safe integer range when schema uses bigint(mode:number).
  const tokens = intParam(req.nextUrl.searchParams.get("tokens"), 3, 0, 9_000_000_000_000_000);

  const [row] = await db
    .update(users)
    .set({ tokens })
    .where(eq(users.id, userId))
    .returning({ tokens: users.tokens });

  return NextResponse.json({ ok: true, data: { tokens: row?.tokens ?? tokens } });
}
