"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/i18n/types";
import { defaultLocale } from "@/i18n/types";
import type { PaymentSuccessDictionary } from "@/i18n/pages/payment";
import { resolveIntlLocale, resolveIntlNumberLocale } from "@/i18n/locale-config";

interface PaymentSuccessHandlerProps {
  searchParams: {
    request_id?: string;
    checkout_id?: string;
    order_id?: string;
    customer_id?: string;
    product_id?: string;
    signature?: string;
  };
  dictionary: PaymentSuccessDictionary;
  locale: Locale;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  productId?: string;
  productType?: string;
  productName: string;
  amount: string;
  currency: string;
  credits?: number | null;
  planPeriod?: "monthly" | "yearly" | null;
  membershipTokens?: number | null;
  paidAt: string | null;
  createdAt: string;
}

export function PaymentSuccessHandler({
  searchParams,
  dictionary,
  locale,
}: PaymentSuccessHandlerProps) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceBefore, setBalanceBefore] = useState<number | null>(null);
  const [balanceAfter, setBalanceAfter] = useState<number | null>(null);
  const { errors } = dictionary;
  const pendingLabelByLocale: Partial<Record<Locale, string>> = {
    en: "Pending",
    zh: "处理中",
    ja: "処理中",
  };

  const numberFormat = new Intl.NumberFormat(resolveIntlNumberLocale(locale));

  function parseIntSafe(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return Math.floor(value);
    if (typeof value !== "string") return null;
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.floor(n);
  }

  useEffect(() => {
    async function handlePaymentSuccess() {
      if (!searchParams.request_id) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/payment/success", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(searchParams),
        });

        const data = await response.json();

        if (data.success && data.order) {
          setOrder(data.order);
        } else {
          setError(data.error || errors.generic);
        }
      } catch (err) {
        console.error("处理支付成功时发生错误:", err);
        setError(errors.network);
      } finally {
        setLoading(false);
      }
    }

    handlePaymentSuccess();
  }, [searchParams, errors.generic, errors.network]);

  useEffect(() => {
    const isPointsTopup =
      order?.productType === "one_time" && typeof order.productId === "string" && order.productId.startsWith("points:");
    const isProfessionalSubscription = order?.productType === "subscription" && order?.productId === "professional";
    if (!order || (!isPointsTopup && !isProfessionalSubscription)) return;

    const currentOrder = order;
    let cancelled = false;

    async function loadBalances() {
      setBalanceLoading(true);
      try {
        let before: number | null = null;
        let packCredits: number | null = null;
        let expectedAdd: number | null = null;

        try {
          if (isPointsTopup) {
            const rawBefore = window.sessionStorage.getItem("points_tokens_before");
            before = parseIntSafe(rawBefore);
            const rawCredits = window.sessionStorage.getItem("points_pack_credits");
            packCredits = parseIntSafe(rawCredits);
          } else {
            const rawBefore = window.sessionStorage.getItem("pro_tokens_before");
            before = parseIntSafe(rawBefore);
            const rawExpected = window.sessionStorage.getItem("pro_expected_add");
            expectedAdd = parseIntSafe(rawExpected);
          }
        } catch {
          // ignore
        }

        const creditsAdded = isPointsTopup
          ? typeof currentOrder.credits === "number" && Number.isFinite(currentOrder.credits)
            ? Math.floor(currentOrder.credits)
            : packCredits
          : typeof currentOrder.membershipTokens === "number" && Number.isFinite(currentOrder.membershipTokens)
            ? Math.floor(currentOrder.membershipTokens)
            : expectedAdd;

        const expectedAfter = before !== null && creditsAdded !== null ? before + creditsAdded : null;

        let after: number | null = null;
        for (let i = 0; i < 20; i++) {
          const resp = await fetch("/api/tokens", { cache: "no-store" });
          const json = (await resp.json().catch(() => null)) as { data?: { tokens?: unknown } } | null;
          const next = parseIntSafe(json?.data?.tokens);
          if (typeof next === "number") {
            after = next;
            if (expectedAfter !== null) {
              if (after >= expectedAfter) break;
            } else {
              break;
            }
          }
          await new Promise((r) => setTimeout(r, 1000));
        }

        if (before === null && after !== null && creditsAdded !== null) {
          before = Math.max(0, after - creditsAdded);
        }

        if (!cancelled) {
          setBalanceBefore(before);
          setBalanceAfter(after);
        }

        try {
          if (isPointsTopup) {
            window.sessionStorage.removeItem("points_tokens_before");
            window.sessionStorage.removeItem("points_pack_credits");
          } else {
            window.sessionStorage.removeItem("pro_tokens_before");
            window.sessionStorage.removeItem("pro_expected_add");
          }
        } catch {
          // ignore
        }
      } catch {
        if (!cancelled) {
          setBalanceBefore(null);
          setBalanceAfter(null);
        }
      } finally {
        if (!cancelled) setBalanceLoading(false);
      }
    }

    loadBalances();
    return () => {
      cancelled = true;
    };
  }, [order]);

  const useProductHref = locale === defaultLocale ? "/podcast-mvp" : `/${locale}/podcast-mvp`;
  const ordersHref = locale === defaultLocale ? "/orders" : `/${locale}/orders`;
  const supportHref = locale === defaultLocale ? "/contact" : `/${locale}/contact`;

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-green-50 to-blue-50 dark:from-neutral-900 dark:to-neutral-800">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
              <svg
                className="h-8 w-8 text-green-600 dark:text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.5 12.75l6 6 9-13.5"
                />
              </svg>
            </div>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 sm:text-6xl">
              {dictionary.title}
            </h1>
            <p className="mt-6 text-lg leading-8 text-neutral-600 dark:text-neutral-300">
              {dictionary.subtitle}
            </p>
            <p className="mt-4 text-base text-neutral-500 dark:text-neutral-400 max-w-2xl mx-auto">
              {dictionary.description}
            </p>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900 dark:border-neutral-100"></div>
            <p className="mt-4 text-neutral-600 dark:text-neutral-400">
              {dictionary.loading.processing}
            </p>
          </div>
        )}

        {error && (
          <div className="mb-8 rounded-lg bg-red-50 dark:bg-red-900/20 p-4 border border-red-200 dark:border-red-800">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                  {error}
                </h3>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Order Details */}
            {order && (
              <div>
                <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-6">
                  {dictionary.order.title}
                </h2>
                <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-6 space-y-4">
                  <div className="flex justify-between">
                    <span className="text-neutral-600 dark:text-neutral-300">
                      {dictionary.order.number}
                      :
                    </span>
                    <span className="font-mono text-sm text-neutral-900 dark:text-neutral-100">
                      {order.orderNumber}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600 dark:text-neutral-300">
                      {dictionary.order.product}
                      :
                    </span>
                    <span className="text-neutral-900 dark:text-neutral-100">
                      {order.productName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600 dark:text-neutral-300">
                      {dictionary.order.amount}
                      :
                    </span>
                    <span className="text-neutral-900 dark:text-neutral-100 font-semibold">
                      {order.currency} {order.amount}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600 dark:text-neutral-300">
                      {dictionary.order.paidAt}
                      :
                    </span>
                    <span className="text-neutral-900 dark:text-neutral-100">
                      {order.paidAt
                        ? new Date(order.paidAt).toLocaleString(resolveIntlLocale(locale))
                        : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600 dark:text-neutral-300">
                      {dictionary.order.status}
                      :
                    </span>
                    {(() => {
                      const status = order.status;
                      const isPaid = status === "paid";
                      const label =
                        status === "pending"
                          ? (pendingLabelByLocale[locale] ?? pendingLabelByLocale.en ?? "Pending")
                          : isPaid
                            ? dictionary.order.paidLabel
                            : status;

                      const classes = isPaid
                        ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                        : status === "pending"
                          ? "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200"
                          : "bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200";

                      return (
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classes}`}
                        >
                          {label}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

            {dictionary.balanceChange &&
              (order?.productType === "one_time" &&
                typeof order.productId === "string" &&
                order.productId.startsWith("points:") ||
                (order?.productType === "subscription" && order?.productId === "professional")) &&
              dictionary.balanceChange && (
                <div>
                  <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-6">
                    {dictionary.balanceChange.title}
                  </h2>
                  <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-6">
                    {balanceLoading ? (
                      <div className="space-y-3">
                        <div className="h-8 w-56 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                        <div className="h-4 w-40 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-6" dir="ltr">
                        <div className="flex-1">
                          <div className="text-xs text-neutral-600 dark:text-neutral-400">{dictionary.balanceChange.before}</div>
                          <div className="mt-1 text-2xl font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">
                            {balanceBefore === null ? "—" : numberFormat.format(balanceBefore)}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl text-neutral-400 dark:text-neutral-500">→</div>
                          {balanceBefore !== null && balanceAfter !== null ? (
                            <div className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 tabular-nums">
                              +{numberFormat.format(Math.max(0, balanceAfter - balanceBefore))}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex-1 text-right">
                          <div className="text-xs text-neutral-600 dark:text-neutral-400">{dictionary.balanceChange.after}</div>
                          <div className="mt-1 text-2xl font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">
                            {balanceAfter === null ? "—" : numberFormat.format(balanceAfter)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

            {/* Payment Params (if order not loaded) */}
            {!order &&
              (searchParams.request_id ||
                searchParams.checkout_id ||
                searchParams.order_id) && (
                <div>
                  <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-6">
                    {dictionary.paymentDetails.title}
                  </h2>
                  <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-6 space-y-4">
                    {searchParams.request_id && (
                      <div className="flex justify-between">
                        <span className="text-neutral-600 dark:text-neutral-300">
                          {dictionary.paymentDetails.requestId}:
                        </span>
                        <span className="font-mono text-sm text-neutral-900 dark:text-neutral-100">
                          {searchParams.request_id}
                        </span>
                      </div>
                    )}
                    {searchParams.checkout_id && (
                      <div className="flex justify-between">
                        <span className="text-neutral-600 dark:text-neutral-300">
                          {dictionary.paymentDetails.checkoutId}:
                        </span>
                        <span className="font-mono text-sm text-neutral-900 dark:text-neutral-100">
                          {searchParams.checkout_id}
                        </span>
                      </div>
                    )}
                    {searchParams.order_id && (
                      <div className="flex justify-between">
                        <span className="text-neutral-600 dark:text-neutral-300">
                          {dictionary.paymentDetails.orderId}:
                        </span>
                        <span className="font-mono text-sm text-neutral-900 dark:text-neutral-100">
                          {searchParams.order_id}
                        </span>
                      </div>
                    )}
                    {searchParams.customer_id && (
                      <div className="flex justify-between">
                        <span className="text-neutral-600 dark:text-neutral-300">
                          {dictionary.paymentDetails.customerId}:
                        </span>
                        <span className="font-mono text-sm text-neutral-900 dark:text-neutral-100">
                          {searchParams.customer_id}
                        </span>
                      </div>
                    )}
                    {searchParams.product_id && (
                      <div className="flex justify-between">
                        <span className="text-neutral-600 dark:text-neutral-300">
                          {dictionary.paymentDetails.productId}:
                        </span>
                        <span className="font-mono text-sm text-neutral-900 dark:text-neutral-100">
                          {searchParams.product_id}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

            {/* Features */}
            <div>
              <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-6">
                {dictionary.features.title}
              </h2>
              <ul className="space-y-4">
                {dictionary.features.items.map((item: string, index: number) => (
                  <li key={index} className="flex items-start">
                    <svg
                      className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="1.5"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4.5 12.75l6 6 9-13.5"
                      />
                    </svg>
                    <span className="text-neutral-600 dark:text-neutral-300">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-6 text-center">
            {dictionary.quickActionsTitle}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
            <Link
              href={useProductHref}
              className="block w-full rounded-lg bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              {dictionary.actions.goToDashboard}
            </Link>
            <Link
              href={ordersHref}
              className="block w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-4 py-3 text-center text-sm font-semibold text-neutral-900 dark:text-neutral-100 shadow-sm hover:bg-neutral-50 dark:hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              {dictionary.actions.viewOrders}
            </Link>
            <Link
              href={supportHref}
              className="block w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-4 py-3 text-center text-sm font-semibold text-neutral-900 dark:text-neutral-100 shadow-sm hover:bg-neutral-50 dark:hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              {dictionary.actions.contactSupport}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
