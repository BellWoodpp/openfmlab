import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { orders } from "@/lib/db/schema/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function intParam(value: string | null, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function periodParam(value: string | null): "monthly" | "yearly" | null {
  if (value === "monthly" || value === "yearly") return value;
  return null;
}

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "Not available in production" }, { status: 404 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: false, error: "DB_REQUIRED" }, { status: 501 });
  }

  const session = await auth.api.getSession({ headers: req.headers });
  const userId = session?.user?.id;
  const userEmail = session?.user?.email;
  if (!userId || !userEmail) {
    return NextResponse.json({ ok: false, error: "no auth, please sign-in" }, { status: 401 });
  }

  const paid = intParam(req.nextUrl.searchParams.get("paid"), 1, 0, 1) === 1;
  const period = periodParam(req.nextUrl.searchParams.get("period")) ?? "monthly";
  const now = new Date();

  if (!paid) {
    await db
      .update(orders)
      .set({ status: "cancelled", updatedAt: now, cancelledAt: now })
      .where(and(eq(orders.userId, userId), eq(orders.status, "paid"), eq(orders.productId, "professional")));
  } else {
    // Cancel existing paid Professional orders first so "current plan" always matches the latest dev setting.
    await db
      .update(orders)
      .set({ status: "cancelled", updatedAt: now, cancelledAt: now })
      .where(and(eq(orders.userId, userId), eq(orders.status, "paid"), eq(orders.productId, "professional")));

    const orderId = randomUUID();
    const orderNumber = `DEV-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    await db.insert(orders).values({
      id: orderId,
      userId,
      orderNumber,
      status: "paid",
      productId: "professional",
      productName: "Professional",
      productType: "subscription",
      amount: period === "yearly" ? "58.00" : "6.00",
      currency: "USD",
      paymentProvider: "dev",
      customerEmail: userEmail,
      metadata: { dev: true, note: "manual paid for local testing", plan_id: "professional", plan_period: period },
      createdAt: now,
      updatedAt: now,
      paidAt: now,
    });
  }

  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orders)
    .where(and(eq(orders.userId, userId), eq(orders.status, "paid"), eq(orders.productId, "professional")))
    .limit(1);

  const isPaid = (row?.count ?? 0) > 0;
  return NextResponse.json({ ok: true, data: { isPaid, paidOrders: row?.count ?? 0, period: isPaid ? period : null } });
}
