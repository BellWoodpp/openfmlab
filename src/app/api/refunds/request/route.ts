import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { orders } from "@/lib/db/schema/orders";
import { newCreemClient } from "@/lib/payments/creem";
import { getRefundPolicyConfig } from "@/lib/refunds/policy";
import {
  estimateMembershipTokensRefund,
  estimatePointsRefund,
  type RefundEstimate,
} from "@/lib/refunds/calc";
import { users } from "@/lib/db/schema/users";
import { membershipTokensForPeriod } from "@/lib/tokens/grants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function respErr(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

function respData<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
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

function extractSubscriptionId(metadata: unknown): string | null {
  if (!isRecord(metadata)) return null;
  const direct = metadata.subscription_id ?? metadata.subscriptionId;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const nested = metadata.subscription;
  if (typeof nested === "string" && nested.trim()) return nested.trim();
  if (isRecord(nested) && typeof nested.id === "string" && nested.id.trim()) return nested.id.trim();
  return null;
}

function hasRefundRequest(metadata: unknown): boolean {
  if (!isRecord(metadata)) return false;
  const rr = metadata.refund_request;
  if (!isRecord(rr)) return false;
  return Boolean(rr.requested_at);
}

async function estimateForOrder(opts: {
  order: { productId: string; amount: string; currency: string; paidAt: Date | null; createdAt: Date; metadata: unknown };
  userTokens: number;
}): Promise<RefundEstimate | null> {
  const cfg = getRefundPolicyConfig();
  const now = new Date();

  if (opts.order.productId === "professional") {
    const period = periodFromOrderMetadata(opts.order.metadata);
    const inferred = period ?? (Number(opts.order.amount) >= 10 ? "yearly" : "monthly");

    const tokensPurchased =
      membershipTokensFromOrderMetadata(opts.order.metadata) ?? membershipTokensForPeriod(inferred) ?? 0;

    return estimateMembershipTokensRefund({
      kind: inferred === "yearly" ? "membership_yearly" : "membership_monthly",
      amount: opts.order.amount,
      currency: opts.order.currency,
      tokensPurchased,
      userAvailableTokens: opts.userTokens,
      now,
      cfg,
    });
  }

  if (opts.order.productId.startsWith("points:")) {
    const credits = creditsFromOrderMetadata(opts.order.metadata);
    if (credits === null) return null;
    return estimatePointsRefund({
      amount: opts.order.amount,
      currency: opts.order.currency,
      creditsPurchased: credits,
      userAvailableTokens: opts.userTokens,
      now,
      cfg,
    });
  }

  return null;
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  const userId = session?.user?.id;
  if (!userId) {
    return respErr("no auth, please sign-in", 401);
  }

  if (!process.env.DATABASE_URL) {
    return respErr("DB_REQUIRED", 501);
  }

  const body = (await req.json().catch(() => null)) as
    | { orderId?: unknown; accepted?: unknown; policyVersion?: unknown }
    | null;
  const orderId = typeof body?.orderId === "string" ? body.orderId : null;
  const accepted = body?.accepted === true;
  const policyVersion = typeof body?.policyVersion === "string" ? body.policyVersion : "v1";

  if (!orderId) return respErr("invalid params: orderId");
  if (!accepted) return respErr("POLICY_NOT_ACCEPTED", 409);

  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
    .limit(1);

  if (!order) return respErr("ORDER_NOT_FOUND", 404);
  if (order.status !== "paid") return respErr("ORDER_NOT_PAID", 409);

  if (hasRefundRequest(order.metadata)) {
    return respErr("REFUND_ALREADY_REQUESTED", 409);
  }

  const [userRow] = await db.select({ tokens: users.tokens }).from(users).where(eq(users.id, userId)).limit(1);
  const userTokens = typeof userRow?.tokens === "number" ? userRow.tokens : 0;

  const estimate = await estimateForOrder({
    order: {
      productId: order.productId,
      amount: order.amount,
      currency: order.currency,
      paidAt: order.paidAt ? new Date(order.paidAt) : null,
      createdAt: new Date(order.createdAt),
      metadata: order.metadata,
    },
    userTokens,
  });

  if (!estimate) {
    return respErr("NOT_REFUNDABLE_PRODUCT", 400);
  }

  const nowIso = new Date().toISOString();
  const nextMetadata: Record<string, unknown> = isRecord(order.metadata) ? { ...order.metadata } : {};
  nextMetadata.refund_request = {
    requested_at: nowIso,
    policy_version: policyVersion,
    estimate,
    status: "requested",
  };

  await db.update(orders).set({ metadata: nextMetadata, updatedAt: new Date() }).where(eq(orders.id, order.id));

  // If this is a subscription order and we have a subscriptionId, attempt to cancel future renewals.
  const subscriptionCancel: { attempted: boolean; ok: boolean; error?: string } = { attempted: false, ok: false };
  if (order.productType === "subscription" && order.paymentProvider === "creem") {
    const subscriptionId = extractSubscriptionId(order.metadata);
    if (subscriptionId) {
      subscriptionCancel.attempted = true;
      try {
        const client = newCreemClient();
        await client.creem().cancelSubscription({ xApiKey: client.apiKey(), id: subscriptionId });
        subscriptionCancel.ok = true;
      } catch (err) {
        subscriptionCancel.ok = false;
        subscriptionCancel.error = err instanceof Error ? err.message : String(err);
      }
    }
  }

  return respData({
    orderId: order.id,
    refundRequest: nextMetadata.refund_request,
    subscriptionCancel,
  });
}
