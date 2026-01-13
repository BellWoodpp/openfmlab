import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

const DEFAULT_TOKENS = 500;

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({
      ok: true,
      data: { tokens: 0, isAuthenticated: false },
    });
  }

  try {
    const rows = await db
      .select({ tokens: users.tokens })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const tokens = rows[0]?.tokens ?? DEFAULT_TOKENS;

    return NextResponse.json({
      ok: true,
      data: { tokens, isAuthenticated: true },
    });
  } catch {
    return NextResponse.json(
      {
        ok: true,
        data: { tokens: DEFAULT_TOKENS, isAuthenticated: true },
        warning: "tokens_unavailable",
      },
      { status: 200 },
    );
  }
}
