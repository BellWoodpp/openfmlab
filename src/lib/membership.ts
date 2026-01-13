import { and, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { orders } from "@/lib/db/schema/orders";
import { OrderService } from "@/lib/orders/service";
import { newCreemClient } from "@/lib/payments/creem";

export type MembershipReason =
  | "paid"
  | "unpaid"
  | "expired"
  | "db_disabled"
  | "orders_table_missing"
  | "error";

export type MembershipPeriod = "monthly" | "yearly";

function isMissingRelationError(err: unknown, relation: string): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  const message = (err as { message?: unknown }).message;
  const relationName = (err as { relation?: unknown }).relation;
  if (relationName === relation) return true;
  if (code === "42P01") return typeof message === "string" && message.includes(relation);
  return typeof message === "string" && message.includes(`relation \"${relation}\" does not exist`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeMembershipPeriod(value: unknown): MembershipPeriod | null {
  if (value === "monthly" || value === "yearly") return value;
  return null;
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

function normalizeMembershipAccessWindow(period: MembershipPeriod | null): number {
  // Give a small grace window for renewals/clock drift.
  const graceMs = 3 * 24 * 60 * 60 * 1000;
  const monthMs = 31 * 24 * 60 * 60 * 1000;
  const yearMs = 366 * 24 * 60 * 60 * 1000;
  return (period === "yearly" ? yearMs : monthMs) + graceMs;
}

function isWithinWindow(paidAt: Date | null, period: MembershipPeriod | null): boolean {
  if (!paidAt) return false;
  const windowMs = normalizeMembershipAccessWindow(period);
  return Date.now() - paidAt.getTime() <= windowMs;
}

export async function getUserMembershipDetails(userId: string): Promise<{
  isPaid: boolean;
  reason: MembershipReason;
  period: MembershipPeriod | null;
  hasPaidHistory: boolean;
  subscriptionId: string | null;
  orderId: string | null;
  paymentSessionId: string | null;
  paymentProvider: string | null;
}> {
  if (!process.env.DATABASE_URL) {
    return {
      isPaid: false,
      reason: "db_disabled",
      period: null,
      hasPaidHistory: false,
      subscriptionId: null,
      orderId: null,
      paymentSessionId: null,
      paymentProvider: null,
    };
  }

  try {
    const [row] = await db
      .select({
        id: orders.id,
        metadata: orders.metadata,
        paymentSessionId: orders.paymentSessionId,
        paymentProvider: orders.paymentProvider,
        paidAt: orders.paidAt,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(and(eq(orders.userId, userId), eq(orders.status, "paid"), eq(orders.productId, "professional")))
      .orderBy(sql`coalesce(${orders.paidAt}, ${orders.createdAt}) desc`)
      .limit(1);

    if (!row) {
      return {
        isPaid: false,
        reason: "unpaid",
        period: null,
        hasPaidHistory: false,
        subscriptionId: null,
        orderId: null,
        paymentSessionId: null,
        paymentProvider: null,
      };
    }

    const metadata = row.metadata;
    const period = isRecord(metadata) ? normalizeMembershipPeriod(metadata.plan_period) : null;
    let subscriptionId = extractSubscriptionId(metadata);

    // Best-effort: backfill subscription id from the stored checkout session id (needed for upgrades / status sync).
    if (!subscriptionId && row.paymentProvider === "creem" && row.paymentSessionId) {
      try {
        const client = newCreemClient();
        const checkout = await client.creem().retrieveCheckout({
          xApiKey: client.apiKey(),
          checkoutId: row.paymentSessionId,
        });

        const id =
          typeof checkout.subscription === "string"
            ? checkout.subscription
            : checkout.subscription && typeof checkout.subscription === "object" && "id" in checkout.subscription
              ? String((checkout.subscription as { id?: unknown }).id ?? "")
              : "";

        if (id) {
          subscriptionId = id;
          await OrderService.mergeOrderMetadata(row.id, { subscription_id: id });
        }
      } catch {
        // ignore
      }
    }

    const paidAt = row.paidAt ?? row.createdAt ?? null;

    // Default behavior: treat membership as active within the current billing window.
    // This requires us to create renewal orders (via webhook sync) so the window keeps extending.
    let isPaid = isWithinWindow(paidAt, period);
    let reason: MembershipReason = isPaid ? "paid" : "expired";

    // If we can reach Creem, prefer provider truth when our local window says "expired".
    // This keeps API calls rare (e.g. when renewals weren't synced into orders yet).
    if (!isPaid && row.paymentProvider === "creem" && subscriptionId) {
      try {
        const client = newCreemClient();
        const subscription = await client.creem().retrieveSubscription({
          xApiKey: client.apiKey(),
          subscriptionId,
        });

        const status = String((subscription as unknown as { status?: unknown }).status ?? "").toLowerCase();
        const endDate =
          (subscription as unknown as { currentPeriodEndDate?: Date | null; nextTransactionDate?: Date | null })
            .currentPeriodEndDate ??
          (subscription as unknown as { nextTransactionDate?: Date | null }).nextTransactionDate ??
          null;

        const stillInPeriod = endDate ? endDate.getTime() >= Date.now() : isPaid;
        const providerPaid =
          (status === "active" || status === "trialing" || status === "canceled") && stillInPeriod;

        isPaid = providerPaid;
        reason = isPaid ? "paid" : "unpaid";
      } catch {
        // ignore and fallback to time-based window
      }
    }

    return {
      isPaid,
      reason,
      period,
      hasPaidHistory: true,
      subscriptionId,
      orderId: row.id,
      paymentSessionId: row.paymentSessionId ?? null,
      paymentProvider: row.paymentProvider ?? null,
    };
  } catch (err) {
    if (isMissingRelationError(err, "orders")) {
      return {
        isPaid: false,
        reason: "orders_table_missing",
        period: null,
        hasPaidHistory: false,
        subscriptionId: null,
        orderId: null,
        paymentSessionId: null,
        paymentProvider: null,
      };
    }

    return {
      isPaid: false,
      reason: "error",
      period: null,
      hasPaidHistory: false,
      subscriptionId: null,
      orderId: null,
      paymentSessionId: null,
      paymentProvider: null,
    };
  }
}

export async function checkUserPaidMembership(userId: string): Promise<{
  isPaid: boolean;
  reason: MembershipReason;
}> {
  const details = await getUserMembershipDetails(userId);
  return { isPaid: details.isPaid, reason: details.reason };
}
