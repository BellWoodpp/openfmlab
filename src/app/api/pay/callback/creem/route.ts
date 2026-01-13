import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { OrderService } from "@/lib/orders/service";
import { db } from "@/lib/db/client";
import { orders } from "@/lib/db/schema/orders";
import { newCreemClient } from "@/lib/payments/creem";
import { syncCreemProfessionalSubscriptionTransactionsForOrder } from "@/lib/payments/creem/subscription-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CreemCustomer {
  email?: string;
}

interface CreemProduct {
  id?: string;
}

interface CreemCheckoutData {
  id?: string;
  checkoutId?: string;
  requestId?: string;
  request_id?: string;
  customer?: CreemCustomer;
  product?: CreemProduct;
  amount?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
  reason?: string;
}

interface CreemSubscriptionData {
  subscriptionId?: string;
  subscription_id?: string;
  id?: string;
  customer?: CreemCustomer;
  product?: CreemProduct;
  metadata?: Record<string, unknown>;
  reason?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeSignatureHeader(value: string): string {
  return value.trim().replace(/^sha256=/i, "");
}

function timingSafeStringEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function verifyCreemWebhookSignature({
  payload,
  signature,
  webhookSecret,
}: {
  payload: string;
  signature: string;
  webhookSecret: string;
}): boolean {
  const received = normalizeSignatureHeader(signature);
  const hmac = createHmac("sha256", webhookSecret);
  hmac.update(payload);

  const expectedHex = hmac.digest("hex");
  if (timingSafeStringEquals(received, expectedHex)) return true;

  const hmac2 = createHmac("sha256", webhookSecret);
  hmac2.update(payload);
  const expectedBase64 = hmac2.digest("base64");
  return timingSafeStringEquals(received, expectedBase64);
}

function normalizeCreemWebhookEvent(input: unknown): { eventType: string; data: unknown } | null {
  if (!isRecord(input)) return null;
  const eventType = input.eventType ?? input.event_type;
  const data = input.data ?? input.payload ?? input.object;
  if (typeof eventType !== "string" || !eventType.trim()) return null;
  return { eventType: eventType.trim(), data };
}

function normalizeRequestId(data: CreemCheckoutData): string | null {
  const requestId = data.requestId ?? data.request_id;
  if (typeof requestId === "string" && requestId.trim()) return requestId.trim();
  return null;
}

function normalizeCheckoutId(data: CreemCheckoutData): string | null {
  const checkoutId = data.id ?? data.checkoutId ?? (data as unknown as { checkout_id?: unknown }).checkout_id;
  if (typeof checkoutId === "string" && checkoutId.trim()) return checkoutId.trim();
  return null;
}

function normalizeSubscriptionId(data: CreemSubscriptionData): string | null {
  const id = data.subscriptionId ?? data.subscription_id ?? data.id;
  if (typeof id === "string" && id.trim()) return id.trim();
  return null;
}

// Creem 支付回调处理
export async function POST(request: NextRequest) {
  try {
    const payload = await request.text();
    const signature =
      request.headers.get("creem-signature") ??
      request.headers.get("x-creem-signature");

    // 验证签名（如果配置了 webhook secret）
    const webhookSecret = process.env.CREEM_WEBHOOK_SECRET;
    if (webhookSecret) {
      if (!signature) {
        return NextResponse.json({ error: "missing signature" }, { status: 400 });
      }

      const ok = verifyCreemWebhookSignature({
        payload,
        signature,
        webhookSecret,
      });
      if (!ok) {
        return NextResponse.json({ error: "invalid signature" }, { status: 400 });
      }
    }

    // 解析事件数据
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
    }

    const event = normalizeCreemWebhookEvent(parsed);
    if (!event) {
      return NextResponse.json({ error: "invalid event payload" }, { status: 400 });
    }

    // 根据事件类型处理
    const result = await handleCreemEvent(event);
    
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('处理 Creem Webhook 时发生错误：', error);
    return NextResponse.json({ 
      error: '服务器内部错误',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// 处理 Creem 事件
async function handleCreemEvent(event: { eventType: string; data: unknown }) {
  const { eventType, data } = event;

  switch (eventType) {
    case "checkout.completed":
      return await handleCheckoutCompleted(data as CreemCheckoutData);

    case "checkout.failed":
      return await handleCheckoutFailed(data as CreemCheckoutData);

    case "subscription.active":
      return await handleSubscriptionActive(data as CreemSubscriptionData);

    case "subscription.updated":
    case "subscription.renewed":
      return await handleSubscriptionActive(data as CreemSubscriptionData);

    case "subscription.cancelled":
    case "subscription.canceled":
      return await handleSubscriptionCancelled(data as CreemSubscriptionData);

    case "subscription.expired":
      return await handleSubscriptionExpired(data as CreemSubscriptionData);
    
    default:
      return { status: 'ignored', eventType };
  }
}

// 处理一次性支付完成
async function handleCheckoutCompleted(data: CreemCheckoutData) {
  const { 
    customer, 
    product, 
    amount, 
    currency,
    metadata 
  } = data;

  const requestId = normalizeRequestId(data);
  if (!requestId) {
    return {
      status: "error",
      action: "checkout_completed",
      message: "missing requestId",
    };
  }

  const checkoutId = normalizeCheckoutId(data);

  // 更新订单状态为已支付
  const order = await OrderService.handlePaymentSuccessFromWebhook(requestId, checkoutId ?? undefined);
  
  if (!order) {
    return {
      status: 'error',
      action: 'checkout_completed',
      requestId,
      message: '订单未找到',
    };
  }

  try {
    await OrderService.mergeOrderMetadata(order.id, {
      ...(checkoutId ? { creem_checkout_id: checkoutId } : {}),
      ...(typeof product?.id === "string" && product.id.trim() ? { creem_product_id: product.id.trim() } : {}),
      ...(typeof amount === "number" ? { creem_amount_cents: amount } : {}),
      ...(typeof currency === "string" && currency.trim() ? { creem_currency: currency.trim() } : {}),
    });
  } catch (err) {
    console.warn("[creem] failed to merge checkout metadata", err);
  }

  // Best-effort: for subscription checkouts, persist subscriptionId onto the order
  // so later upgrades (monthly -> yearly) can be done reliably even if subscription.active metadata is incomplete.
  try {
    const checkoutLookupId = checkoutId ?? order.paymentSessionId;
    if (order.productType === "subscription" && order.paymentProvider === "creem" && checkoutLookupId) {
      const client = newCreemClient();
      const checkout = await client.creem().retrieveCheckout({
        xApiKey: client.apiKey(),
        checkoutId: checkoutLookupId,
      });

      const subscriptionId =
        typeof checkout.subscription === "string"
          ? checkout.subscription
          : checkout.subscription && typeof checkout.subscription === "object" && "id" in checkout.subscription
            ? String((checkout.subscription as { id?: unknown }).id ?? "")
            : "";

      if (subscriptionId) {
        await OrderService.mergeOrderMetadata(order.id, { subscription_id: subscriptionId });
      }
    }
  } catch (err) {
    console.warn("[creem] failed to sync subscription_id on checkout.completed", err);
  }

  try {
    await syncCreemProfessionalSubscriptionTransactionsForOrder({ userId: order.userId, order });
  } catch (err) {
    console.warn("[creem] failed to sync subscription transactions", err);
  }

  // 记录支付成功日志
  console.log('支付成功:', {
    orderId: order.id,
    orderNumber: order.orderNumber,
    requestId,
    customerEmail: customer?.email,
    productId: product?.id,
    amount,
    currency,
    metadata
  });

  return {
    status: 'success',
    action: 'checkout_completed',
    orderId: order.id,
    orderNumber: order.orderNumber,
    requestId,
    message: '支付成功处理完成',
    redirectUrl:
      typeof metadata?.locale === "string" && metadata.locale.trim()
        ? `/${metadata.locale.trim()}/payment/success`
        : "/payment/success",
  };
}

// 处理支付失败
async function handleCheckoutFailed(data: CreemCheckoutData) {
  const { 
    customer, 
    product, 
    reason 
  } = data;

  const requestId = normalizeRequestId(data);
  if (!requestId) {
    return {
      status: "error",
      action: "checkout_failed",
      message: "missing requestId",
    };
  }

  // 更新订单状态为失败
  const order = await OrderService.handlePaymentFailed(requestId);
  
  if (!order) {
    return {
      status: 'error',
      action: 'checkout_failed',
      requestId,
      message: '订单未找到',
    };
  }
  
  console.log('支付失败:', {
    orderId: order.id,
    orderNumber: order.orderNumber,
    requestId,
    customerEmail: customer?.email,
    productId: product?.id,
    reason
  });

  return {
    status: 'failed',
    action: 'checkout_failed',
    orderId: order.id,
    orderNumber: order.orderNumber,
    requestId,
    message: '支付失败处理完成',
    redirectUrl: '/payment/failed'
  };
}

// 处理订阅激活，Subscription:订阅
async function handleSubscriptionActive(data: CreemSubscriptionData) {
  const { 
    product, 
    metadata 
  } = data;

  const subscriptionId = normalizeSubscriptionId(data);
  if (!subscriptionId) {
    return {
      status: "error",
      action: "subscription_active",
      message: "missing subscriptionId",
    };
  }

  const orderId =
    metadata && typeof metadata === "object" && "order_id" in metadata ? (metadata as { order_id?: unknown }).order_id : null;
  const trimmedOrderId = typeof orderId === "string" ? orderId.trim() : "";
  if (trimmedOrderId) {
    await OrderService.mergeOrderMetadata(trimmedOrderId, {
      subscription_id: subscriptionId,
      subscription_status: "active",
      ...(typeof product?.id === "string" && product.id.trim() ? { creem_product_id: product.id.trim() } : {}),
    });

    const [order] = await db.select().from(orders).where(eq(orders.id, trimmedOrderId)).limit(1);
    if (order) {
      await syncCreemProfessionalSubscriptionTransactionsForOrder({ userId: order.userId, order });
    }
  }

  return {
    status: 'success',
    action: 'subscription_active',
    subscriptionId,
    message: '订阅激活处理完成'
  };
}

// 处理订阅取消
async function handleSubscriptionCancelled(data: CreemSubscriptionData) {
  const subscriptionId = normalizeSubscriptionId(data);
  const { reason, metadata } = data;

  const orderId =
    metadata && typeof metadata === "object" && "order_id" in metadata ? (metadata as { order_id?: unknown }).order_id : null;
  if (typeof orderId === "string" && orderId.trim()) {
    await OrderService.mergeOrderMetadata(orderId.trim(), {
      subscription_id: subscriptionId ?? undefined,
      subscription_status: "cancelled",
      subscription_cancelled_reason: typeof reason === "string" ? reason : undefined,
      subscription_cancelled_at: new Date().toISOString(),
    });
  }

  return {
    status: 'cancelled',
    action: 'subscription_cancelled',
    subscriptionId,
    message: '订阅取消处理完成'
  };
}

// 处理订阅过期
async function handleSubscriptionExpired(data: CreemSubscriptionData) {
  const subscriptionId = normalizeSubscriptionId(data);
  const { metadata } = data;

  const orderId =
    metadata && typeof metadata === "object" && "order_id" in metadata ? (metadata as { order_id?: unknown }).order_id : null;
  if (typeof orderId === "string" && orderId.trim()) {
    await OrderService.mergeOrderMetadata(orderId.trim(), {
      subscription_id: subscriptionId ?? undefined,
      subscription_status: "expired",
      subscription_expired_at: new Date().toISOString(),
    });
  }

  return {
    status: 'expired',
    action: 'subscription_expired',
    subscriptionId,
    message: '订阅过期处理完成'
  };
}

// 支持 GET 请求用于测试
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const locale = searchParams.get('locale') || 'en';
  
  return NextResponse.json({
    message: 'Creem callback endpoint is working',
    locale,
    timestamp: new Date().toISOString()
  });
}

// POST（） handleCreemEvent
