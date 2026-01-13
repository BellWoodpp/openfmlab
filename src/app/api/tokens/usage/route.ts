import { NextRequest, NextResponse } from "next/server";
import { and, eq, like } from "drizzle-orm";

import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { orders } from "@/lib/db/schema/orders";
import { membershipTokensForPeriod } from "@/lib/tokens/grants";

const DEFAULT_TOKENS = 500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ ok: false, message: "no auth, please sign-in" }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        ok: true,
        data: {
          available: DEFAULT_TOKENS,
          used: null,
          base: DEFAULT_TOKENS,
          topups: 0,
        },
        warning: "db_disabled",
      },
      { status: 200 },
    );
  }

  try {
    const [userRow] = await db
      .select({ tokens: users.tokens })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const available = userRow?.tokens ?? DEFAULT_TOKENS;

    const topupRows = await db
      .select({ metadata: orders.metadata })
      .from(orders)
      .where(and(eq(orders.userId, userId), eq(orders.status, "paid"), like(orders.productId, "points:%")))
      .limit(500);

    let topups = 0;
    for (const row of topupRows) {
      const meta = row.metadata;
      if (!isRecord(meta)) continue;
      const creditsRaw = meta.credits;
      const credits = typeof creditsRaw === "number" ? creditsRaw : Number(creditsRaw);
      if (Number.isFinite(credits) && credits > 0) {
        topups += Math.floor(credits);
      }
    }

    const proRows = await db
      .select({ metadata: orders.metadata })
      .from(orders)
      .where(and(eq(orders.userId, userId), eq(orders.status, "paid"), eq(orders.productId, "professional")))
      .limit(500);

    let membershipGrants = 0;
    for (const row of proRows) {
      const meta = row.metadata;
      if (!isRecord(meta)) continue;
      const fulfillment = meta.fulfillment;
      if (isRecord(fulfillment) && isRecord(fulfillment.membership_tokens)) {
        const raw = (fulfillment.membership_tokens as Record<string, unknown>).tokens;
        const n = typeof raw === "number" ? raw : Number(raw);
        if (Number.isFinite(n) && n > 0) {
          membershipGrants += Math.floor(n);
          continue;
        }
      }

      const grant = membershipTokensForPeriod(meta.plan_period);
      if (grant) membershipGrants += grant;
    }

    const base = DEFAULT_TOKENS;
    const earned = base + topups + membershipGrants;
    const used = Math.max(0, Math.floor(earned - available));

    return NextResponse.json(
      {
        ok: true,
        data: { available, used, base, topups },
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      {
        ok: true,
        data: { available: DEFAULT_TOKENS, used: null, base: DEFAULT_TOKENS, topups: 0 },
        warning: "error",
      },
      { status: 200 },
    );
  }
}
