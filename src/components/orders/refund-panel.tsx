"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefundTerms } from "@/components/orders/refund-terms";
import { getRefundCopy } from "@/components/orders/refund-i18n";
import { cn } from "@/lib/utils";

type RefundEstimate = {
  ok: true;
  kind: "membership_monthly" | "membership_yearly" | "points";
  currency: string;
  originalAmountCents: number;
  refundableAmountCents: number;
  feeCents: number;
  netRefundCents: number;
  details: Record<string, string | number | boolean | null>;
};

type RefundEstimateResponse =
  | { ok: true; data: RefundEstimate }
  | { ok: false; error: string };

type RefundRequestResponse =
  | { ok: true; data: { refundRequest?: unknown; subscriptionCancel?: unknown } }
  | { ok: false; message?: string };

function formatMoney(cents: number, currency: string) {
  const value = (Number.isFinite(cents) ? cents : 0) / 100;
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);
}

export function RefundPanel({
  orderId,
  locale,
  className,
  onSubmitted,
}: {
  orderId: string;
  locale: string;
  className?: string;
  onSubmitted?: () => void;
}) {
  const copy = getRefundCopy(locale);
  const [loading, setLoading] = useState(true);
  const [estimate, setEstimate] = useState<RefundEstimate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadEstimate() {
      setLoading(true);
      setError(null);
      try {
        const resp = await fetch(`/api/refunds/estimate?orderId=${encodeURIComponent(orderId)}`, { cache: "no-store" });
        const json = (await resp.json().catch(() => null)) as RefundEstimateResponse | null;
        if (cancelled) return;
        if (!resp.ok || !json || json.ok === false) {
          setEstimate(null);
          setError((json as { error?: string } | null)?.error ?? "Failed to load refund estimate");
          return;
        }
        setEstimate(json.data);
      } catch {
        if (!cancelled) setError("Failed to load refund estimate");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadEstimate();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const detailsLines = useMemo(() => {
    if (!estimate) return [];
    const d = estimate.details || {};

    if (estimate.kind === "membership_monthly" || estimate.kind === "membership_yearly") {
      return [
        `${copy.panel.details.tokensPurchased}: ${d.tokensPurchased ?? "—"}`,
        `${copy.panel.details.refundableTokens}: ${d.refundableTokens ?? "—"}`,
        `${copy.panel.details.availableTokens}: ${d.userAvailableTokens ?? "—"}`,
      ];
    }

    return [
      `${copy.panel.details.refundableCredits}: ${d.refundableCredits ?? "—"}`,
      `${copy.panel.details.availableCredits}: ${d.userAvailableTokens ?? "—"}`,
    ];
  }, [copy.panel.details, estimate]);

  const submit = async () => {
    if (!accepted || !estimate) return;
    setSubmitting(true);
    setError(null);
    try {
      const resp = await fetch("/api/refunds/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, accepted: true, policyVersion: "v1" }),
      });
      const json = (await resp.json().catch(() => null)) as RefundRequestResponse | null;
      if (!resp.ok || !json || json.ok === false) {
        setError((json as { message?: string } | null)?.message ?? "Failed to submit refund request");
        return;
      }
      setSubmitted(true);
      onSubmitted?.();
    } catch {
      setError("Failed to submit refund request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>{copy.panel.title}</span>
          {estimate ? (
            <Badge variant="secondary">
              {copy.panel.estimatedNet}: {formatMoney(estimate.netRefundCents, estimate.currency)}
            </Badge>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="text-sm text-neutral-600 dark:text-neutral-400">{copy.panel.calculating}</div>
        ) : error ? (
          <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
        ) : estimate ? (
          <div className="space-y-2">
            <div className="grid gap-1 text-sm text-neutral-700 dark:text-neutral-200">
              <div className="flex items-center justify-between">
                <span>{copy.panel.originalAmount}</span>
                <span className="font-medium">{formatMoney(estimate.originalAmountCents, estimate.currency)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>{copy.panel.refundableBeforeFee}</span>
                <span className="font-medium">{formatMoney(estimate.refundableAmountCents, estimate.currency)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1">
                  {copy.panel.fee}
                  <span className="relative inline-flex">
                    <span
                      className="group inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-neutral-300 text-[10px] leading-none text-neutral-700 dark:border-neutral-700 dark:text-neutral-200"
                      aria-label={copy.panel.feeHelpAria}
                    >
                      ?
                      <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 hidden w-64 -translate-x-1/2 rounded-md border border-neutral-200 bg-white p-2 text-xs text-neutral-700 shadow-md group-hover:block dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200">
                        {copy.panel.feeHelpText}
                      </span>
                    </span>
                  </span>
                </span>
                <span className="font-medium">{formatMoney(estimate.feeCents, estimate.currency)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>{copy.panel.estimatedNetLine}</span>
                <span className="font-semibold">{formatMoney(estimate.netRefundCents, estimate.currency)}</span>
              </div>
            </div>

            {detailsLines.length > 0 ? (
              <div className="rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
                <div className="space-y-1">
                  {detailsLines.map((line) => (
                    <div key={line}>{line}</div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
          <RefundTerms locale={locale} />
        </div>

        <label className="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-200">
          <input
            type="checkbox"
            className="mt-1"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            disabled={submitted}
          />
          <span>{copy.panel.agreeLabel}</span>
        </label>

        <div className="flex items-center gap-2">
          <Button onClick={submit} disabled={!accepted || submitting || submitted || !estimate || Boolean(error)}>
            {submitted ? copy.panel.submitted : submitting ? copy.panel.submitting : copy.panel.submit}
          </Button>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            {copy.panel.note}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
