import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { OrderService } from "@/lib/orders/service";
import { eq, and, desc, like, or, sql, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { orders } from "@/lib/db/schema/orders";
import { syncCreemProfessionalSubscriptionTransactionsForOrder } from "@/lib/payments/creem/subscription-sync";

function respErr(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

// 泛型（Generics）
function respData<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

// 获取用户的订单列表
export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    const userId = session?.user?.id;
    
    if (!userId) {
      return respErr("no auth, please sign-in", 401);
    }
    
    // 解构赋值
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    // 构建查询条件
    let whereConditions = eq(orders.userId, userId);

    // 默认不展示已删除（隐藏）的订单
    whereConditions =
      and(whereConditions, sql`coalesce(${orders.metadata} ->> 'hidden', 'false') != 'true'`) ?? whereConditions;
    
    // 添加状态筛选
    if (status && status !== 'all') {
      const statuses = status
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      if (statuses.length === 1) {
        whereConditions = and(whereConditions, eq(orders.status, statuses[0]!)) ?? whereConditions;
      } else if (statuses.length > 1) {
        whereConditions = and(whereConditions, inArray(orders.status, statuses)) ?? whereConditions;
      }
    }
    
    // 添加搜索条件,conditions:状态
    if (search) {
      whereConditions = and(
        whereConditions,
        or(
          like(orders.orderNumber, `%${search}%`),
          like(orders.productName, `%${search}%`)
        )
      ) ?? whereConditions;
    }

    // 获取订单列表
    const ordersList = await db
      .select()
      .from(orders)
      .where(whereConditions)
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset(offset);

    // 获取总数
    const [totalRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(whereConditions);

    const total = Number(totalRow?.count ?? 0);
    
    // pagination:分页，offset:抵消，total:全部，
    return respData({
      orders: ordersList,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total,
      }
    });
  } catch (e: unknown) {
    console.log("获取订单列表失败: ", e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return respErr("获取订单列表失败: " + errorMessage);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    const userId = session?.user?.id;

    if (!userId) {
      return respErr("no auth, please sign-in", 401);
    }

    const { searchParams } = new URL(req.url);
    const body = (await req.json().catch(() => null)) as { orderId?: unknown } | null;
    const orderId = (body?.orderId ?? searchParams.get("orderId")) as unknown;

    if (typeof orderId !== "string" || !orderId.trim()) {
      return respErr("invalid params: orderId");
    }

    const trimmedId = orderId.trim();
    const [row] = await db
      .select({ id: orders.id, metadata: orders.metadata })
      .from(orders)
      .where(and(eq(orders.id, trimmedId), eq(orders.userId, userId)))
      .limit(1);

    if (!row) {
      return respErr("订单未找到", 404);
    }

    const current = isRecord(row.metadata) ? (row.metadata as Record<string, unknown>) : {};
    const nextMetadata: Record<string, unknown> = {
      ...current,
      hidden: true,
      hidden_at: new Date().toISOString(),
      hidden_by: "user",
    };

    await db
      .update(orders)
      .set({ metadata: nextMetadata, updatedAt: new Date() })
      .where(and(eq(orders.id, trimmedId), eq(orders.userId, userId)));

    return respData({ orderId: trimmedId });
  } catch (e: unknown) {
    console.log("删除订单失败: ", e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return respErr("删除订单失败: " + errorMessage);
  }
}

// 获取特定订单详情
export async function POST(req: NextRequest) {
  try {
    // session:用户会话 / 登录状态
    const session = await auth.api.getSession({ headers: req.headers });
    // ?:如果返回null或undefend不会报错
    const userId = session?.user?.id;
    
    if (!userId) {
      return respErr("no auth, please sign-in", 401);
    }

    const body = (await req.json().catch(() => null)) as { orderId?: string; refresh?: unknown } | null;
    const orderId = body?.orderId;
    const refresh = body?.refresh === true;
    
    if (!orderId) {
      return respErr("invalid params: orderId");
    }

    let result = await OrderService.getOrderWithItems(orderId);
    
    if (!result.order) {
      return respErr("订单未找到", 404);
    }

    // 检查订单是否属于当前用户
    if (result.order.userId !== userId) {
      return respErr("无权访问此订单", 403);
    }
    
    if (
      refresh &&
      result.order.status === "paid" &&
      result.order.paymentProvider === "creem" &&
      result.order.productId === "professional" &&
      result.order.productType === "subscription"
    ) {
      try {
        await syncCreemProfessionalSubscriptionTransactionsForOrder({ userId, order: result.order });
      } catch (err) {
        console.warn("[orders] refresh failed:", err);
      }

      result = await OrderService.getOrderWithItems(orderId);
    }

    return respData(result);
  } catch (e: unknown) {
    console.log("获取订单详情失败: ", e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return respErr("获取订单详情失败: " + errorMessage);
  }
}

// 订单状态 GET（）
