"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { getPricingConfig, getRecommendedPeriod, type PricingPeriod } from "@/lib/pricing/i18n-config";
import { BillingToggle } from "./billing-toggle";
import { PricingCard } from "./pricing-card";
import { type Locale } from "@/i18n/types";
import { getPricingCopy } from "@/i18n/components/pricing";

interface PricingComponentProps {
  locale?: Locale;
  showBillingToggle?: boolean;
  showHeader?: boolean;
  defaultPeriod?: PricingPeriod;
  onPlanSelect?: (planId: string, period: PricingPeriod) => void;
  className?: string;
}

export function PricingComponent({
  locale = "en",
  showBillingToggle = true,
  showHeader = true,
  defaultPeriod,
  onPlanSelect,
  className
}: PricingComponentProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<PricingPeriod>(
    defaultPeriod || getRecommendedPeriod()
  );
  const [membershipStatus, setMembershipStatus] = useState<
    | {
        isPaid: boolean;
        period: "monthly" | "yearly" | null;
        reason?: string;
        hasPaidHistory?: boolean;
      }
    | undefined
    | null
  >(undefined);

  useEffect(() => {
    let cancelled = false;

    async function loadMembership() {
      try {
        const resp = await fetch("/api/membership/status", { cache: "no-store" });
        const json = (await resp.json().catch(() => null)) as
          | {
              ok: boolean;
              data?: { isPaid?: boolean; period?: "monthly" | "yearly" | null; hasPaidHistory?: boolean; reason?: string };
            }
          | null;
        if (cancelled) return;
        if (!json?.ok) {
          setMembershipStatus(null);
          return;
        }

        const reason = json.data?.reason;
        const isPaid = Boolean(json.data?.isPaid);
        const period = json.data?.period ?? null;
        const hasPaidHistory = Boolean(json.data?.hasPaidHistory);

        // Only show "current plan/owned" labels when we are authenticated and can trust membership status.
        if (reason === "unauth") {
          setMembershipStatus(null);
          return;
        }

        // If DB is disabled/missing, membership status is unknown; keep neutral CTA labels.
        if (reason === "db_disabled" || reason === "orders_table_missing" || reason === "error") {
          setMembershipStatus(null);
          return;
        }

        setMembershipStatus({ isPaid, period, reason, hasPaidHistory });
      } catch {
        if (!cancelled) setMembershipStatus(null);
      }
    }

    loadMembership();
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePeriodChange = (period: PricingPeriod) => {
    setSelectedPeriod(period);
  };

  const handlePlanSelect = (planId: string, period: PricingPeriod) => {
    onPlanSelect?.(planId, period);
  };

  const pricingConfig = getPricingConfig(locale);
  const pricingCopy = getPricingCopy(locale);
  const gridColsClassName =
    pricingConfig.plans.length <= 2 ? "md:grid-cols-2" : "md:grid-cols-3";

  return (
    <div className={cn("w-full", className)}>
      {showHeader ? (
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold tracking-tight mb-4">
            {pricingCopy.header.title}
          </h2>
          <p className="text-lg text-muted-foreground mb-6">
            {pricingCopy.header.subtitle}
          </p>

          {showBillingToggle && (
            <BillingToggle
              period={selectedPeriod}
              onPeriodChange={handlePeriodChange}
              locale={locale}
              discountLabel={pricingCopy.billingToggle.discount}
              className="mb-8"
            />
          )}
        </div>
      ) : showBillingToggle ? (
        <div className="flex justify-center mb-8">
          <BillingToggle
            period={selectedPeriod}
            onPeriodChange={handlePeriodChange}
            locale={locale}
            discountLabel={pricingCopy.billingToggle.discount}
          />
        </div>
      ) : null}

      {/* 价格卡片 */}
      <div className={cn("grid grid-cols-1 gap-6 max-w-6xl mx-auto", gridColsClassName)}>
        {pricingConfig.plans.map((plan) => (
          <PricingCard
            key={plan.id}
            plan={plan}
            period={selectedPeriod}
            locale={locale}
            copy={pricingCopy.card}
            membershipStatus={membershipStatus}
            onSelect={handlePlanSelect}
            className={cn(
              plan.popular && "md:scale-105"
            )}
          />
        ))}
      </div>

      {/* 年付优惠说明 */}
      {selectedPeriod === 'yearly' && (
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            {pricingCopy.header.yearlyDiscount}
          </p>
        </div>
      )}
    </div>
  );
}
