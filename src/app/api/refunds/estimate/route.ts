import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { orders } from "@/lib/db/schema/orders";
import { users } from "@/lib/db/schema/users";
import {
  estimateMembershipTokensRefund,
  estimatePointsRefund,
  type RefundEstimateError,
} from "@/lib/refunds/calc";
import { getRefundPolicyConfig } from "@/lib/refunds/policy";
import { membershipTokensForPeriod } from "@/lib/tokens/grants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function periodFromOrderMetadata(metadata: unknown): "monthly" | "yearly" | null {
  if (!isRecord(metadata)) return null;
  const v = metadata.plan_period;
  if (v === "monthly" || v === "yearly") return v;
  return null;
}

function membershipTokensFromOrderMetadata(metadata: unknown): number | null {
  if (!isRecord(metadata)) return null;

  const fulfillment = metadata.fulfillment;
  if (isRecord(fulfillment) && isRecord(fulfillment.membership_tokens)) {
    const raw = (fulfillment.membership_tokens as Record<string, unknown>).tokens;
    const n = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }

  const grant = membershipTokensForPeriod(metadata.plan_period);
  return grant ?? null;
}

function creditsFromOrderMetadata(metadata: unknown): number | null {
  if (!isRecord(metadata)) return null;
  const raw = metadata.credits;
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.floor(n));
}

function respErr(error: string, status = 400) {
  const body: RefundEstimateError = { ok: false, error };
  return NextResponse.json(body, { status });
}

// Yearly refunds used to be prorated by list price; with upfront token grants we now prorate by remaining tokens instead.

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  const userId = session?.user?.id;
  if (!userId) {
    return respErr("AUTH_REQUIRED", 401);
  }

  if (!process.env.DATABASE_URL) {
    return respErr("DB_REQUIRED", 501);
  }

  const orderId = req.nextUrl.searchParams.get("orderId");
  if (!orderId) {
    return respErr("MISSING_ORDER_ID", 400);
  }

  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
    .limit(1);

  if (!order) {
    return respErr("ORDER_NOT_FOUND", 404);
  }

  if (order.status !== "paid") {
    return respErr("ORDER_NOT_PAID", 409);
  }

  const [userRow] = await db.select({ tokens: users.tokens }).from(users).where(eq(users.id, userId)).limit(1);
  const userTokens = typeof userRow?.tokens === "number" ? userRow.tokens : 0;

  const now = new Date();
  const cfg = getRefundPolicyConfig();

  if (order.productId === "professional") {
    const period = periodFromOrderMetadata(order.metadata);
    const inferred = period ?? (Number(order.amount) >= 10 ? "yearly" : "monthly");

    const tokensPurchased =
      membershipTokensFromOrderMetadata(order.metadata) ?? membershipTokensForPeriod(inferred) ?? 0;

    const estimate = estimateMembershipTokensRefund({
      kind: inferred === "yearly" ? "membership_yearly" : "membership_monthly",
      amount: order.amount,
      currency: order.currency,
      tokensPurchased,
      userAvailableTokens: userTokens,
      now,
      cfg,
    });
    return NextResponse.json({ ok: true, data: estimate });
  }

  if (order.productId.startsWith("points:")) {
    const credits = creditsFromOrderMetadata(order.metadata);
    if (credits === null) {
      return respErr("POINTS_ORDER_MISSING_CREDITS", 400);
    }
    const estimate = estimatePointsRefund({
      amount: order.amount,
      currency: order.currency,
      creditsPurchased: credits,
      userAvailableTokens: userTokens,
      now,
      cfg,
    });
    return NextResponse.json({ ok: true, data: estimate });
  }

  return respErr("NOT_REFUNDABLE_PRODUCT", 400);
}
