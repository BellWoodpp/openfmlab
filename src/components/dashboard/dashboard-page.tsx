"use client";

import { useEffect, useMemo, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { resolveIntlNumberLocale } from "@/i18n/locale-config";
import { authClient } from "@/lib/auth/client";
import {
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ShoppingCart,
  Package,
  Settings,
  Crown,
  UserPlus,
  TrendingUp,
  Activity,
  Clock,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import type { DashboardPageDictionary, Locale } from "@/i18n/types";

interface DashboardPageProps {
  dictionary: DashboardPageDictionary;
  locale: Locale;
  userName?: string;
}

type IconComponent = React.ComponentType<{ className?: string }>;

const iconMap: Record<string, IconComponent> = {
  ShoppingCart,
  Package,
  Settings,
  Crown,
  UserPlus,
  TrendingUp,
  Activity,
  Clock,
};

const trendIconMap = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  neutral: Minus,
};

export function DashboardPage({ dictionary, locale, userName }: DashboardPageProps) {
  const session = authClient.useSession();
  const isSessionPending = session.isPending;
  const isAuthenticated = Boolean(session.data?.user);

  const [tokens, setTokens] = useState<number | null>(null);
  const [tokensUsed, setTokensUsed] = useState<number | null>(null);
  const [isPaid, setIsPaid] = useState<boolean | null>(null);
  const [isMembershipLoading, setIsMembershipLoading] = useState(true);
  const [membershipPeriod, setMembershipPeriod] = useState<"monthly" | "yearly" | null>(null);
  const [totalGenerations, setTotalGenerations] = useState<number | null>(null);
  const [totalGenerationsAll, setTotalGenerationsAll] = useState<number | null>(null);
  const [usage, setUsage] = useState<
    | {
        totals: { calls: number; chars: number };
        hourly: Array<{ ts: string; calls: number; chars: number }>;
        tiers: Array<{ tier: string; calls: number; chars: number }>;
        topVoices: Array<{ voice: string; calls: number; chars: number }>;
      }
    | null
  >(null);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [usageView, setUsageView] = useState<"usageDistribution" | "usageTrend" | "callsDistribution" | "callsRanking">(
    "usageDistribution",
  );
  const [isTokensLoading, setIsTokensLoading] = useState(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [isUsageLoading, setIsUsageLoading] = useState(true);

  const membershipAccent = useMemo(() => {
    if (isPaid === false) {
      return {
        bg: "bg-green-100 dark:bg-green-900/30",
        fg: "text-green-600 dark:text-green-400",
      };
    }

    if (isPaid === true) {
      if (membershipPeriod === "yearly") {
        return {
          bg: "bg-amber-100 dark:bg-amber-900/30",
          fg: "text-amber-600 dark:text-amber-400",
        };
      }
      if (membershipPeriod === "monthly") {
        return {
          bg: "bg-cyan-100 dark:bg-cyan-900/30",
          fg: "text-cyan-600 dark:text-cyan-400",
        };
      }
    }

    return {
      bg: "bg-blue-100 dark:bg-blue-900",
      fg: "text-blue-600 dark:text-blue-400",
    };
  }, [isPaid, membershipPeriod]);

  useEffect(() => {
    const controller = new AbortController();

    if (isSessionPending) {
      return () => controller.abort();
    }

    if (!isAuthenticated) {
      setTokens(null);
      setTokensUsed(null);
      setIsPaid(false);
      setMembershipPeriod(null);
      setTotalGenerations(null);
      setTotalGenerationsAll(null);
      setUsage(null);
      setUsageError(null);
      setIsTokensLoading(false);
      setIsMembershipLoading(false);
      setIsHistoryLoading(false);
      setIsUsageLoading(false);
      return () => controller.abort();
    }

    setIsTokensLoading(true);
    setIsMembershipLoading(true);
    setIsHistoryLoading(true);
    setIsUsageLoading(true);

    async function loadTokens() {
      try {
        const resp = await fetch("/api/tokens/usage", { cache: "no-store", signal: controller.signal });
        if (!resp.ok) return;
        const json = (await resp.json()) as unknown;
        const data = (json as { data?: { available?: unknown; used?: unknown } })?.data;
        const nextTokens = data?.available;
        if (typeof nextTokens === "number" && Number.isFinite(nextTokens)) {
          setTokens(nextTokens);
        }
        const nextUsed = data?.used;
        if (typeof nextUsed === "number" && Number.isFinite(nextUsed)) {
          setTokensUsed(nextUsed);
        } else {
          setTokensUsed(null);
        }
      } catch {
        // ignore
      } finally {
        setIsTokensLoading(false);
      }
    }

    async function loadMembership() {
      setIsMembershipLoading(true);
      try {
        const resp = await fetch("/api/membership/status", { cache: "no-store", signal: controller.signal });
        if (!resp.ok) {
          setIsPaid(false);
          setMembershipPeriod(null);
          return;
        }
        const json = (await resp.json()) as unknown;
        const data = (json as { data?: { isPaid?: unknown; period?: unknown } })?.data;
        const nextIsPaid = data?.isPaid;
        if (typeof nextIsPaid === "boolean") {
          setIsPaid(nextIsPaid);
        } else {
          setIsPaid(false);
        }
        const nextPeriod = data?.period;
        if (nextPeriod === "monthly" || nextPeriod === "yearly") {
          setMembershipPeriod(nextPeriod);
        } else {
          setMembershipPeriod(null);
        }
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        setIsPaid(false);
        setMembershipPeriod(null);
      } finally {
        setIsMembershipLoading(false);
      }
    }

    async function loadHistoryUsage() {
      try {
        const resp = await fetch("/api/tts/usage/today", { cache: "no-store", signal: controller.signal });
        if (resp.status === 501) {
          setTotalGenerations(0);
          setTotalGenerationsAll(0);
          return;
        }
        if (!resp.ok) return;
        const json = (await resp.json()) as unknown;
        const data = (json as { data?: { today?: unknown; total?: unknown } })?.data;
        const nextToday = data?.today;
        const nextTotal = data?.total;

        if (typeof nextToday === "number" && Number.isFinite(nextToday)) {
          setTotalGenerations(nextToday);
        }

        if (typeof nextTotal === "number" && Number.isFinite(nextTotal)) {
          setTotalGenerationsAll(nextTotal);
        }
      } catch {
        // ignore
      } finally {
        setIsHistoryLoading(false);
      }
    }

    async function loadUsageAnalytics() {
      try {
        setUsageError(null);
        const resp = await fetch("/api/dashboard/usage", { cache: "no-store", signal: controller.signal });
        if (resp.status === 501) {
          setUsage(null);
          setUsageError("DB_REQUIRED");
          return;
        }
        if (!resp.ok) {
          const json = (await resp.json().catch(() => null)) as { message?: unknown } | null;
          const msg = typeof json?.message === "string" ? json.message : null;
          setUsage(null);
          setUsageError(msg || "Failed to load usage analytics");
          return;
        }

        const json = (await resp.json()) as unknown;
        const data = (json as { data?: unknown })?.data as
          | {
              totals?: { calls?: unknown; chars?: unknown };
              hourly?: Array<{ ts?: unknown; calls?: unknown; chars?: unknown }>;
              tiers?: Array<{ tier?: unknown; calls?: unknown; chars?: unknown }>;
              topVoices?: Array<{ voice?: unknown; calls?: unknown; chars?: unknown }>;
            }
          | undefined;

        const totals = data?.totals;
        if (!totals || typeof totals.calls !== "number" || typeof totals.chars !== "number") {
          setUsage(null);
          setUsageError("Invalid analytics payload");
          return;
        }

        const hourly = Array.isArray(data?.hourly) ? data?.hourly : [];
        const tiers = Array.isArray(data?.tiers) ? data?.tiers : [];
        const topVoices = Array.isArray(data?.topVoices) ? data?.topVoices : [];

        setUsage({
          totals: { calls: totals.calls, chars: totals.chars },
          hourly: hourly
            .map((it) => ({
              ts: typeof it.ts === "string" ? it.ts : "",
              calls: typeof it.calls === "number" ? it.calls : 0,
              chars: typeof it.chars === "number" ? it.chars : 0,
            }))
            .filter((it) => Boolean(it.ts)),
          tiers: tiers.map((it) => ({
            tier: typeof it.tier === "string" ? it.tier : "unknown",
            calls: typeof it.calls === "number" ? it.calls : 0,
            chars: typeof it.chars === "number" ? it.chars : 0,
          })),
          topVoices: topVoices.map((it) => ({
            voice: typeof it.voice === "string" ? it.voice : "unknown",
            calls: typeof it.calls === "number" ? it.calls : 0,
            chars: typeof it.chars === "number" ? it.chars : 0,
          })),
        });
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        setUsage(null);
        setUsageError(err instanceof Error ? err.message : "Failed to load usage analytics");
      } finally {
        setIsUsageLoading(false);
      }
    }

    loadTokens();
    loadMembership();
    loadHistoryUsage();
    loadUsageAnalytics();

    return () => controller.abort();
  }, [isAuthenticated, isSessionPending]);

  const isMembershipResolved = !isMembershipLoading && (isPaid === true || isPaid === false);

  useEffect(() => {
    function handleTokensUpdate(event: Event) {
      const nextTokens = (event as CustomEvent<{ tokens?: unknown }>).detail?.tokens;
      if (typeof nextTokens === "number" && Number.isFinite(nextTokens)) {
        setTokens(nextTokens);
      }
    }

    window.addEventListener("tokens:update", handleTokensUpdate as EventListener);
    return () => window.removeEventListener("tokens:update", handleTokensUpdate as EventListener);
  }, []);

  const statsCards = useMemo(() => {
    const safeCard = (idx: number) =>
      dictionary.stats.cards[idx] ?? {
        title: "",
        value: "",
        change: "",
        trend: "neutral" as const,
      };

    const tokensCard = safeCard(0);
    const planCard = safeCard(1);
    const generationsCard = safeCard(2);
    const statusCard = safeCard(3);

    const numberFormat = new Intl.NumberFormat(resolveIntlNumberLocale(locale));
    const tokensAvailableText = typeof tokens === "number" ? numberFormat.format(tokens) : "—";
    const tokensUsedText = typeof tokensUsed === "number" ? numberFormat.format(tokensUsed) : "—";
    const tokensChangeText = typeof tokens === "number" ? tokensAvailableText : "";

    const freePlanLabel = planCard.value || "Free";
    const paidPlanLabel = planCard.change || "Professional";

    const planTextBase = isMembershipResolved ? (isPaid ? paidPlanLabel : freePlanLabel) : "—";
    const planText = planTextBase;

    const generationsText =
      typeof totalGenerations === "number" ? numberFormat.format(totalGenerations) : generationsCard.value || "—";
    const separator = locale === "zh" || locale === "ja" ? "：" : ":";
    const generationsChangeText =
      typeof totalGenerationsAll === "number" && generationsCard.change
        ? `${generationsCard.change}${separator} ${numberFormat.format(totalGenerationsAll)}`
        : generationsCard.change || "";

    return [
      { ...tokensCard, value: tokensUsedText, change: tokensChangeText, trend: "neutral" as const },
      { ...planCard, value: planText, change: "", trend: "neutral" as const },
      { ...generationsCard, value: generationsText, change: generationsChangeText, trend: "neutral" as const },
      { ...statusCard },
    ];
  }, [dictionary.stats.cards, isMembershipResolved, isPaid, locale, tokens, tokensUsed, totalGenerations, totalGenerationsAll]);

  const HandCoinsIcon = ({ className }: { className?: string }) => (
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
      <path d="M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17" />
      <path d="m7 21 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9" />
      <path d="m2 16 6 6" />
      <circle cx="16" cy="9" r="2.9" />
      <circle cx="6" cy="5" r="3" />
    </svg>
  );

  const isLoading = isTokensLoading || isHistoryLoading || !isMembershipResolved;

  const analyticsCopyByLocale: Partial<
    Record<
      Locale,
      {
        tabs: {
          usageDistribution: string;
          usageTrend: string;
          callsDistribution: string;
          callsRanking: string;
        };
        totalCalls: string;
        totalChars: string;
        dbRequired: string;
      }
    >
  > = {
    en: {
      tabs: {
        usageDistribution: "Usage distribution",
        usageTrend: "Usage trend",
        callsDistribution: "Calls distribution",
        callsRanking: "Calls ranking",
      },
      totalCalls: "Total calls",
      totalChars: "Total chars",
      dbRequired: "Set DATABASE_URL and run migrations to enable analytics.",
    },
    zh: {
      tabs: {
        usageDistribution: "消耗分布",
        usageTrend: "消耗趋势",
        callsDistribution: "调用次数分布",
        callsRanking: "调用次数排行",
      },
      totalCalls: "总调用次数",
      totalChars: "总字符数",
      dbRequired: "请配置 DATABASE_URL 并运行迁移以启用数据分析。",
    },
  };

  const analyticsCopy = analyticsCopyByLocale[locale] ?? analyticsCopyByLocale.en!;
  const analyticsTitleByLocale: Partial<Record<Locale, { title: string; subtitle: string }>> = {
    en: { title: "Usage analytics", subtitle: "Consumption and call stats" },
    zh: { title: "模型数据分析", subtitle: "消耗与调用统计" },
  };
  const analyticsTitle = analyticsTitleByLocale[locale]?.title ?? dictionary.recentActivity.title;
  const analyticsSubtitle = analyticsTitleByLocale[locale]?.subtitle ?? dictionary.recentActivity.subtitle;

  const formatCompactNumber = (value: number) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return "0";
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
    return new Intl.NumberFormat().format(n);
  };

  const formatHourLabel = (ts: string) => {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return ts;
    const localeTag = locale === "zh" ? "zh-CN" : locale === "ja" ? "ja-JP" : "en-US";
    return new Intl.DateTimeFormat(localeTag, {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  };

  const UsageBars = ({
    items,
    valueKey,
    labelKey,
    colorClass,
    unitLabel,
  }: {
    items: Array<Record<string, unknown>>;
    valueKey: string;
    labelKey: string;
    colorClass: string;
    unitLabel: string;
  }) => {
    const values = items.map((it) => (typeof it[valueKey] === "number" ? (it[valueKey] as number) : 0));
    const max = Math.max(1, ...values);

    return (
      <div className="mt-4">
        <div className="flex items-end gap-1 h-44">
          {items.map((it, idx) => {
            const raw = typeof it[valueKey] === "number" ? (it[valueKey] as number) : 0;
            const h = Math.max(2, Math.round((raw / max) * 160));
            const label = String(it[labelKey] ?? "");
            return (
              <div key={idx} className="group relative flex-1 min-w-0">
                <div className="absolute -top-12 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-700 shadow-sm group-hover:block dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
                  <div className="font-medium">{label}</div>
                  <div className="text-neutral-500 dark:text-neutral-400">
                    {unitLabel}: {formatCompactNumber(raw)}
                  </div>
                </div>
                <div className="flex items-end justify-center h-44">
                  <div className={cn("w-full rounded-sm", colorClass)} style={{ height: `${h}px` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const LineTrend = ({
    items,
    valueKey,
    labelKey,
    strokeClass,
    unitLabel,
  }: {
    items: Array<Record<string, unknown>>;
    valueKey: string;
    labelKey: string;
    strokeClass: string;
    unitLabel: string;
  }) => {
    const values = items.map((it) => (typeof it[valueKey] === "number" ? (it[valueKey] as number) : 0));
    const max = Math.max(1, ...values);

    const width = 640;
    const height = 180;
    const padX = 12;
    const padY = 14;
    const innerW = width - padX * 2;
    const innerH = height - padY * 2;

    const points = items.map((it, idx) => {
      const v = typeof it[valueKey] === "number" ? (it[valueKey] as number) : 0;
      const x = items.length <= 1 ? padX : padX + (idx / (items.length - 1)) * innerW;
      const y = padY + (1 - v / max) * innerH;
      return { x, y, v, label: String(it[labelKey] ?? "") };
    });

    const lineD = points
      .map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(" ");
    const areaD = `${lineD} L ${padX + innerW} ${padY + innerH} L ${padX} ${padY + innerH} Z`;

    return (
      <div className="mt-4">
        <div className="relative">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44 overflow-visible">
            <defs>
              <linearGradient id="dashTrendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(16 185 129)" stopOpacity="0.25" />
                <stop offset="100%" stopColor="rgb(16 185 129)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={areaD} fill="url(#dashTrendFill)" />
            <path d={lineD} className={cn("fill-none stroke-[2.5]", strokeClass)} />
            {points.map((p, idx) => (
              <g key={idx} className="group">
                <circle cx={p.x} cy={p.y} r="3" className="fill-emerald-500" />
                <foreignObject x={p.x - 52} y={p.y - 46} width="104" height="34" className="pointer-events-none opacity-0 group-hover:opacity-100">
                  <div className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] text-neutral-700 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
                    <div className="font-medium truncate">{p.label}</div>
                    <div className="text-neutral-500 dark:text-neutral-400">
                      {unitLabel}: {formatCompactNumber(p.v)}
                    </div>
                  </div>
                </foreignObject>
              </g>
            ))}
          </svg>
        </div>
      </div>
    );
  };

  const HorizontalBars = ({
    items,
    valueKey,
    labelKey,
  }: {
    items: Array<Record<string, unknown>>;
    valueKey: string;
    labelKey: string;
  }) => {
    const values = items.map((it) => (typeof it[valueKey] === "number" ? (it[valueKey] as number) : 0));
    const max = Math.max(1, ...values);

    return (
      <div className="mt-4 space-y-3">
        {items.map((it, idx) => {
          const raw = typeof it[valueKey] === "number" ? (it[valueKey] as number) : 0;
          const w = Math.max(2, Math.round((raw / max) * 100));
          const label = String(it[labelKey] ?? "");
          return (
            <div key={idx} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-neutral-700 dark:text-neutral-200">{label}</span>
                <span className="shrink-0 text-neutral-500 dark:text-neutral-400">{formatCompactNumber(raw)}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-neutral-200/70 dark:bg-neutral-800">
                <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${w}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* 欢迎消息 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
            {dictionary.welcomeMessage} {userName && <span className="text-blue-600">{userName}</span>}
          </h1>
          <p className="mt-2 text-neutral-600 dark:text-neutral-400">
            {dictionary.description}
          </p>
        </div>

        {/* 统计卡片 */}
        <div className="mb-8">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
              {dictionary.stats.title}
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {dictionary.stats.subtitle}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {statsCards.map((card, index) => {
              const TrendIcon = trendIconMap[card.trend];
              const showValueSkeleton =
                (index === 0 && isTokensLoading) ||
                (index === 1 && !isMembershipResolved) ||
                (index === 2 && isHistoryLoading);

              const planIndicator = (() => {
                if (index !== 1) return null;
                if (!isMembershipResolved) {
                  return <Loader2 className="h-4 w-4 animate-spin text-neutral-500 dark:text-neutral-400" aria-label="Loading" />;
                }

                if (isPaid === true && membershipPeriod === "yearly") {
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
                      className="h-4 w-4 text-amber-500 dark:text-amber-400"
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

                if (isPaid === true && membershipPeriod === "monthly") {
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
                      className="h-4 w-4 text-cyan-500 dark:text-cyan-400"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
                      <path d="M5 21h14" />
                    </svg>
                  );
                }

                return null;
              })();

              const hideTrendIcon = index === 0 || index === 1 || index === 2;

              return (
                <Card key={index}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                      {card.title}
                    </CardTitle>
                    {planIndicator ?? (!hideTrendIcon ? (
                      <TrendIcon
                        className={`h-4 w-4 ${
                          card.trend === "up"
                            ? "text-green-600"
                          : card.trend === "down"
                          ? "text-red-600"
                          : "text-neutral-500"
                        }`}
                      />
                    ) : null)}
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                      {showValueSkeleton ? (
                        <Skeleton className="h-8 w-24" />
                      ) : (
                        card.value
                      )}
                    </div>
                    {showValueSkeleton ? (
                      <Skeleton className="mt-2 h-3 w-32" />
                    ) : card.change ? (
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                        {index === 0 ? (
                          <span className="inline-flex items-center gap-1.5">
                            <HandCoinsIcon className="h-7 w-7 shrink-0 text-emerald-600 dark:text-emerald-400" />
                            <span>{card.change}</span>
                          </span>
                        ) : (
                          card.change
                        )}
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* 最近活动 */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    {analyticsTitle}
                  </CardTitle>
                  <CardDescription>{analyticsSubtitle}</CardDescription>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  {(
                    [
                      ["usageDistribution", analyticsCopy.tabs.usageDistribution],
                      ["usageTrend", analyticsCopy.tabs.usageTrend],
                      ["callsDistribution", analyticsCopy.tabs.callsDistribution],
                      ["callsRanking", analyticsCopy.tabs.callsRanking],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setUsageView(key)}
                      className={cn(
                        "text-xs px-2 py-1 rounded-full border transition-colors",
                        usageView === key
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-neutral-200 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-900",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isUsageLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-44 w-full" />
                  <Skeleton className="h-3 w-56" />
                </div>
              ) : usageError ? (
                <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center py-4">
                  {usageError === "DB_REQUIRED" ? analyticsCopy.dbRequired : usageError}
                </p>
              ) : usage ? (
                <div>
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-neutral-600 dark:text-neutral-400">
                    <span>
                      {analyticsCopy.totalCalls}:{" "}
                      <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {new Intl.NumberFormat().format(usage.totals.calls)}
                      </span>
                    </span>
                    <span>
                      {analyticsCopy.totalChars}:{" "}
                      <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {new Intl.NumberFormat().format(usage.totals.chars)}
                      </span>
                    </span>
                  </div>

                  {usageView === "usageTrend" ? (
                    <LineTrend
                      items={usage.hourly.map((h) => ({ label: formatHourLabel(h.ts), value: h.chars }))}
                      labelKey="label"
                      valueKey="value"
                      strokeClass="stroke-emerald-500"
                      unitLabel={analyticsCopy.totalChars}
                    />
                  ) : usageView === "callsRanking" ? (
                    <HorizontalBars
                      items={usage.topVoices.map((v) => ({ label: v.voice, value: v.calls }))}
                      labelKey="label"
                      valueKey="value"
                    />
                  ) : usageView === "callsDistribution" ? (
                    <UsageBars
                      items={usage.hourly.map((h) => ({ label: formatHourLabel(h.ts), value: h.calls }))}
                      labelKey="label"
                      valueKey="value"
                      colorClass="bg-emerald-500/90"
                      unitLabel={analyticsCopy.totalCalls}
                    />
                  ) : (
                    <UsageBars
                      items={usage.hourly.map((h) => ({ label: formatHourLabel(h.ts), value: h.chars }))}
                      labelKey="label"
                      valueKey="value"
                      colorClass="bg-emerald-500/90"
                      unitLabel={analyticsCopy.totalChars}
                    />
                  )}
                </div>
              ) : (
                <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center py-4">
                  {dictionary.recentActivity.noActivity}
                </p>
              )}
            </CardContent>
          </Card>

          {/* 快速操作 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                {dictionary.quickActions.title}
              </CardTitle>
              <CardDescription>
                {dictionary.quickActions.subtitle}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="grid gap-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={index}
                      className="w-full rounded-md border border-neutral-200 bg-white py-3 px-4 dark:border-neutral-800 dark:bg-neutral-900"
                    >
                      <div className="flex items-center gap-3 w-full">
                        <Skeleton className="h-10 w-10 rounded-lg" />
                        <div className="flex-1">
                          <Skeleton className="h-4 w-36" />
                          <Skeleton className="mt-2 h-3 w-52" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid gap-3">
                  {dictionary.quickActions.actions.map((action, index) => {
                    const Icon = iconMap[action.icon] || Settings;
                    const href = `/${locale}${action.href}`.replace(/\/{2,}/g, "/");
                    return (
                      <Link key={index} href={href}>
                        <Button
                          variant="outline"
                          className="w-full justify-start h-auto py-3 px-4 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        >
                          <div className="flex items-center gap-3 w-full">
                            <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", membershipAccent.bg)}>
                              <Icon className={cn("h-5 w-5", membershipAccent.fg)} />
                            </div>
                            <div className="flex-1 text-left">
                              <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                                {action.title}
                              </p>
                              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                {action.description}
                              </p>
                            </div>
                          </div>
                        </Button>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
