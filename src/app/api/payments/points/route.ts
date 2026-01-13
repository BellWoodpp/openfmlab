import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth/server";
import { locales, defaultLocale, type Locale } from "@/i18n/types";
import { newCreemClient } from "@/lib/payments/creem";
import { OrderService } from "@/lib/orders/service";
import { findPointsPack } from "@/lib/pricing/points-packs";
import { listCreemProductsKeys, parseCreemProductsEnv } from "@/lib/payments/creem/products";
import { checkUserPaidMembership } from "@/lib/membership";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function respErr(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

function respData<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

function normalizeLocale(input: unknown): Locale {
  if (typeof input !== "string") return defaultLocale;
  return (locales as readonly string[]).includes(input) ? (input as Locale) : defaultLocale;
}

function getCreemProducts(): unknown {
  return parseCreemProductsEnv(process.env.CREEM_PRODUCTS);
}

function getStringMapping(products: unknown, key: string): string | null {
  if (!products || typeof products !== "object" || Array.isArray(products)) return null;
  const value = (products as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formatProductName(locale: Locale, credits: number): string {
  const baseByLocale: Partial<Record<Locale, string>> = {
    en: "Credits Top-up",
    zh: "积分充值",
    ja: "クレジットチャージ",
  };
  const base = baseByLocale[locale] ?? baseByLocale.en ?? "Credits Top-up";
  return `${base} (${credits.toLocaleString()} credits)`;
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.DATABASE_URL) {
      return respErr("DB_REQUIRED", 501);
    }

    const body: { pack_id?: string; locale?: unknown } = await req.json();
    const packId = body.pack_id;
    const locale = normalizeLocale(body.locale);

    if (!packId || typeof packId !== "string") {
      return respErr("invalid params: pack_id");
    }

    const pack = findPointsPack(locale, packId);
    if (!pack) {
      return respErr("invalid pack_id");
    }

    const session = await auth.api.getSession({ headers: req.headers });
    const userEmail = session?.user?.email;
    const userId = session?.user?.id;
    if (!userEmail || !userId) {
      return respErr("no auth, please sign-in", 401);
    }

    const membership = await checkUserPaidMembership(userId);
    if (!membership.isPaid) {
      return respErr("PRO_REQUIRED", 403);
    }

    const provider = process.env.PAY_PROVIDER || "creem";
    if (provider !== "creem") {
      return respErr("unsupported provider");
    }

    const requestId = randomUUID();
    const orderProductKey = `points:${pack.id}`;

    const order = await OrderService.createOrder({
      userId,
      productId: orderProductKey,
      productName: formatProductName(locale, pack.credits),
      productType: "one_time",
      amount: pack.price.toFixed(2),
      currency: pack.currency,
      paymentProvider: provider,
      customerEmail: userEmail,
      metadata: {
        locale,
        project: process.env.NEXT_PUBLIC_PROJECT_NAME || "",
        kind: "points_topup",
        pack_id: pack.id,
        credits: pack.credits,
        units: pack.units ?? 1,
      },
    });

    const products = getCreemProducts();
    const units = pack.units ?? 1;

    // Prefer a single "points:base" product + units for price multiples. Fallback to per-pack mapping if needed.
    const providerKey = getStringMapping(products, "points:base") ? "points:base" : orderProductKey;
    const providerProductId = getStringMapping(products, providerKey) ?? "";
    if (!providerProductId) {
      const configuredKeys = listCreemProductsKeys(products);
      return respErr(
        `points product is not configured: ${providerKey}. Configured keys: ${configuredKeys.length ? configuredKeys.join(", ") : "(none)"}`,
        500,
      );
    }

    const baseUrl = (process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000").replace(/\/$/, "");
    const successPath = locale === defaultLocale ? "/payment/success" : `/${locale}/payment/success`;
    const successUrl = `${baseUrl}${successPath}`;

    const client = newCreemClient();
    const result = await client.creem().createCheckout({
      xApiKey: client.apiKey(),
      createCheckoutRequest: {
        productId: providerProductId,
        requestId,
        units,
        customer: { email: userEmail },
        successUrl,
        metadata: {
          locale,
          project: process.env.NEXT_PUBLIC_PROJECT_NAME || "",
          kind: "points_topup",
          pack_id: pack.id,
          credits: String(pack.credits),
          units: String(units),
          order_id: order.id,
          order_number: order.orderNumber,
          user_email: userEmail,
        },
      },
    });

    await OrderService.updateOrderStatus(order.id, "pending", {
      paymentRequestId: requestId,
      paymentSessionId: result.id,
    });

    return respData({
      request_id: requestId,
      session_id: result.id,
      checkout_url: result.checkoutUrl,
      order_id: order.id,
    });
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    return respErr("checkout failed: " + errorMessage, 500);
  }
}
