import { NextRequest, NextResponse } from "next/server";
// 它从 Node.js 内置模块 crypto 中导入一个函数：randomUUID()，randomUUID() 的作用：生成一个 随机的 UUID（通用唯一识别码）
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth/server";
// 获取价格配置模块
import { getPricingConfig } from "@/lib/pricing/i18n-config";
// 这里用了 type，表示你只是在 TypeScript 里引入一个「类型」，不会被编译到 JavaScript 产物里。一般来说，PricingPeriod 可能是一个联合类型
// 导入一个创建 Creem 支付客户端的函数
import { newCreemClient } from "@/lib/payments/creem";
import { defaultLocale, locales } from "@/i18n/types";
import { and, eq } from "drizzle-orm";
import {
  listCreemProductsKeys,
  parseCreemProductsEnv,
  resolveCreemProductId,
  type CreemSupportedPeriod,
} from "@/lib/payments/creem/products";
// 导入订单业务的 “服务类”。
import { OrderService } from "@/lib/orders/service";
import { getUserMembershipDetails, type MembershipPeriod } from "@/lib/membership";
import { db } from "@/lib/db/client";
import { orders } from "@/lib/db/schema/orders";

// locale:本地化/地域设置
type Locale = Parameters<typeof getPricingConfig>[0];

const SUPPORTED_PERIODS = ["monthly", "yearly"] as const;
type SupportedPeriod = (typeof SUPPORTED_PERIODS)[number];

function normalizePeriod(input: unknown): SupportedPeriod {
  if (typeof input !== "string") return "monthly";
  return (SUPPORTED_PERIODS as readonly string[]).includes(input) ? (input as SupportedPeriod) : "monthly";
}

function normalizeLocale(input: unknown): Locale {
  if (typeof input !== "string") return defaultLocale as Locale;
  const candidate = input.trim();
  if (!candidate) return defaultLocale as Locale;
  return (locales as readonly string[]).includes(candidate) ? (candidate as Locale) : (defaultLocale as Locale);
}

function localizedBillingPeriod(locale: Locale, period: MembershipPeriod): string {
  const labels: Record<MembershipPeriod, Partial<Record<Locale, string>>> = {
    monthly: {
      en: "monthly",
      zh: "月付",
      ja: "月額",
      es: "mensual",
      ar: "شهري",
      id: "bulanan",
      pt: "mensal",
      fr: "mensuel",
      ru: "ежемесячный",
      de: "monatlich",
    },
    yearly: {
      en: "yearly",
      zh: "年付",
      ja: "年額",
      es: "anual",
      ar: "سنوي",
      id: "tahunan",
      pt: "anual",
      fr: "annuel",
      ru: "ежегодный",
      de: "jährlich",
    },
  };

  return labels[period][locale] ?? labels[period].en ?? period;
}

function membershipAlreadyActiveMessage(locale: Locale, period: MembershipPeriod): string {
  const p = localizedBillingPeriod(locale, period);
  const messages: Partial<Record<Locale, string>> = {
    en: `Your Professional membership is already active (${p}).`,
    zh: `你的专业版会员已生效（${p}），无需重复购买。`,
    ja: `すでにプロ会員が有効です（${p}）。重複購入は不要です。`,
    es: `Tu suscripción Professional ya está activa (${p}). No necesitas volver a comprar.`,
    ar: `اشتراك Professional لديك نشط بالفعل (${p}). لا حاجة لإعادة الشراء.`,
    id: `Langganan Professional Anda sudah aktif (${p}). Tidak perlu membeli lagi.`,
    pt: `Sua assinatura Professional já está ativa (${p}). Não é necessário comprar novamente.`,
    fr: `Votre abonnement Professional est déjà actif (${p}). Inutile de repayer.`,
    ru: `Ваша подписка Professional уже активна (${p}). Повторная покупка не требуется.`,
    de: `Dein Professional-Abo ist bereits aktiv (${p}). Du musst nicht erneut kaufen.`,
  };

  return messages[locale] ?? messages.en ?? "Membership already active.";
}

function membershipUpgradeRequestFailedMessage(locale: Locale): string {
  const messages: Partial<Record<Locale, string>> = {
    en: "Upgrade request failed. No charge was captured. Please try again later.",
    zh: "升级请求失败，未完成扣款。请稍后重试。",
    ja: "アップグレードのリクエストに失敗しました。請求は発生していません。しばらくしてから再試行してください。",
    es: "Falló la solicitud de actualización. No se realizó ningún cargo. Inténtalo de nuevo más tarde.",
    ar: "فشل طلب الترقية. لم يتم تحصيل أي مبلغ. يُرجى المحاولة لاحقًا.",
    id: "Permintaan upgrade gagal. Tidak ada biaya yang ditagihkan. Silakan coba lagi nanti.",
    pt: "Falha ao solicitar o upgrade. Nenhuma cobrança foi efetuada. Tente novamente mais tarde.",
    fr: "Échec de la demande de mise à niveau. Aucun débit n’a été effectué. Réessayez plus tard.",
    ru: "Запрос на апгрейд не удалось выполнить. Списание не произошло. Попробуйте позже.",
    de: "Upgrade-Anfrage fehlgeschlagen. Es wurde nichts abgebucht. Bitte später erneut versuchen.",
  };
  return messages[locale] ?? messages.en ?? "Upgrade request failed.";
}

function membershipUpgradeSubscriptionNotFoundMessage(locale: Locale): string {
  const messages: Partial<Record<Locale, string>> = {
    en: "We couldn't find your Creem subscription. Please open your latest order and click “Refresh Status”, then try again.",
    zh: "未能找到你的 Creem 订阅。请打开最近的一笔订单并点击「Refresh Status」，然后再重试。",
    ja: "Creem のサブスク情報が見つかりません。最新の注文で「Refresh Status」を押してから、もう一度お試しください。",
    es: "No pudimos encontrar tu suscripción de Creem. Abre tu último pedido y haz clic en “Refresh Status”, luego inténtalo de nuevo.",
    ar: "تعذر العثور على اشتراك Creem الخاص بك. افتح أحدث طلب واضغط “Refresh Status” ثم أعد المحاولة.",
    id: "Kami tidak dapat menemukan langganan Creem Anda. Buka pesanan terbaru lalu klik “Refresh Status”, kemudian coba lagi.",
    pt: "Não foi possível encontrar sua assinatura Creem. Abra seu pedido mais recente e clique em “Refresh Status”, depois tente novamente.",
    fr: "Impossible de trouver votre abonnement Creem. Ouvrez votre dernière commande et cliquez sur « Refresh Status », puis réessayez.",
    ru: "Не удалось найти вашу подписку Creem. Откройте последний заказ и нажмите “Refresh Status”, затем попробуйте снова.",
    de: "Wir konnten dein Creem-Abo nicht finden. Öffne deine letzte Bestellung und klicke auf „Refresh Status“, dann versuche es erneut.",
  };
  return messages[locale] ?? messages.en ?? "Subscription not found.";
}

function membershipUpgradePendingMessage(locale: Locale): string {
  const messages: Partial<Record<Locale, string>> = {
    en: "Upgrade requested. Creem hasn’t returned the proration transaction yet (or your card needs confirmation). Please check Creem → Transactions, or wait a moment and try “Refresh Status”.",
    zh: "已发起升级，但 Creem 暂未返回差价交易（或你的卡需要验证）。请在 Creem 后台查看 Transactions，或稍等片刻后点击「Refresh Status」。",
    ja: "アップグレード要求は送信されましたが、Creem 側で差額取引がまだ反映されていません（またはカード確認が必要です）。Creem の Transactions を確認するか、少し待ってから「Refresh Status」をお試しください。",
    es: "Se solicitó la actualización, pero Creem aún no devolvió la transacción prorrateada (o tu tarjeta requiere confirmación). Revisa Creem → Transactions o espera un momento y prueba “Refresh Status”.",
    ar: "تم طلب الترقية، لكن Creem لم يُرجع معاملة الفروقات بعد (أو أن بطاقتك تحتاج إلى تأكيد). راجع Creem → Transactions أو انتظر قليلاً وجرّب “Refresh Status”.",
    id: "Upgrade sudah diminta, namun Creem belum mengembalikan transaksi prorata (atau kartu Anda perlu konfirmasi). Cek Creem → Transactions, atau tunggu sebentar lalu coba “Refresh Status”.",
    pt: "Upgrade solicitado, mas a Creem ainda não retornou a transação de prorrata (ou seu cartão precisa de confirmação). Verifique Creem → Transactions ou aguarde e tente “Refresh Status”.",
    fr: "Mise à niveau demandée, mais Creem n’a pas encore renvoyé la transaction de prorata (ou votre carte nécessite une confirmation). Vérifiez Creem → Transactions, ou attendez et essayez « Refresh Status ».",
    ru: "Запрос на апгрейд отправлен, но Creem ещё не вернул транзакцию прорации (или требуется подтверждение карты). Проверьте Creem → Transactions или подождите и нажмите “Refresh Status”.",
    de: "Upgrade angefordert, aber Creem hat die Prorations-Transaktion noch nicht zurückgegeben (oder deine Karte benötigt eine Bestätigung). Prüfe Creem → Transactions oder warte kurz und nutze „Refresh Status“.",
  };
  return messages[locale] ?? messages.en ?? "Upgrade pending.";
}

function respErr(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

function respData<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

function centsToDecimalString(cents: number): string {
  const safe = Number.isFinite(cents) ? cents : 0;
  return (safe / 100).toFixed(2);
}

function timestampToDate(ts: number): Date {
  if (!Number.isFinite(ts)) return new Date();
  return ts < 1_000_000_000_000 ? new Date(ts * 1000) : new Date(ts);
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function userHasAnyProfessionalOrder(userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.userId, userId), eq(orders.productId, "professional"), eq(orders.status, "paid")))
    .limit(1);
  return rows.length > 0;
}

async function tryCreateMonthlyIntroDiscountUsd(opts: {
  userId: string;
  providerProductId: string;
}): Promise<{ code: string; amountOffCents: number } | null> {
  // Intro: $6 -> $4 for the first charge, then renew at $6.
  const amountOffCents = 200;
  const currency = "USD";

  const code = `PRO4-${randomUUID().split("-")[0]?.toUpperCase() || randomUUID().slice(0, 8).toUpperCase()}`;
  const client = newCreemClient();

  try {
    await client.creem().createDiscount({
      xApiKey: client.apiKey(),
      createDiscountRequestEntity: {
        name: `Professional intro ($2 off) - ${opts.userId}`,
        code,
        type: "fixed",
        amount: amountOffCents,
        currency,
        duration: "once",
        maxRedemptions: 1,
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        appliesToProducts: [opts.providerProductId],
      },
    });

    return { code, amountOffCents };
  } catch (err) {
    console.warn("[payments] createDiscount failed; falling back to list price:", err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const {
      product_id,
      period: periodRaw,
      locale: localeRaw,
      intro_discount,
    }: { product_id?: string; period?: unknown; locale?: unknown; intro_discount?: unknown } = await req.json();

    const checkoutLocale = normalizeLocale(localeRaw);
    const pricingLocale = defaultLocale as Locale;

    if (!product_id) {
      return respErr("invalid params: product_id");
    }

    // 使用当前系统的定价配置校验 plan 是否存在
    // Payment pricing uses the default locale config (single currency/amount source of truth).
    const pricingConfig = getPricingConfig(pricingLocale);
    const plan = pricingConfig.plans.find((p) => p.id === product_id);
    if (!plan) {
      return respErr("invalid product_id");
    }

    // 从会话中获取用户（better-auth）
    const session = await auth.api.getSession({ headers: req.headers });
    const userEmail = session?.user?.email;
    const userId = session?.user?.id;
    if (!userEmail || !userId) {
      return respErr("no auth, please sign-in", 401);
    }

    // Prevent duplicate checkouts if the user already has an active membership in our system.
    // If the user changes billing period (monthly <-> yearly), attempt an in-place subscription upgrade.
    if (product_id === "professional") {
      const status = await getUserMembershipDetails(userId);
      if (status.isPaid) {
        const currentPeriod = status.period;
        const requestedPeriod = normalizePeriod(periodRaw) as MembershipPeriod;

        if (!currentPeriod || currentPeriod === requestedPeriod) {
          return respErr(membershipAlreadyActiveMessage(checkoutLocale, requestedPeriod), 409);
        }

        // Attempt provider-side upgrade without creating a second subscription.
        const parsedProducts = parseCreemProductsEnv(process.env.CREEM_PRODUCTS);
        const targetProductId = resolveCreemProductId({
          parsedProducts,
          productKey: product_id,
          period: requestedPeriod as CreemSupportedPeriod,
        });
        if (!targetProductId) {
          const configuredKeys = listCreemProductsKeys(parsedProducts);
          throw new Error(
            `CREEM_PRODUCTS missing mapping for ${product_id}:${requestedPeriod}. Configured keys: ${configuredKeys.length ? configuredKeys.join(", ") : "(none)"}`,
          );
        }

        const client = newCreemClient();

        let subscriptionId = status.subscriptionId;
        if (!subscriptionId && status.paymentSessionId) {
          const checkout = await client.creem().retrieveCheckout({
            xApiKey: client.apiKey(),
            checkoutId: status.paymentSessionId,
          });
          subscriptionId =
            typeof checkout.subscription === "string"
              ? checkout.subscription
              : checkout.subscription && typeof checkout.subscription === "object" && "id" in checkout.subscription
                ? String((checkout.subscription as { id?: unknown }).id ?? "")
                : null;

          if (subscriptionId && status.orderId) {
            await OrderService.mergeOrderMetadata(status.orderId, { subscription_id: subscriptionId });
          }
        }

        if (!subscriptionId || !status.orderId) {
          return respErr(membershipUpgradeSubscriptionNotFoundMessage(checkoutLocale), 409);
        }

        try {
          await client.creem().upgradeSubscription({
            xApiKey: client.apiKey(),
            id: subscriptionId,
            upgradeSubscriptionRequestEntity: {
              productId: targetProductId,
              updateBehavior: "proration-charge-immediately",
            },
          });
        } catch (err) {
          console.warn("[payments] upgradeSubscription failed:", err);
          return respErr(membershipUpgradeRequestFailedMessage(checkoutLocale), 502);
        }

        const redirectUrl = checkoutLocale === defaultLocale ? "/membership" : `/${checkoutLocale}/membership`;
        try {
          const isRecord = (value: unknown): value is Record<string, unknown> =>
            !!value && typeof value === "object" && !Array.isArray(value);

          const productIdFromSubscription = (subscription: unknown): string | null => {
            if (!isRecord(subscription)) return null;
            const product = subscription.product;
            if (typeof product === "string" && product.trim()) return product.trim();
            if (isRecord(product) && typeof product.id === "string" && product.id.trim()) return product.id.trim();
            return null;
          };

          let subscription: {
            product?: unknown;
            lastTransactionId?: string;
            customer?: unknown;
            lastTransaction?: {
              id: string;
              amount: number;
              amountPaid?: number;
              currency: string;
              createdAt: number;
            };
          } | null = null;

          for (let attempt = 0; attempt < 4; attempt++) {
            subscription = await client.creem().retrieveSubscription({
              xApiKey: client.apiKey(),
              subscriptionId,
            });

            const productId = productIdFromSubscription(subscription);
            const hasTx = Boolean(subscription?.lastTransaction || subscription?.lastTransactionId);
            if (productId === targetProductId || hasTx) break;
            await sleep(450 * (attempt + 1));
          }

          const productId = productIdFromSubscription(subscription);
          if (productId && productId !== targetProductId) {
            return respData(
              {
                action: "upgrade_pending",
                redirect_url: redirectUrl,
                message: membershipUpgradePendingMessage(checkoutLocale),
                subscription_id: subscriptionId,
              },
              200,
            );
          }

          const lastTxId = subscription?.lastTransactionId ?? null;
          const customerId = (() => {
            const raw = subscription?.customer;
            if (typeof raw === "string" && raw.trim()) return raw.trim();
            if (raw && typeof raw === "object" && "id" in raw) {
              const id = (raw as { id?: unknown }).id;
              return typeof id === "string" && id.trim() ? id.trim() : null;
            }
            return null;
          })();

          let tx = subscription?.lastTransaction ?? null;
          if (!tx && lastTxId && customerId) {
            const txList = await client.creem().searchTransactions({
              xApiKey: client.apiKey(),
              customerId,
              pageNumber: 1,
              pageSize: 50,
            });
            tx = txList.items?.find((item) => item.id === lastTxId) ?? null;
          }

          if (!tx) {
            return respData(
              {
                action: "upgrade_pending",
                redirect_url: redirectUrl,
                message: membershipUpgradePendingMessage(checkoutLocale),
                subscription_id: subscriptionId,
              },
              200,
            );
          }

          const txId = tx.id ?? lastTxId ?? null;
          const txCurrency = typeof tx.currency === "string" && tx.currency.trim() ? tx.currency : null;
          const txCentsRaw = typeof tx.amountPaid === "number" ? tx.amountPaid : typeof tx.amount === "number" ? tx.amount : 0;
          const paidAt = typeof tx.createdAt === "number" ? timestampToDate(tx.createdAt) : new Date();
          const upgradeRequestId = randomUUID();

          const upgradePricing = plan.pricing[requestedPeriod];
          const orderCurrency = txCurrency ?? upgradePricing?.currency ?? "USD";

          const upgradeOrder = await OrderService.createOrder({
            userId,
            productId: "professional",
            productName: plan.name,
            productType: "subscription",
            amount: centsToDecimalString(txCentsRaw),
            currency: orderCurrency,
            paymentProvider: "creem",
            customerEmail: userEmail,
            metadata: {
              locale: checkoutLocale,
              pricing_locale: pricingLocale,
              project: process.env.NEXT_PUBLIC_PROJECT_NAME || "",
              plan_id: plan.id,
              plan_period: requestedPeriod,
              kind: "subscription_upgrade",
              subscription_id: subscriptionId,
              upgrade_from_order_id: status.orderId,
              upgrade_from_period: currentPeriod,
              upgrade_to_period: requestedPeriod,
              creem_transaction_id: txId,
              creem_target_product_id: targetProductId,
            },
          });

          await OrderService.updateOrderStatus(upgradeOrder.id, "paid", {
            paymentRequestId: upgradeRequestId,
            paidAt,
          });

          await OrderService.mergeOrderMetadata(status.orderId, {
            upgrade_to_period: requestedPeriod,
            upgraded_order_id: upgradeOrder.id,
            upgraded_at: paidAt.toISOString(),
          });

          return respData({ action: "upgraded", redirect_url: redirectUrl });
        } catch (err) {
          console.warn("[payments] upgrade succeeded but could not confirm transaction:", err);
          return respData(
            {
              action: "upgrade_pending",
              redirect_url: redirectUrl,
              message: membershipUpgradePendingMessage(checkoutLocale),
              subscription_id: subscriptionId,
            },
            200,
          );
        }
      }
    }

    // 生成请求 ID（替代原订单号）
    const requestId = randomUUID();

    // 仅在 creem 时创建会话（当前仅支持 creem）
    const provider = process.env.PAY_PROVIDER || "creem";
    if (provider !== "creem") {
      return respErr("unsupported provider");
    }

    // 获取价格信息
    const period = normalizePeriod(periodRaw);
    const pricing = plan.pricing[period];
    if (!pricing) {
      return respErr("invalid pricing config");
    }

    const parsedProducts = parseCreemProductsEnv(process.env.CREEM_PRODUCTS);

    // Optional intro discount: monthly Professional in USD only (first purchase only).
    let discountCode: string | undefined;
    let orderAmount = pricing.price;
    let orderMetadataExtra: Record<string, unknown> | undefined;

    const introRequested = intro_discount !== false;

    if (introRequested && product_id === "professional" && period === "monthly" && pricing.currency === "USD") {
      const hasAny = await userHasAnyProfessionalOrder(userId);
      if (!hasAny) {
        const providerProductId = resolveCreemProductId({
          parsedProducts,
          productKey: product_id,
          period: period as CreemSupportedPeriod,
        });

        if (providerProductId) {
          const discount = await tryCreateMonthlyIntroDiscountUsd({
            userId,
            providerProductId,
          });
          if (discount) {
            discountCode = discount.code;
            orderAmount = Math.max(0, pricing.price - discount.amountOffCents / 100);
            orderMetadataExtra = {
              intro_discount: {
                code: discount.code,
                currency: "USD",
                amount_off_cents: discount.amountOffCents,
                list_price: pricing.price,
                applied: true,
              },
            };
          }
        }
      }
    }

    // 创建订单
    const order = await OrderService.createOrder({
      userId,
      productId: product_id,
      productName: plan.name,
      productType: "subscription",
      amount: orderAmount.toFixed(2),
      currency: pricing.currency,
      paymentProvider: provider,
      customerEmail: userEmail,
      metadata: {
        locale: checkoutLocale,
        pricing_locale: pricingLocale,
        project: process.env.NEXT_PUBLIC_PROJECT_NAME || "",
        plan_id: plan.id,
        plan_period: period,
        ...(orderMetadataExtra ?? {}),
      },
    });

    console.log('订单创建成功:', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      productId: product_id,
      amount: pricing.price,
    });

    // 先把 requestId 关联到订单上：即使后续创建 checkout 失败，也能通过 requestId 追踪到订单。
    await OrderService.updateOrderStatus(order.id, "pending", {
      paymentRequestId: requestId,
    });

    const param: {
      productKey: string;
      period: SupportedPeriod;
      locale: string;
      requestId: string;
      customerEmail: string;
      metadata: Record<string, string>;
      discountCode?: string;
    } = {
      productKey: product_id,
      period,
      locale: checkoutLocale,
      requestId,
      customerEmail: userEmail,
      discountCode,
      metadata: {
        project: process.env.NEXT_PUBLIC_PROJECT_NAME || "",
        user_id: userId,
        product_name: plan.name,
        plan_id: plan.id,
        plan_period: period,
        user_email: userEmail,
        order_id: order.id,
        order_number: order.orderNumber,
        ...(discountCode ? { intro_discount_code: discountCode } : {}),
      },
    };
    const result = await creemCheckout(param);

    return respData(result);
  } catch (e: unknown) {
    console.log("checkout failed: ", e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return respErr("checkout failed: " + errorMessage);
  }
}


async function creemCheckout({
  productKey,
  period,
  locale,
  requestId,
  customerEmail,
  metadata,
  discountCode,
}: {
  productKey: string;
  period: SupportedPeriod;
  locale: string;
  requestId: string;
  customerEmail: string;
  metadata?: Record<string, unknown>;
  discountCode?: string;
}) {
  const client = newCreemClient();

  const providerProductId = resolveCreemProductId({
    parsedProducts: parseCreemProductsEnv(process.env.CREEM_PRODUCTS),
    productKey,
    period: period as CreemSupportedPeriod,
  });
  if (!providerProductId) {
    const configuredKeys = listCreemProductsKeys(parseCreemProductsEnv(process.env.CREEM_PRODUCTS));
    const expectedKey = `${productKey}:${period}`;
    throw new Error(
      `CREEM_PRODUCTS missing mapping for ${expectedKey}. Configured keys: ${configuredKeys.length ? configuredKeys.join(", ") : "(none)"}`,
    );
  }

  const baseUrl = (process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000").replace(/\/$/, "");
  const successPath = locale === defaultLocale ? "/payment/success" : `/${locale}/payment/success`;
  const success_url = `${baseUrl}${successPath}`;
  
  // 确保所有必填字段都有值，provider:供应商，throw:抛出
  if (!providerProductId || !requestId || !customerEmail || !success_url) {
    throw new Error("Missing required fields for checkout");
  }
  
  const createCheckoutRequest = {
    productId: providerProductId,
    requestId,
    customer: {
      email: customerEmail,
    },
    ...(discountCode ? { discountCode } : {}),
    successUrl: success_url,
    metadata: {
      locale,
      ...(metadata || {}),
    },
  };
  const result = await client.creem().createCheckout({
    xApiKey: client.apiKey(),
    createCheckoutRequest: createCheckoutRequest
  });

  // 更新订单的支付请求ID
  const orderId = metadata?.order_id as string;
  if (orderId) {
    await OrderService.updateOrderStatus(orderId, "pending", {
      paymentSessionId: result.id,
    });
    console.log('订单支付信息更新:', {
      orderId,
      paymentRequestId: requestId,
      paymentSessionId: result.id,
    });
  }

  return {
    request_id: requestId,
    session_id: result.id,
    checkout_url: result.checkoutUrl,
    order_id: orderId,
  };
}
