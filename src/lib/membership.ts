import { and, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { orders } from "@/lib/db/schema/orders";

export type MembershipReason =
  | "paid"
  | "unpaid"
  | "db_disabled"
  | "orders_table_missing"
  | "error";

function isMissingRelationError(err: unknown, relation: string): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  const message = (err as { message?: unknown }).message;
  const relationName = (err as { relation?: unknown }).relation;
  if (relationName === relation) return true;
  if (code === "42P01") return typeof message === "string" && message.includes(relation);
  return typeof message === "string" && message.includes(`relation \"${relation}\" does not exist`);
}

export async function checkUserPaidMembership(userId: string): Promise<{
  isPaid: boolean;
  reason: MembershipReason;
}> {
  if (!process.env.DATABASE_URL) return { isPaid: false, reason: "db_disabled" };

  try {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(and(eq(orders.userId, userId), eq(orders.status, "paid")));

    const isPaid = (row?.count ?? 0) > 0;
    return { isPaid, reason: isPaid ? "paid" : "unpaid" };
  } catch (err) {
    if (isMissingRelationError(err, "orders")) {
      return { isPaid: false, reason: "orders_table_missing" };
    }
    return { isPaid: false, reason: "error" };
  }
}

