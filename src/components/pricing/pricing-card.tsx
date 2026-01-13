"use client";

import { Check, X, Loader2, Coins, Crown } from "lucide-react";
import * as Switch from "@radix-ui/react-switch";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPrice, type PricingPlan, type PricingPeriod } from "@/lib/pricing/i18n-config";
import { usePayment } from "@/hooks/use-payment";
import type { PricingCopy } from "@/i18n/components/pricing";
import type { Locale } from "@/i18n/types";

interface PricingCardProps {
  plan: PricingPlan;
  period: PricingPeriod;
  locale: Locale;
  copy: PricingCopy["card"];
  membershipStatus?: { isPaid: boolean; period: "monthly" | "yearly" | null; reason?: string; hasPaidHistory?: boolean } | null | undefined;
  onSelect?: (planId: string, period: PricingPeriod) => void;
  className?: string;
}

export function PricingCard({
  plan,
  period,
  locale,
  copy,
  membershipStatus,
  onSelect,
  className
}: PricingCardProps) {
  const { isLoading, error, createCheckout } = usePayment();
  const [isNavigating, setIsNavigating] = useState(false);
  const [introEnabled, setIntroEnabled] = useState(true);

  const pricing = plan.pricing[period] ?? plan.pricing.monthly ?? plan.pricing.yearly;
  if (!pricing) {
    return null;
  }

  const hasDiscount = pricing.discount && pricing.originalPrice;

  const isMembershipLoading = membershipStatus === undefined;
  const isPaidMember = membershipStatus?.isPaid === true;
  const isAuthedFreeUser = membershipStatus?.isPaid === false;
  const activeMembershipPeriod = membershipStatus?.period ?? null;

  const isFreePlan = plan.id === "free";
  const isProfessionalPlan = plan.id === "professional";
  const isPointsPlan = plan.id === "points";
  const isPointsLocked = isPointsPlan && isAuthedFreeUser;
  const isMonthly = period === "monthly";
  const isYearly = period === "yearly";
  const isIntroUsdMonthlyPro = isProfessionalPlan && isMonthly && pricing.currency === "USD";

  const introEligible =
    isIntroUsdMonthlyPro &&
    // Only show the intro for first-time paid subscribers (server enforces too).
    (membershipStatus === undefined || membershipStatus === null || membershipStatus?.hasPaidHistory === false);

  const introActive = introEligible && introEnabled;
  const introDiscountDollars = 2;
  const introPrice = Math.max(0, pricing.price - introDiscountDollars);

  const isSwitchingBillingPeriod =
    isProfessionalPlan &&
    isPaidMember &&
    activeMembershipPeriod !== null &&
    (period === "monthly" || period === "yearly") &&
    activeMembershipPeriod !== period;
  const isSwitchToMonthlyBlocked =
    isSwitchingBillingPeriod && period === "monthly" && activeMembershipPeriod === "yearly";

  const isCurrentPlan =
    (isFreePlan && isAuthedFreeUser) ||
    (isProfessionalPlan &&
      isPaidMember &&
      // If we can't determine the current billing period, treat Professional as current to avoid duplicate purchases.
      (activeMembershipPeriod === null || activeMembershipPeriod === period));
  const isOwnedPlan = isFreePlan && isPaidMember;
  const highlightBillingPeriod = isProfessionalPlan && (plan.popular || isCurrentPlan) ? (isMonthly ? "monthly" : isYearly ? "yearly" : null) : null;
  const isMonthlyProfessionalHighlight = highlightBillingPeriod === "monthly";
  const isYearlyProfessionalHighlight = highlightBillingPeriod === "yearly";
  const highlightBorderClass = isMonthlyProfessionalHighlight
    ? "border-blue-600 ring-1 ring-blue-600/20"
    : isYearlyProfessionalHighlight
      ? "border-amber-500 ring-1 ring-amber-500/25"
      : null;
  const highlightBadgeClass = isMonthlyProfessionalHighlight
    ? "bg-blue-600 text-white dark:bg-blue-500 dark:text-white"
    : isYearlyProfessionalHighlight
      ? "bg-amber-500 text-white dark:bg-amber-400 dark:text-neutral-950"
      : null;

  const currentPlanButtonClass =
    isProfessionalPlan && isCurrentPlan && activeMembershipPeriod === "monthly"
      ? "bg-cyan-500 text-white hover:bg-cyan-600 dark:bg-cyan-400 dark:hover:bg-cyan-500 dark:text-neutral-950 disabled:opacity-100"
      : isProfessionalPlan && isCurrentPlan && activeMembershipPeriod === "yearly"
        ? "bg-amber-200 text-amber-950 hover:bg-amber-300 dark:bg-amber-300 dark:hover:bg-amber-200 dark:text-neutral-950 disabled:opacity-100"
        : null;

  const highlightButtonClass =
    currentPlanButtonClass ||
    (isMonthlyProfessionalHighlight
      ? "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 disabled:opacity-100"
      : isYearlyProfessionalHighlight
        ? "bg-amber-500 text-white hover:bg-amber-600 dark:bg-amber-400 dark:hover:bg-amber-500 dark:text-neutral-950 disabled:opacity-100"
        : null);

  const priceColorClass =
    isProfessionalPlan && isMonthly
      ? "text-blue-600 dark:text-blue-400"
      : isProfessionalPlan && isYearly
        ? "text-amber-500 dark:text-amber-400"
        : null;
  const discountAccentClass = isProfessionalPlan && hasDiscount ? "text-purple-600 dark:text-purple-400" : null;
  const discountBadgeClass = isProfessionalPlan && hasDiscount ? "bg-purple-100 text-purple-900 dark:bg-purple-900/40 dark:text-purple-100" : null;

  const showVeryPopular = isProfessionalPlan && plan.popular && isYearly;
  const popularLabel = showVeryPopular ? copy.veryPopular : copy.popular;

  const pointsCtaByLocale: Partial<Record<Locale, string>> = {
    en: "Top up",
    zh: "充值",
    ja: "チャージ",
    es: "Recargar",
    ar: "إعادة الشحن",
    id: "Isi ulang",
    pt: "Recarregar",
    fr: "Recharger",
    ru: "Пополнить",
    de: "Aufladen",
  };
  const pointsRequiresProByLocale: Partial<Record<Locale, string>> = {
    en: "Professional required",
    zh: "仅专业版可充值",
    ja: "Professional が必要です",
    es: "Requiere Professional",
    ar: "يتطلب Professional",
    id: "Perlu Professional",
    pt: "Requer Professional",
    fr: "Professional requis",
    ru: "Нужен Professional",
    de: "Professional erforderlich",
  };

  const handleSelect = async () => {
    if (isNavigating || isMembershipLoading || isCurrentPlan || isOwnedPlan || isSwitchToMonthlyBlocked) {
      return;
    }

    if (isFreePlan) {
      onSelect?.(plan.id, period);
      const href = locale === "en" ? "/podcast-mvp" : `/${locale}/podcast-mvp`;
      window.location.href = href;
      return;
    }

    if (isPointsPlan) {
      if (isPointsLocked) {
        return;
      }
      onSelect?.(plan.id, period);
      setIsNavigating(true);
      const href = locale === "en" ? "/points" : `/${locale}/points`;
      window.location.href = href;
      return;
    }

    if (isSwitchingBillingPeriod && isProfessionalPlan && period === "yearly" && activeMembershipPeriod === "monthly") {
      setIsNavigating(true);
      const href = locale === "en" ? "/membership/upgrade-yearly" : `/${locale}/membership/upgrade-yearly`;
      window.location.href = href;
      return;
    }

    // 其他付费计划，调用支付接口
    await createCheckout(plan.id, period, locale, isIntroUsdMonthlyPro ? { introDiscount: introEnabled } : undefined);
  };

  const getCtaText = () => {
    if (isMembershipLoading) return copy.loading;
    if (isNavigating) return copy.processing;
    if (isCurrentPlan) return copy.currentPlan;
    if (isOwnedPlan) return copy.owned;
    if (isSwitchToMonthlyBlocked) return copy.owned;
    if (isSwitchingBillingPeriod) return period === "yearly" ? copy.switchToYearly : copy.switchToMonthly;
    if (isFreePlan) return copy.getStarted;
    if (isPointsPlan) {
      if (isPointsLocked) {
        return pointsRequiresProByLocale[locale] ?? pointsRequiresProByLocale.en ?? "Professional required";
      }
      return pointsCtaByLocale[locale] ?? pointsCtaByLocale.en ?? "Top up";
    }
    return copy.buyNow;
  };

  const isCtaDisabled =
    isNavigating || isMembershipLoading || isLoading || isCurrentPlan || isOwnedPlan || isPointsLocked || isSwitchToMonthlyBlocked;
  const buttonVariant =
    isMembershipLoading || isCurrentPlan || isOwnedPlan || isPointsLocked || isSwitchToMonthlyBlocked
      ? "outline"
      : plan.popular
        ? "default"
        : "outline";
  const buttonClassName = cn("w-full", !isCtaDisabled && highlightButtonClass);

  const ChessKingIcon = ({ className }: { className?: string }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 20a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
      <path d="m6.7 18-1-1C4.35 15.682 3 14.09 3 12a5 5 0 0 1 4.95-5c1.584 0 2.7.455 4.05 1.818C13.35 7.455 14.466 7 16.05 7A5 5 0 0 1 21 12c0 2.082-1.359 3.673-2.7 5l-1 1" />
      <path d="M10 4h4" />
      <path d="M12 2v6.818" />
    </svg>
  );

  const parseFeature = (feature: string): { text: string; icons: Array<"coins" | "crown"> } => {
    const trimmed = feature.trim();
    const icons: Array<"coins" | "crown"> = [];

    const nextText = trimmed.replace(/\[\[(coins|crown)\]\]/gi, (_full, icon: string) => {
      const normalized = icon.toLowerCase() as "coins" | "crown";
      if (!icons.includes(normalized)) icons.push(normalized);
      return "";
    });

    return { text: nextText.replace(/\s+/g, " ").trim(), icons };
  };

  const renderFeatureText = (text: string): string => {
    if (!text) return text;

    const hasProTokens = /\[\[pro_tokens\]\]/i.test(text);
    if (!hasProTokens) return text;

    const proTokensByLocale: Partial<Record<Locale, { monthly: string; yearly: string }>> = {
      en: { monthly: "Monthly 200,000 Tokens", yearly: "One-time 2,400,000 Tokens" },
      zh: { monthly: "每月赠送 200,000 Token", yearly: "一次性赠送 2,400,000 Token" },
      ja: { monthly: "毎月 200,000 Tokens", yearly: "一括 2,400,000 Tokens" },
      es: { monthly: "200,000 Tokens al mes", yearly: "2,400,000 Tokens (pago único)" },
      ar: { monthly: "200,000 Token شهريًا", yearly: "2,400,000 Token دفعة واحدة" },
      id: { monthly: "200,000 Tokens/bulan", yearly: "2.400.000 Tokens (sekali)" },
      pt: { monthly: "200.000 Tokens/mês", yearly: "2.400.000 Tokens (uma vez)" },
      fr: { monthly: "200 000 Tokens/mois", yearly: "2 400 000 Tokens (en une fois)" },
      ru: { monthly: "200 000 Tokens/мес", yearly: "2 400 000 Tokens (разово)" },
      de: { monthly: "200.000 Tokens/Monat", yearly: "2.400.000 Tokens (einmalig)" },
    };

    const resolved = proTokensByLocale[locale] ?? proTokensByLocale.en ?? { monthly: "Monthly 200,000 Tokens", yearly: "One-time 2,400,000 Tokens" };
    const replacement = period === "yearly" ? resolved.yearly : resolved.monthly;

    return text.replace(/\[\[pro_tokens\]\]/gi, replacement).replace(/\s+/g, " ").trim();
  };

  return (
    <Card
      className={cn(
        "relative flex flex-col",
        isProfessionalPlan && (plan.popular || isCurrentPlan) && "shadow-lg",
        highlightBorderClass,
        !highlightBorderClass && plan.popular && "border-primary",
        className
      )}
    >
      {plan.popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge
            variant="default"
            className={cn(
              "px-3 py-1",
              highlightBadgeClass
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              {showVeryPopular ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3.5 w-3.5"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4" />
                </svg>
              ) : null}
              <span>{popularLabel}</span>
            </span>
          </Badge>
        </div>
      )}

      <CardHeader className="text-center">
        <CardTitle className="text-2xl flex items-center justify-center gap-2">
          {plan.name}
          {plan.id === "free" ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5 text-green-600 dark:text-green-400"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
              <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
            </svg>
          ) : null}
          {plan.id === "professional" ? (
            period === "yearly" ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5 text-amber-500"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M4 20a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
                <path d="m6.7 18-1-1C4.35 15.682 3 14.09 3 12a5 5 0 0 1 4.95-5c1.584 0 2.7.455 4.05 1.818C13.35 7.455 14.466 7 16.05 7A5 5 0 0 1 21 12c0 2.082-1.359 3.673-2.7 5l-1 1" />
                <path d="M10 4h4" />
                <path d="M12 2v6.818" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5 text-blue-600 dark:text-blue-400"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
                <path d="M5 21h14" />
              </svg>
            )
          ) : null}
          {plan.id === "points" ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5 text-red-600 dark:text-red-400"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0v-6.998a2 2 0 0 0-.59-1.42L18 5" />
              <path d="M14 21V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v16" />
              <path d="M2 21h13" />
              <path d="M3 9h11" />
            </svg>
          ) : null}
        </CardTitle>
        <CardDescription className="text-base">
          {plan.description}
        </CardDescription>

        <div className="mt-4">
          <div className="flex items-baseline justify-center">
            {hasDiscount && (
              <span className={cn("text-lg text-muted-foreground line-through mr-2", discountAccentClass)}>
                {formatPrice(pricing.originalPrice!, pricing.currency)}
              </span>
            )}
            {!hasDiscount && introActive ? (
              <span className={cn("text-lg text-muted-foreground line-through mr-2", discountAccentClass)}>
                {formatPrice(pricing.price, pricing.currency)}
              </span>
            ) : null}
            <span className={cn("text-4xl font-bold", priceColorClass)}>
              {formatPrice(introActive ? introPrice : pricing.price, pricing.currency)}
            </span>
            <span className="text-muted-foreground ml-1">
              {pricing.period}
            </span>
          </div>

          {hasDiscount && (
            <div className="mt-2">
              <Badge variant="secondary" className={cn("text-xs", discountBadgeClass)}>
                {copy.save} <span className={cn("font-semibold", discountAccentClass)}>{pricing.discount}%</span>
              </Badge>
            </div>
          )}

          {isIntroUsdMonthlyPro ? (
            <div className="mt-3 flex flex-col items-center gap-2">
              <div className="flex items-center gap-2">
	                <Switch.Root
	                  className={cn(
	                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-border transition-colors",
	                    introEnabled ? "bg-cyan-100 border-cyan-200 dark:bg-cyan-950/40 dark:border-cyan-900/50" : "bg-background",
	                    !introEligible && "cursor-not-allowed opacity-60",
	                  )}
	                  checked={introEnabled}
	                  onCheckedChange={(next) => setIntroEnabled(next)}
	                  disabled={!introEligible}
	                  aria-label={locale === "zh" ? "自动订阅（首月优惠）" : "Auto-subscribe (intro offer)"}
	                >
	                  <Switch.Thumb
	                    className={cn(
	                      "pointer-events-none inline-block h-4 w-4 transform rounded-full shadow transition-transform",
	                      introEnabled
	                        ? "translate-x-4 bg-cyan-600 dark:bg-cyan-400"
	                        : "translate-x-1 bg-neutral-200 dark:bg-neutral-700",
	                    )}
	                  />
	                </Switch.Root>
                <span className="text-sm text-muted-foreground">
                  {locale === "zh" ? "自动订阅" : "Auto subscribe"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                {introActive
                  ? locale === "zh"
                    ? "首月 $4，之后恢复 $6/月"
                    : "First month $4, then renews at $6/mo"
                  : locale === "zh"
                    ? "按原价 $6/月"
                    : "Billed at $6/mo"}
              </p>
            </div>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="flex-1">
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-sm text-muted-foreground mb-2">
              {copy.included}
            </h4>
            <ul className="space-y-2">
              {plan.features.map((feature, index) => (
                <li key={index} className="flex items-start">
                  <Check className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
	                  {(() => {
	                    const parsed = parseFeature(feature);
                        const renderedText = renderFeatureText(parsed.text || feature);
	                    const iconNodes = parsed.icons.map((icon) =>
	                      icon === "coins" ? (
	                        <Coins key="coins" className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
	                      ) : (
                        period === "yearly" ? (
                          <ChessKingIcon key="crown" className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        ) : (
                          <Crown key="crown" className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                        )
                      ),
                    );

	                    return (
	                      <span className="text-sm inline-flex items-center gap-1.5">
	                        <span>{renderedText}</span>
	                        {iconNodes.length ? iconNodes : null}
	                      </span>
	                    );
	                  })()}
	                </li>
              ))}
            </ul>
          </div>

          {plan.limitations && plan.limitations.length > 0 && (
            <div>
              <h4 className="font-medium text-sm text-muted-foreground mb-2">
                {copy.limitations}
              </h4>
              <ul className="space-y-2">
                {plan.limitations.map((limitation, index) => (
                  <li key={index} className="flex items-start">
                    <X className="h-4 w-4 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-muted-foreground">{limitation}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter>
        <div className="w-full space-y-2">
          <Button
            className={buttonClassName}
            variant={buttonVariant}
            onClick={handleSelect}
            disabled={isCtaDisabled}
          >
            {isMembershipLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {copy.loading}
              </>
            ) : isNavigating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {copy.processing}
              </>
            ) : isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {copy.processing}
              </>
            ) : (
              getCtaText()
            )}
          </Button>
          
          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 text-center">
              {error}
            </div>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
