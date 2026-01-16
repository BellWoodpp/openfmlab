import { Metadata } from "next";
import { auth } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, Shield, Activity } from "lucide-react";
import { getDictionary } from "@/i18n";
import { type Locale } from "@/i18n/types";
import { BillingHistory } from "@/components/membership";
import { UpgradeToYearlyButton } from "@/components/membership/upgrade-to-yearly-button";
import { UpgradePendingBanner } from "@/components/membership/upgrade-pending-banner";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema/users";
import { ttsGenerations } from "@/lib/db/schema/tts";
import { getUserMembershipDetails } from "@/lib/membership";
import { resolveIntlNumberLocale } from "@/i18n/locale-config";
import { PricingComponent } from "@/components/pricing/pricing-component";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { getHomeHref, getHomeLabel } from "@/lib/breadcrumbs";

const DEFAULT_TOKENS = 500;

type CurrentPlanKind = "free" | "pro_monthly" | "pro_yearly";

function LeafIcon({ className }: { className?: string }) {
  return (
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
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  );
}

function CrownIcon({ className }: { className?: string }) {
  return (
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
      <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
      <path d="M5 21h14" />
    </svg>
  );
}

function ChessKingIcon({ className }: { className?: string }) {
  return (
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
}

function CurrentPlanIcon({ kind, className }: { kind: CurrentPlanKind; className?: string }) {
  if (kind === "free") return <LeafIcon className={className} />;
  if (kind === "pro_yearly") return <ChessKingIcon className={className} />;
  return <CrownIcon className={className} />;
}

function isMissingRelationError(err: unknown, relation: string): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  const message = (err as { message?: unknown }).message;
  const relationName = (err as { relation?: unknown }).relation;
  if (relationName === relation) return true;
  if (code === "42P01") return typeof message === "string" && message.includes(relation);
  return typeof message === "string" && message.includes(`relation \"${relation}\" does not exist`);
}

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const dictionary = getDictionary(resolvedParams.locale);
  
  return {
    title: dictionary.pages.membership.title,
    description: dictionary.pages.membership.description,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function MembershipPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const resolvedParams = await params;
  const session = await auth.api.getSession({
    headers: await import("next/headers").then((mod) => mod.headers()),
  });

  if (!session?.user) {
    redirect(`/${resolvedParams.locale}/login`);
  }

  const dictionary = getDictionary(resolvedParams.locale);
  const homeHref = getHomeHref(resolvedParams.locale);
  const homeLabel = getHomeLabel(resolvedParams.locale);
  const numberFormat = new Intl.NumberFormat(resolveIntlNumberLocale(resolvedParams.locale));

  const membership = await getUserMembershipDetails(session.user.id);
  const currentPlanId = membership.isPaid ? "pro" : "free";
  const currentPlanKind: CurrentPlanKind = membership.isPaid
    ? membership.period === "yearly"
      ? "pro_yearly"
      : "pro_monthly"
    : "free";

  const currentPlanAccent =
    currentPlanKind === "free"
      ? {
          ring: "ring-green-600 dark:ring-green-400",
          badge: "bg-green-600 text-white dark:bg-green-500 dark:text-white",
          icon: "text-green-600 dark:text-green-400",
        }
      : currentPlanKind === "pro_yearly"
        ? {
            ring: "ring-amber-500 dark:ring-amber-400",
            badge: "bg-amber-500 text-white dark:bg-amber-400 dark:text-neutral-950",
            icon: "text-amber-500 dark:text-amber-400",
          }
        : {
            ring: "ring-blue-600 dark:ring-blue-400",
            badge: "bg-blue-600 text-white dark:bg-blue-500 dark:text-white",
          icon: "text-blue-600 dark:text-blue-400",
        };

  const periodLabelByLocale: Partial<Record<Locale, { monthly: string; yearly: string }>> = {
    en: { monthly: "Monthly", yearly: "Yearly" },
    zh: { monthly: "月付", yearly: "年付" },
    ja: { monthly: "月額", yearly: "年額" },
    es: { monthly: "Mensual", yearly: "Anual" },
    ar: { monthly: "شهري", yearly: "سنوي" },
    id: { monthly: "Bulanan", yearly: "Tahunan" },
    pt: { monthly: "Mensal", yearly: "Anual" },
    fr: { monthly: "Mensuel", yearly: "Annuel" },
    ru: { monthly: "Ежемесячный", yearly: "Ежегодный" },
    de: { monthly: "Monatlich", yearly: "Jährlich" },
  };

  const planPeriodSuffix = (() => {
    if (!membership.isPaid) return "";
    const period = membership.period;
    if (period !== "monthly" && period !== "yearly") return "";
    const label = periodLabelByLocale[resolvedParams.locale]?.[period] ?? periodLabelByLocale.en?.[period] ?? period;
    const useWideParens = resolvedParams.locale === "zh" || resolvedParams.locale === "ja";
    return useWideParens ? `（${label}）` : ` (${label})`;
  })();

  let tokens = DEFAULT_TOKENS;
  let totalGenerations: number | null = null;

  if (process.env.DATABASE_URL) {
    try {
      const rows = await db
        .select({ tokens: users.tokens })
        .from(users)
        .where(eq(users.id, session.user.id))
        .limit(1);

      const nextTokens = rows[0]?.tokens;
      if (typeof nextTokens === "number" && Number.isFinite(nextTokens)) {
        tokens = nextTokens;
      }
    } catch {
      // ignore (tokens fallback to DEFAULT_TOKENS)
    }

    try {
      const [row] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(ttsGenerations)
        .where(eq(ttsGenerations.userId, session.user.id));
      totalGenerations = row?.total ?? 0;
    } catch (err) {
      if (!isMissingRelationError(err, "tts_generations")) {
        // ignore (history unavailable)
      }
    }
  }

  // 使用国际化的计划数据（仅用于“当前计划”展示；升级区使用 PricingComponent 以复用支付逻辑）。
  const plans = dictionary.pages.membership.plans
    .filter((plan) => plan.id === "free" || plan.id === "pro")
    .map((plan) => ({ ...plan, current: plan.id === currentPlanId }));

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href={homeHref}>{homeLabel}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{dictionary.header.userMenu.membership}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
            {dictionary.pages.membership.subtitle}
          </h1>
          <p className="mt-2 text-neutral-600 dark:text-neutral-400">
            {dictionary.pages.membership.description}
          </p>
        </div>

        <UpgradePendingBanner locale={resolvedParams.locale} />

        {/* 当前计划状态 */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CurrentPlanIcon kind={currentPlanKind} className={`h-5 w-5 ${currentPlanAccent.icon}`} />
              {dictionary.pages.membership.currentPlan.title}
            </CardTitle>
            <CardDescription>
              {dictionary.pages.membership.currentPlan.description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <CurrentPlanIcon kind={currentPlanKind} className={`h-5 w-5 ${currentPlanAccent.icon}`} />
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                    {plans.find((p) => p.id === currentPlanId)?.name}
                    {currentPlanId === "pro" ? planPeriodSuffix : ""}
                  </h3>
                </div>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  {plans.find((p) => p.id === currentPlanId)?.description}
                </p>
              </div>
              <Badge className={currentPlanAccent.badge} variant="default">
                {currentPlanId === "free" ? dictionary.pages.membership.currentPlan.freeVersion : dictionary.pages.membership.currentPlan.paidVersion}
              </Badge>
            </div>
            
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                    {dictionary.pages.membership.usage.apiCalls}
                  </span>
                </div>
                <p className="mt-1 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                  {numberFormat.format(tokens)}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {dictionary.pages.membership.usage.remainingThisMonth}
                </p>
              </div>
              
              <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                    {dictionary.pages.membership.usage.projectCount}
                  </span>
                </div>
                <p className="mt-1 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                  {totalGenerations === null ? "—" : numberFormat.format(totalGenerations)}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {dictionary.pages.membership.usage.maxLimit}
                </p>
              </div>
              
              <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                    {dictionary.pages.membership.usage.supportLevel}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                    {currentPlanId === "pro"
                      ? `${dictionary.pages.membership.usage.priority}${planPeriodSuffix}`
                      : dictionary.pages.membership.usage.standard}
                  </span>
                  {membership.isPaid && membership.period === "monthly" ? (
                    <UpgradeToYearlyButton locale={resolvedParams.locale} paymentProvider={membership.paymentProvider} />
                  ) : null}
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {dictionary.pages.membership.usage.responseTime}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 升级计划 */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-6">
            {dictionary.pages.membership.upgradePlan.title}
          </h2>
          <PricingComponent locale={resolvedParams.locale} showHeader={false} />
        </div>

        {/* 账单历史 */}
        <BillingHistory 
          dict={dictionary.pages.membership.billingHistory} 
          locale={resolvedParams.locale}
        />
      </div>
    </div>
  );
}
