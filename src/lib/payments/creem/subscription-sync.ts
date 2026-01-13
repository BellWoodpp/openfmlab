import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { orders, type Order } from "@/lib/db/schema/orders";
import { OrderService } from "@/lib/orders/service";
import { newCreemClient } from "@/lib/payments/creem";
import { parseCreemProductsEnv, resolveCreemProductId, type CreemSupportedPeriod } from "@/lib/payments/creem/products";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
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

function extractCreemTransactionId(metadata: unknown): string | null {
  if (!isRecord(metadata)) return null;
  const id = metadata.creem_transaction_id ?? metadata.transaction_id ?? metadata.lastTransactionId;
  if (typeof id === "string" && id.trim()) return id.trim();
  return null;
}

function centsToDecimalString(cents: number): string {
  const safe = Number.isFinite(cents) ? cents : 0;
  return (safe / 100).toFixed(2);
}

function timestampToDate(ts: number): Date {
  if (!Number.isFinite(ts)) return new Date();
  return ts < 1_000_000_000_000 ? new Date(ts * 1000) : new Date(ts);
}

function parseMoneyToCents(amount: string): number | null {
  const n = Number(amount);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function productIdFromSubscription(subscription: unknown): string | null {
  if (!isRecord(subscription)) return null;
  const product = subscription.product;
  if (typeof product === "string" && product.trim()) return product.trim();
  if (isRecord(product) && typeof product.id === "string" && product.id.trim()) return product.id.trim();
  return null;
}

function customerIdFromSubscription(subscription: unknown): string | null {
  if (!isRecord(subscription)) return null;
  const customer = subscription.customer;
  if (typeof customer === "string" && customer.trim()) return customer.trim();
  if (isRecord(customer) && typeof customer.id === "string" && customer.id.trim()) return customer.id.trim();
  return null;
}

function inferProfessionalPeriodFromSubscription(subscription: unknown): "monthly" | "yearly" | null {
  const productId = productIdFromSubscription(subscription);
  if (!productId) return null;

  try {
    const parsedProducts = parseCreemProductsEnv(process.env.CREEM_PRODUCTS);
    const monthlyProductId = resolveCreemProductId({
      parsedProducts,
      productKey: "professional",
      period: "monthly" as CreemSupportedPeriod,
    });
    const yearlyProductId = resolveCreemProductId({
      parsedProducts,
      productKey: "professional",
      period: "yearly" as CreemSupportedPeriod,
    });

    if (yearlyProductId && productId === yearlyProductId) return "yearly";
    if (monthlyProductId && productId === monthlyProductId) return "monthly";
  } catch {
    // ignore
  }

  return null;
}

export async function syncCreemProfessionalSubscriptionTransactionsForOrder(opts: {
  userId: string;
  order: Order;
}): Promise<{ subscriptionId: string | null; backfilled: number; created: number }> {
  const { userId, order } = opts;

  if (
    order.userId !== userId ||
    order.status !== "paid" ||
    order.paymentProvider !== "creem" ||
    order.productId !== "professional" ||
    order.productType !== "subscription"
  ) {
    return { subscriptionId: extractSubscriptionId(order.metadata), backfilled: 0, created: 0 };
  }

  const client = newCreemClient();
  const apiKey = client.apiKey();

  let subscriptionId = extractSubscriptionId(order.metadata);
  if (!subscriptionId && order.paymentSessionId) {
    const checkout = await client.creem().retrieveCheckout({
      xApiKey: apiKey,
      checkoutId: order.paymentSessionId,
    });
    const id =
      typeof checkout.subscription === "string"
        ? checkout.subscription
        : checkout.subscription && typeof checkout.subscription === "object" && "id" in checkout.subscription
          ? String((checkout.subscription as { id?: unknown }).id ?? "")
          : "";

    if (id) {
      subscriptionId = id;
      await OrderService.mergeOrderMetadata(order.id, { subscription_id: id });
    }
  }

  if (!subscriptionId) {
    return { subscriptionId: null, backfilled: 0, created: 0 };
  }

  const subscription = await client.creem().retrieveSubscription({ xApiKey: apiKey, subscriptionId });
  const customerId = customerIdFromSubscription(subscription);
  const inferredPeriod =
    inferProfessionalPeriodFromSubscription(subscription) ??
    (isRecord(order.metadata) && (order.metadata.plan_period === "monthly" || order.metadata.plan_period === "yearly")
      ? (order.metadata.plan_period as "monthly" | "yearly")
      : null);

  if (!customerId) {
    return { subscriptionId, backfilled: 0, created: 0 };
  }

  const txList = await client.creem().searchTransactions({
    xApiKey: apiKey,
    customerId,
    pageNumber: 1,
    pageSize: 50,
  });

  const txs = (txList.items ?? [])
    .filter((tx) => typeof tx.subscription === "string" && tx.subscription === subscriptionId)
    .filter((tx) => typeof tx.id === "string" && tx.id.trim())
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

  if (!txs.length) {
    return { subscriptionId, backfilled: 0, created: 0 };
  }

  const paidOrders = await db
    .select({
      id: orders.id,
      amount: orders.amount,
      currency: orders.currency,
      paidAt: orders.paidAt,
      createdAt: orders.createdAt,
      metadata: orders.metadata,
    })
    .from(orders)
    .where(and(eq(orders.userId, userId), eq(orders.status, "paid"), eq(orders.productId, "professional")));

  const relatedOrders = paidOrders.filter((o) => extractSubscriptionId(o.metadata) === subscriptionId);

  const knownTxIds = new Set<string>();
  const ordersMissingTx: typeof relatedOrders = [];

  for (const o of relatedOrders) {
    const txId = extractCreemTransactionId(o.metadata);
    if (txId) knownTxIds.add(txId);
    else ordersMissingTx.push(o);
  }

  let backfilled = 0;

  for (const o of ordersMissingTx) {
    const cents = parseMoneyToCents(o.amount);
    const orderPaidAt = o.paidAt ?? o.createdAt;
    if (!cents || !orderPaidAt) continue;

    let best: { id: string; diff: number } | null = null;
    for (const tx of txs) {
      if (knownTxIds.has(tx.id)) continue;
      if (typeof tx.currency === "string" && tx.currency !== o.currency) continue;
      const txCents = typeof tx.amountPaid === "number" ? tx.amountPaid : tx.amount;
      if (Math.abs(txCents - cents) > 1) continue;

      const txAt = timestampToDate(tx.createdAt);
      const diff = Math.abs(txAt.getTime() - new Date(orderPaidAt).getTime());
      if (diff > 6 * 60 * 60 * 1000) continue;
      if (!best || diff < best.diff) best = { id: tx.id, diff };
    }

    if (best) {
      await OrderService.mergeOrderMetadata(o.id, { creem_transaction_id: best.id, subscription_id: subscriptionId });
      knownTxIds.add(best.id);
      backfilled++;
    }
  }

  const latestPaidAt = relatedOrders.reduce<Date | null>((acc, o) => {
    const d = o.paidAt ?? o.createdAt;
    if (!d) return acc;
    const dd = new Date(d);
    if (!acc || dd.getTime() > acc.getTime()) return dd;
    return acc;
  }, null);

  const createBudget = Math.max(0, txs.length - relatedOrders.length);
  let created = 0;

  for (const tx of txs) {
    if (created >= createBudget) break;
    if (knownTxIds.has(tx.id)) continue;

    const txAt = timestampToDate(tx.createdAt);
    if (latestPaidAt && txAt.getTime() <= latestPaidAt.getTime() + 60_000) continue;

    const txCents = typeof tx.amountPaid === "number" ? tx.amountPaid : tx.amount;
    const txCurrency = typeof tx.currency === "string" && tx.currency.trim() ? tx.currency : "USD";

    const newOrder = await OrderService.createOrder({
      userId,
      productId: "professional",
      productName: order.productName,
      productType: "subscription",
      amount: centsToDecimalString(txCents),
      currency: txCurrency,
      paymentProvider: "creem",
      customerEmail: order.customerEmail,
      metadata: {
        ...(isRecord(order.metadata) ? order.metadata : {}),
        plan_period: inferredPeriod ?? undefined,
        kind: "subscription_transaction",
        subscription_id: subscriptionId,
        creem_transaction_id: tx.id,
      },
    });

    await OrderService.updateOrderStatus(newOrder.id, "paid", {
      paymentRequestId: randomUUID(),
      paidAt: txAt,
    });

    knownTxIds.add(tx.id);
    created++;
  }

  return { subscriptionId, backfilled, created };
}

