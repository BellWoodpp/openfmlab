import { NextRequest, NextResponse } from "next/server";
import { OrderService } from "@/lib/orders/service";
import { auth } from "@/lib/auth/server";
import { newCreemClient } from "@/lib/payments/creem";
import { membershipTokensForPeriod } from "@/lib/tokens/grants";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function extractCredits(metadata: unknown): number | null {
  if (!isRecord(metadata)) return null;
  const raw = metadata.credits;
  const credits = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(credits) || credits <= 0) return null;
  return Math.floor(credits);
}

function extractPlanPeriod(metadata: unknown): "monthly" | "yearly" | null {
  if (!isRecord(metadata)) return null;
  const p = metadata.plan_period;
  return p === "monthly" || p === "yearly" ? p : null;
}

function extractMembershipGrant(metadata: unknown): number | null {
  if (!isRecord(metadata)) return null;
  const fulfillment = metadata.fulfillment;
  if (isRecord(fulfillment) && isRecord(fulfillment.membership_tokens)) {
    const raw = (fulfillment.membership_tokens as Record<string, unknown>).tokens;
    const n = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }

  const planPeriod = extractPlanPeriod(metadata);
  const grant = membershipTokensForPeriod(planPeriod);
  return grant ?? null;
}

/**
 * 处理支付成功回调
 * 验证签名并更新订单状态
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // signature:签名
    const {
      request_id,
      checkout_id,
      signature,
    } = body;

    // 验证必填参数
    if (!request_id) {
      return NextResponse.json(
        { success: false, error: "缺少 request_id 参数" },
        { status: 400 }
      );
    }

    // 注意：Creem 的重定向 URL 签名算法与 Webhook 不同
    // Webhook 的签名验证已在 /api/pay/callback/creem 中处理
    // 这里我们信任 Webhook 已经更新了订单状态，不做额外的签名验证
    // 实际生产环境中，Creem 应该只重定向到成功的 URL，订单状态由 Webhook 保证一致性
    
    if (signature) {
      console.log("收到签名参数（暂不验证）:", {
        request_id,
        has_signature: !!signature,
      });
    }

    // 获取当前用户会话
    const session = await auth.api.getSession({ headers: request.headers });
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "未登录，请先登录后再查看订单" },
        { status: 401 },
      );
    }

    // 查找订单
    const order = await OrderService.findOrderByPaymentRequestId(request_id);

    if (!order) {
      console.error("订单未找到:", { request_id });
      return NextResponse.json(
        { success: false, error: "订单未找到" },
        { status: 404 }
      );
    }

    // 验证订单属于当前用户
    if (order.userId !== userId) {
      console.error("订单不属于当前用户:", {
        orderUserId: order.userId,
        currentUserId: userId,
      });
      return NextResponse.json(
        { success: false, error: "无权访问此订单" },
        { status: 403 }
      );
    }

    let finalOrder = order;

    if (finalOrder.status !== "paid") {
      if (!checkout_id) {
        return NextResponse.json(
          { success: false, error: "支付尚未确认（缺少 checkout_id），请稍后刷新或等待 Webhook" },
          { status: 409 },
        );
      }

      // 使用 Creem API 验证 checkout 状态（避免仅凭前端回跳参数就将订单标记为 paid）。
      const client = newCreemClient();
      const checkout = await client.creem().retrieveCheckout({
        xApiKey: client.apiKey(),
        checkoutId: checkout_id,
      });

      if (checkout.requestId && checkout.requestId !== request_id) {
        return NextResponse.json(
          { success: false, error: "checkout_id 与 request_id 不匹配" },
          { status: 400 },
        );
      }

      const checkoutStatus = String(checkout.status || "").toLowerCase();
      const isCompleted = checkoutStatus === "completed" || checkoutStatus === "paid" || checkoutStatus === "success";
      if (!isCompleted) {
        return NextResponse.json(
          { success: false, error: `支付尚未完成（checkout.status=${checkout.status}）` },
          { status: 409 },
        );
      }

      const subscriptionId =
        typeof checkout.subscription === "string"
          ? checkout.subscription
          : checkout.subscription && typeof checkout.subscription === "object" && "id" in checkout.subscription
            ? String((checkout.subscription as { id?: unknown }).id ?? "")
            : "";

      const updated = await OrderService.handlePaymentSuccessFromWebhook(request_id, checkout_id);
      if (!updated) {
        return NextResponse.json(
          { success: false, error: "订单状态更新失败" },
          { status: 500 },
        );
      }
      finalOrder = updated;

      if (subscriptionId && finalOrder.productType === "subscription") {
        await OrderService.mergeOrderMetadata(finalOrder.id, { subscription_id: subscriptionId });
      }
    }

    return NextResponse.json({
      success: true,
      order: {
        id: finalOrder.id,
        orderNumber: finalOrder.orderNumber,
        status: finalOrder.status,
        productId: finalOrder.productId,
        productType: finalOrder.productType,
        productName: finalOrder.productName,
        amount: finalOrder.amount,
        currency: finalOrder.currency,
        credits: extractCredits(finalOrder.metadata),
        planPeriod: extractPlanPeriod(finalOrder.metadata),
        membershipTokens: extractMembershipGrant(finalOrder.metadata),
        paidAt: finalOrder.paidAt,
        createdAt: finalOrder.createdAt,
      },
    });
  } catch (error) {
    console.error("处理支付成功回调时发生错误:", error);
    return NextResponse.json(
      {
        success: false,
        error: "服务器内部错误",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// 支持 GET 请求用于测试
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const requestId = searchParams.get("request_id");
  const checkoutId = searchParams.get("checkout_id");
  
  if (!requestId) {
    return NextResponse.json(
      { success: false, error: "缺少 request_id 参数" },
      { status: 400 }
    );
  }
  
  let order = await OrderService.findOrderByPaymentRequestId(requestId);
  
  if (!order) {
    return NextResponse.json(
      { success: false, error: "订单未找到" },
      { status: 404 }
    );
  }

	  if (order.status !== "paid" && checkoutId) {
	    const client = newCreemClient();
	    const checkout = await client.creem().retrieveCheckout({
	      xApiKey: client.apiKey(),
	      checkoutId,
	    });

	    const checkoutStatus = String(checkout.status || "").toLowerCase();
	    const isCompleted = checkoutStatus === "completed" || checkoutStatus === "paid" || checkoutStatus === "success";
	    if (isCompleted) {
	      const subscriptionId =
	        typeof checkout.subscription === "string"
	          ? checkout.subscription
	          : checkout.subscription && typeof checkout.subscription === "object" && "id" in checkout.subscription
	            ? String((checkout.subscription as { id?: unknown }).id ?? "")
	            : "";

	      const isPointsTopup = order.productType === "one_time" && order.productId.startsWith("points:");
	      const updated = isPointsTopup
	        ? await OrderService.handlePaymentSuccessFromWebhook(requestId, checkoutId)
	        : await OrderService.handlePaymentSuccess(requestId, checkoutId);
	      if (updated) {
	        order = updated;
	        if (subscriptionId && order.productType === "subscription") {
	          await OrderService.mergeOrderMetadata(order.id, { subscription_id: subscriptionId });
	        }
	      }
	    }
	  }
  
  return NextResponse.json({
    success: true,
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      productId: order.productId,
      productType: order.productType,
      productName: order.productName,
      amount: order.amount,
      currency: order.currency,
      credits: extractCredits(order.metadata),
      planPeriod: extractPlanPeriod(order.metadata),
      membershipTokens: extractMembershipGrant(order.metadata),
      paidAt: order.paidAt,
      createdAt: order.createdAt,
    },
  });
}
