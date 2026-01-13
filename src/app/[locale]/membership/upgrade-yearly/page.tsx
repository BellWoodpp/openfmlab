import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/lib/auth/server";
import { getUserMembershipDetails } from "@/lib/membership";
import { type Locale, defaultLocale } from "@/i18n/types";
import { getPricingConfig, formatPrice } from "@/lib/pricing/i18n-config";
import { UpgradeYearlyAgreement } from "@/components/membership/upgrade-yearly-agreement";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === "zh" ? "升级为年付" : "Upgrade to Yearly",
    robots: { index: false, follow: false },
  };
}

function pageCopy(locale: Locale) {
  const t: Record<
    string,
    {
      title: string;
      subtitle: string;
      current: string;
      target: string;
      noteTitle: string;
      noteBullets: string[];
      agree: string;
      agree2: string;
      back: string;
    }
  > = {
    en: {
      title: "Upgrade to Yearly",
      subtitle: "Review charges and benefits before confirming.",
      current: "Your current plan",
      target: "After upgrade",
      noteTitle: "How it works",
      noteBullets: [
        "We upgrade your existing monthly subscription to yearly via Creem (no second subscription).",
        "Creem applies proration based on your remaining time and charges the difference immediately.",
        "If your payment method needs confirmation (e.g. 3DS), Creem may redirect you to complete it.",
      ],
      agree: "I understand the upgrade may trigger an immediate prorated charge.",
      agree2: "I understand yearly cancellations forfeit the annual discount (refunds prorated using the original yearly price).",
      back: "Back to membership",
    },
    zh: {
      title: "升级为年付",
      subtitle: "确认前先了解可能的扣费与权益变化。",
      current: "当前方案",
      target: "升级后",
      noteTitle: "升级说明",
      noteBullets: [
        "我们会通过 Creem 将你现有的月付订阅直接升级为年付（不会创建第二份订阅）。",
        "Creem 会按你剩余的时间进行折算（proration），并立即结算差价。",
        "若支付方式需要验证（如 3DS），Creem 可能会跳转让你完成确认。",
      ],
      agree: "我已知晓升级可能会立即产生按比例折算的扣费。",
      agree2: "我已知晓年付退订将失去年付折扣（退款会按原价折算）。",
      back: "返回会员中心",
    },
  };
  return (t[locale] ?? t.en) as (typeof t)["en"];
}

export default async function UpgradeYearlyPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;

  const session = await auth.api.getSession({
    headers: await import("next/headers").then((mod) => mod.headers()),
  });
  if (!session?.user) {
    redirect(locale === defaultLocale ? "/login" : `/${locale}/login`);
  }

  const membership = await getUserMembershipDetails(session.user.id);
  if (!membership.isPaid || membership.period !== "monthly") {
    redirect(locale === defaultLocale ? "/membership" : `/${locale}/membership`);
  }

  const pricing = getPricingConfig(locale).plans.find((p) => p.id === "professional")?.pricing;
  const monthly = pricing?.monthly;
  const yearly = pricing?.yearly;

  const copy = pageCopy(locale);
  const backHref = locale === defaultLocale ? "/membership" : `/${locale}/membership`;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">{copy.title}</h1>
          <p className="mt-2 text-neutral-600 dark:text-neutral-400">{copy.subtitle}</p>
          <div className="mt-3">
            <Link href={backHref} className="text-sm text-blue-600 hover:underline dark:text-blue-400">
              ← {copy.back}
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span>{copy.current}</span>
                <Badge className="bg-cyan-500 text-white dark:bg-cyan-400 dark:text-neutral-950">Monthly</Badge>
              </CardTitle>
              <CardDescription>Professional</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-neutral-700 dark:text-neutral-200">
              {monthly ? (
                <div className="text-2xl font-bold">
                  {formatPrice(monthly.price, monthly.currency)} {monthly.period}
                </div>
              ) : (
                <div className="text-neutral-500 dark:text-neutral-400">—</div>
              )}
            </CardContent>
          </Card>

          <Card className="border-amber-500/40">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span>{copy.target}</span>
                <Badge className="bg-amber-500 text-white dark:bg-amber-400 dark:text-neutral-950">Yearly</Badge>
              </CardTitle>
              <CardDescription>Professional</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-neutral-700 dark:text-neutral-200">
              {yearly ? (
                <div className="space-y-1">
                  <div className="text-2xl font-bold">
                    {formatPrice(yearly.price, yearly.currency)} {yearly.period}
                  </div>
                  {typeof yearly.originalPrice === "number" ? (
                    <div className="text-xs text-neutral-600 dark:text-neutral-400">
                      <span className="line-through">{formatPrice(yearly.originalPrice, yearly.currency)}</span>{" "}
                      <span className="text-purple-600 dark:text-purple-400">
                        {typeof yearly.discount === "number" ? `${yearly.discount}% OFF` : ""}
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="text-neutral-500 dark:text-neutral-400">—</div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{copy.noteTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="list-disc pl-5 text-sm text-neutral-700 dark:text-neutral-200 space-y-1">
              {copy.noteBullets.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>

            <UpgradeYearlyAgreement
              locale={locale}
              paymentProvider={membership.paymentProvider}
              agree1={copy.agree}
              agree2={copy.agree2}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

