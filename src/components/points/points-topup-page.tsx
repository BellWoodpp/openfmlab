"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n/types";
import type { PointsPageDictionary } from "@/i18n/types";
import { resolveIntlNumberLocale } from "@/i18n/locale-config";
import { formatPrice } from "@/lib/pricing/i18n-config";
import { getPointsPacks } from "@/lib/pricing/points-packs";
import { usePointsPayment } from "@/hooks/use-points-payment";
import { Coins } from "lucide-react";

interface PointsTopupPageProps {
  locale: Locale;
  dict: PointsPageDictionary;
  className?: string;
}

export function PointsTopupPage({ locale, dict, className }: PointsTopupPageProps) {
  const packs = useMemo(() => getPointsPacks(locale), [locale]);
  const { isLoading, error, createPointsCheckout } = usePointsPayment();
  const [credits, setCredits] = useState<number | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(true);
  const [creditsError, setCreditsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadBalance() {
      try {
        setCreditsLoading(true);
        setCreditsError(null);

        const resp = await fetch("/api/tokens", { cache: "no-store" });
        const data: { ok: boolean; data?: { tokens?: number } } = await resp.json();

        if (cancelled) return;
        const nextCredits = data?.data?.tokens;
        if (typeof nextCredits === "number" && Number.isFinite(nextCredits)) {
          setCredits(nextCredits);
        } else {
          setCredits(null);
        }
      } catch {
        if (cancelled) return;
        setCreditsError(dict.errors.generic);
        setCredits(null);
      } finally {
        if (!cancelled) setCreditsLoading(false);
      }
    }

    loadBalance();
    return () => {
      cancelled = true;
    };
  }, [dict.errors.generic]);

  const intlLocale = resolveIntlNumberLocale(locale);
  const numberFormat = useMemo(() => new Intl.NumberFormat(intlLocale), [intlLocale]);

  const homeLabelByLocale: Partial<Record<Locale, string>> = {
    en: "Home",
    zh: "首页",
    es: "Inicio",
    ar: "الرئيسية",
    id: "Beranda",
    pt: "Início",
    fr: "Accueil",
    ja: "ホーム",
    ru: "Главная",
    de: "Start",
  };

  const membershipLabelByLocale: Partial<Record<Locale, string>> = {
    en: "Membership",
    zh: "会员",
    es: "Membresía",
    ar: "العضوية",
    id: "Keanggotaan",
    pt: "Assinatura",
    fr: "Abonnement",
    ja: "メンバーシップ",
    ru: "Подписка",
    de: "Mitgliedschaft",
  };

  const homeHref = locale === "en" ? "/" : `/${locale}/`;
  const membershipHref = locale === "en" ? "/membership" : `/${locale}/membership`;
  const homeLabel = homeLabelByLocale[locale] ?? homeLabelByLocale.en ?? "Home";
  const membershipLabel = membershipLabelByLocale[locale] ?? membershipLabelByLocale.en ?? "Membership";

  const bonusLabelByLocale: Partial<Record<Locale, (pct: number) => string>> = {
    en: (pct) => `Bonus ${pct}%`,
    zh: (pct) => `加赠 ${pct}%`,
    ja: (pct) => `ボーナス ${pct}%`,
    es: (pct) => `Bono ${pct}%`,
    ar: (pct) => `مكافأة ${pct}%`,
    id: (pct) => `Bonus ${pct}%`,
    pt: (pct) => `Bônus ${pct}%`,
    fr: (pct) => `Bonus ${pct}%`,
    ru: (pct) => `Бонус ${pct}%`,
    de: (pct) => `Bonus ${pct}%`,
  };
  const formatBonusLabel = bonusLabelByLocale[locale] ?? bonusLabelByLocale.en ?? ((pct: number) => `Bonus ${pct}%`);

  return (
    <div className={cn("w-full bg-neutral-50 dark:bg-neutral-950", className)}>
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-10">
          <div className="mb-6 flex justify-center">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href={homeHref}>{homeLabel}</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href={membershipHref}>{membershipLabel}</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{dict.title}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                {dict.title}
              </h1>
              <p className="mt-2 text-neutral-600 dark:text-neutral-400">{dict.description}</p>
              <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-500">{dict.status.pendingPaymentHint}</p>
            </div>

            <Button variant="outline" asChild>
              <Link href={membershipHref}>{dict.actions.backToMembership}</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{dict.balance.title}</CardTitle>
              <CardDescription>{dict.balance.description}</CardDescription>
            </CardHeader>
            <CardContent>
              {creditsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-48" />
                  <Skeleton className="h-4 w-64" />
                </div>
              ) : creditsError ? (
                <div className="text-sm text-destructive">{creditsError}</div>
              ) : (
                <div className="flex items-baseline justify-between gap-4">
                  <div
                    className="inline-flex items-baseline gap-2 text-3xl font-bold text-neutral-900 dark:text-neutral-100"
                    dir="ltr"
                  >
                    <span>{credits === null ? "-" : numberFormat.format(credits)}</span>
                    <Coins className="h-6 w-6 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                    <span className="sr-only">{dict.balance.creditsLabel}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">{dict.packs.title}</h2>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{dict.packs.description}</p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {packs.map((pack) => (
                <Card key={pack.id} className="relative">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-3">
                      <span>{pack.title}</span>
                      <div className="flex items-center gap-2" dir="ltr">
                        {typeof pack.bonusPercent === "number" && pack.bonusPercent > 0 ? (
                          <Badge
                            className="whitespace-nowrap border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
                            variant="secondary"
                          >
                            {formatBonusLabel(pack.bonusPercent)}
                          </Badge>
                        ) : null}
                        <Badge variant="secondary" className="inline-flex items-center gap-2 px-3 py-2">
                          <div className="flex flex-col items-end leading-tight">
                            <div className="inline-flex items-center gap-1.5">
                              <span className="font-semibold">{numberFormat.format(pack.credits)}</span>
                              <Coins className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                            </div>
                            {typeof pack.bonusPercent === "number" &&
                            pack.bonusPercent > 0 &&
                            Number.isFinite(pack.originalCredits) ? (
                              <div className="inline-flex items-center gap-1 text-xs text-neutral-500 line-through dark:text-neutral-500">
                                <span>{numberFormat.format(pack.originalCredits)}</span>
                                <Coins className="h-3.5 w-3.5 text-amber-600/80 dark:text-amber-400/80" aria-hidden="true" />
                              </div>
                            ) : null}
                          </div>
                        </Badge>
                      </div>
                    </CardTitle>
                    <CardDescription>{pack.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-3xl font-bold text-neutral-900 dark:text-neutral-100" dir="ltr">
                      {formatPrice(pack.price, pack.currency)}
                    </div>
                    <Button
                      className="w-full"
                      disabled={isLoading}
                      onClick={() =>
                        createPointsCheckout(pack.id, locale, {
                          tokensBefore: credits,
                          packCredits: pack.credits,
                        })
                      }
                    >
                      {isLoading ? dict.packs.processing : dict.packs.buy}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {error && <div className="mt-4 text-sm text-destructive">{error}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
