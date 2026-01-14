"use client";

import React, { useEffect, useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import Image from "next/image";

import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Header } from "@/components/ui/Header";
import { Footer } from "@/components/ui/Footer";
import { Waveform, Refresh } from "@/components/ui/Icons";

import { useLocale } from "@/hooks";
import type { Locale } from "@/i18n";
import { useBodyScrollable } from "@/hooks/useBodyScrollable";
import { siteConfig } from "@/lib/site-config";
import { getPodcastMvpUiCopy } from "@/components/TTSPage";
import { assetUrl } from "@/lib/asset-url";

function formatTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = vars[key];
    return value === undefined ? match : String(value);
  });
}

const PremiumCrownIcon = ({ className }: { className?: string }) => (
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
  >
    <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
    <path d="M5 21h14" />
  </svg>
);

const NotebookTextIcon = ({ className }: { className?: string }) => (
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
    className={clsx("lucide lucide-notebook-text-icon lucide-notebook-text", className)}
    aria-hidden="true"
  >
    <path d="M2 6h4" />
    <path d="M2 10h4" />
    <path d="M2 14h4" />
    <path d="M2 18h4" />
    <rect width="16" height="20" x="4" y="2" rx="2" />
    <path d="M9.5 8h5" />
    <path d="M9.5 12H16" />
    <path d="M9.5 16H14" />
  </svg>
);

const HistoryIcon = ({ className }: { className?: string }) => (
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
    className={clsx("lucide lucide-history-icon lucide-history", className)}
    aria-hidden="true"
  >
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l4 2" />
  </svg>
);

const CoinsIcon = ({ className }: { className?: string }) => (
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
    className={clsx("lucide lucide-coins-icon lucide-coins text-amber-600 dark:text-amber-400", className)}
    aria-hidden="true"
  >
    <circle cx="8" cy="8" r="6" />
    <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
    <path d="M7 6h1v4" />
    <path d="m16.71 13.88.7.71-2.82 2.82" />
  </svg>
);

function TokensUsedInline({ tokensUsed }: { tokensUsed: number }) {
  if (!Number.isFinite(tokensUsed) || tokensUsed <= 0) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground shrink-0" dir="ltr">
      <CoinsIcon className="h-4 w-4" />
      <span className="font-mono">{Math.floor(tokensUsed).toLocaleString()}</span>
    </span>
  );
}

function podcastMvpHref(locale: Locale): string {
  return locale === "en" ? "/podcast-mvp" : `/${locale}/podcast-mvp`;
}

function voiceCloningHref(locale: Locale): string {
  return locale === "en" ? "/voice-cloning" : `/${locale}/voice-cloning`;
}

const SidebarItem = ({ icon, label, active, href }: { icon: React.ReactNode; label: React.ReactNode; active?: boolean; href: string }) => {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {icon}
      <span className="flex items-center gap-2">{label}</span>
    </Link>
  );
};

const Sidebar = ({ active }: { active: "tts" | "history" }) => {
  const { locale } = useLocale();
  const copy = getPodcastMvpUiCopy(locale);

  const ttsHref = podcastMvpHref(locale);
  const historyHref = `${ttsHref}/history`;
  const cloningHref = voiceCloningHref(locale);
  const showVoiceCloning = process.env.NEXT_PUBLIC_VOICE_CLONING_ENABLED === "1";

  return (
    <aside className="w-64 bg-background border-r border-border hidden md:flex flex-col">
      <div className="p-6">
        <div className="flex items-center gap-3">
          <Image
            src={assetUrl("/photo/text-to-speech.webp")}
            alt="RTVox"
            width={32}
            height={32}
            className="h-8 w-8 rounded-lg"
          />
          <span className="font-bold text-lg tracking-tight">{siteConfig.brandName}</span>
        </div>
      </div>

      <nav className="flex-1 px-4 py-2 space-y-1">
        <SidebarItem
          icon={<NotebookTextIcon className="w-5 h-5" />}
          label={copy.sidebarTextToSpeech}
          active={active === "tts"}
          href={ttsHref}
        />
        {showVoiceCloning ? (
          <SidebarItem
            icon={<Waveform className="w-5 h-5" />}
            label={
              <span className="flex items-center gap-2">
                <PremiumCrownIcon className="w-4 h-4" />
                <span>Voice Cloning</span>
              </span>
            }
            active={false}
            href={cloningHref}
          />
        ) : null}
        <SidebarItem
          icon={<HistoryIcon className="w-5 h-5" />}
          label={copy.sidebarHistory}
          active={active === "history"}
          href={historyHref}
        />
      </nav>

      <div className="px-4 py-2 mt-auto">
        <div className="p-3 rounded-lg bg-muted/30 border border-border mb-6">
          <div className="text-sm font-medium">{copy.sidebarSupportTitle}</div>
          <a
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
            href={`mailto:${siteConfig.supportEmail}`}
          >
            {siteConfig.supportEmail}
          </a>
        </div>
      </div>
    </aside>
  );
};

const HistoryBoard = () => {
  const { locale } = useLocale();
  const copy = getPodcastMvpUiCopy(locale);

  const [items, setItems] = useState<
    Array<{
      id: string;
      createdAt: string;
      title?: string | null;
      voice: string;
      tone: string;
      input: string;
      audioUrl: string;
      tokensUsed: number;
    }>
  >([]);
  const [policy, setPolicy] = useState<{ maxItems: number; maxDays: number; maxTotalBytes: number } | null>(null);
  const [usage, setUsage] = useState<{ totalItems: number; totalBytes: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [cloneNameByVoiceId, setCloneNameByVoiceId] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const pageSize = 6;

  const formatBytes = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    let idx = 0;
    let value = bytes;
    while (value >= 1024 && idx < units.length - 1) {
      value /= 1024;
      idx += 1;
    }
    return `${value.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
  };

  const safeDownloadName = ({ title, voice }: { title?: string | null; voice: string }) => {
    const base = typeof title === "string" && title.trim() ? title : voice;
    const safe = base.replace(/[^\w\-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "voice";
    return `${siteConfig.downloadPrefix}-${safe}.mp3`;
  };

  const loadPage = async (requestedPageRaw: number, allowFallback = true) => {
    const requestedPage = Math.max(1, Math.floor(requestedPageRaw));
    setLoading(true);
    setError(null);
    try {
      const offset = (requestedPage - 1) * pageSize;
      const res = await fetch(`/api/tts/history?limit=${pageSize}&offset=${offset}`, { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 401) throw new Error("Sign in to view history.");
        const text = await res.text().catch(() => "");
        throw new Error(text || "Failed to load history");
      }
      const data = (await res.json()) as {
        items: Array<{ id: string; createdAt: string; title?: string | null; voice: string; tone: string; input: string; audioUrl: string; tokensUsed: number }>;
        policy: { maxItems: number; maxDays: number; maxTotalBytes: number };
        usage: { totalItems: number; totalBytes: number };
        pagination?: { limit: number; offset: number; hasMore: boolean };
      };

      const usageNext = data.usage ?? null;
      const totalItems = usageNext?.totalItems ?? 0;
      const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

      if (allowFallback && totalItems > 0 && requestedPage > totalPages) {
        setPage(totalPages);
        await loadPage(totalPages, false);
        return;
      }

      setPage(requestedPage);
      setItems(data.items ?? []);
      setPolicy(data.policy ?? null);
      setUsage(usageNext);
      setSelectedIds(new Set());
    } catch (err) {
      setItems([]);
      setError(err instanceof Error ? err.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    await loadPage(page);
  };

  useEffect(() => {
    void loadPage(1);
    fetch("/api/voice-clone", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { clones?: Array<{ id: string; name: string; provider: string; providerVoiceId: string; status: string }> } | null) => {
        const map: Record<string, string> = {};
        for (const c of data?.clones ?? []) {
          if (c.status !== "ready") continue;
          map[`clone:${c.id}`] = c.name;
          if (c.provider === "elevenlabs") map[`elevenlabs:${c.providerVoiceId}`] = c.name;
        }
        setCloneNameByVoiceId(map);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleAll = () => {
    const all = items.map((it) => it.id);
    setSelectedIds((prev) => {
      if (prev.size === all.length) return new Set();
      return new Set(all);
    });
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm(copy.historyConfirmDelete)) return;
    const res = await fetch("/api/tts/history", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      alert(text || "Failed to delete");
      return;
    }
    await refresh();
  };

  const selectedCount = selectedIds.size;
  const totalCount = usage?.totalItems ?? items.length;
  const noteDays = policy?.maxDays ?? 7;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;

  const goToPage = async (next: number) => {
    const clamped = Math.max(1, Math.min(totalPages, Math.floor(next)));
    setSelectedIds(new Set());
    await loadPage(clamped);
  };

  const pageItems = (() => {
    const pages = new Set<number>();
    pages.add(1);
    pages.add(totalPages);
    pages.add(page);
    pages.add(page - 1);
    pages.add(page + 1);
    return Array.from(pages)
      .filter((p) => p >= 1 && p <= totalPages)
      .sort((a, b) => a - b);
  })();

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">{copy.historyBoardTitle}</h1>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-border bg-muted/20 px-4 py-2 text-sm font-medium hover:bg-muted/30 disabled:opacity-60"
        >
          <Refresh className="w-4 h-4" />
          {copy.historyBoardRefresh}
        </button>
      </div>

      <div className="mt-6 rounded-3xl border border-border bg-background/40 p-6">
        <div className="text-sm text-muted-foreground italic">
          {formatTemplate(copy.historyBoardNote, { days: noteDays, maxItems: policy?.maxItems ?? 20 })}
        </div>
        <div className="mt-2 text-sm text-muted-foreground">
          {formatTemplate(copy.historyBoardSelectionSummary, {
            selected: selectedCount,
            pageItems: items.length,
            totalCount,
          })}
          {usage && policy ? (
            <span className="ml-3">
              {formatTemplate(copy.historyBoardUsageSummary, {
                usedItems: usage.totalItems,
                maxItems: policy.maxItems,
                usedBytes: formatBytes(usage.totalBytes),
                maxBytes: formatBytes(policy.maxTotalBytes),
              })}
            </span>
          ) : null}
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[980px] border-separate border-spacing-0">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="w-10 px-4 py-3 border-y border-border bg-muted/20 rounded-l-2xl">
                  <input
                    type="checkbox"
                    checked={items.length > 0 && selectedIds.size === items.length}
                    onChange={toggleAll}
                    className="h-4 w-4 accent-primary"
                    aria-label={copy.historyBoardSelectAllAria}
                  />
                </th>
                <th className="px-4 py-3 border-y border-border bg-muted/20">{copy.historyBoardColumnText}</th>
                <th className="px-4 py-3 border-y border-border bg-muted/20">{copy.historyBoardColumnVoice}</th>
                <th className="px-4 py-3 border-y border-border bg-muted/20">{copy.historyBoardColumnCreatedAt}</th>
                <th className="px-4 py-3 border-y border-border bg-muted/20">{copy.historyBoardColumnAudio}</th>
                <th className="px-4 py-3 border-y border-border bg-muted/20">{copy.historyBoardColumnActions}</th>
                <th className="w-20 px-4 py-3 border-y border-border bg-muted/20 rounded-r-2xl text-right">
                  <span className="sr-only">{copy.historyDelete}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`} className="hover:bg-muted/10">
                    <td className="w-10 px-4 py-4 border-b border-border/50">
                      <Skeleton className="h-4 w-4 rounded-full" />
                    </td>
                    <td className="px-4 py-4 border-b border-border/50">
                      <Skeleton className="h-4 w-[260px] max-w-full" />
                      <Skeleton className="mt-2 h-3 w-[180px] max-w-full opacity-70" />
                    </td>
                    <td className="px-4 py-4 border-b border-border/50">
                      <Skeleton className="h-4 w-[180px] max-w-full" />
                    </td>
                    <td className="px-4 py-4 border-b border-border/50">
                      <Skeleton className="h-4 w-[160px] max-w-full" />
                    </td>
                    <td className="px-4 py-4 border-b border-border/50">
                      <Skeleton className="h-12 w-[340px] max-w-full rounded-full" />
                    </td>
                    <td className="px-4 py-4 border-b border-border/50">
                      <Skeleton className="h-9 w-[110px] rounded-lg" />
                    </td>
                    <td className="px-4 py-4 border-b border-border/50 text-right">
                      <Skeleton className="h-10 w-[96px] rounded-xl" />
                    </td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-sm text-muted-foreground text-center">
                    {error}
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-sm text-muted-foreground text-center">
                    {formatTemplate(copy.noHistoryYet, { generate: copy.generate, textToSpeech: copy.blockTextToSpeech })}
                  </td>
                </tr>
              ) : (
                items.map((it, idx) => {
                  const checked = selectedIds.has(it.id);
                  const isLast = idx === items.length - 1;
                  const borderClass = isLast ? "border-b border-border" : "border-b border-border/50";
                  const displayVoice =
                    cloneNameByVoiceId[it.voice] ||
                    (it.voice === "mic-recording" ? copy.historyBoardRecordAudioLabel : it.voice);
                  const textPreview = (it.input || "").trim();
                  const textShort = textPreview.length > 40 ? `${textPreview.slice(0, 40)}…` : textPreview;
                  const title = typeof it.title === "string" ? it.title.trim() : "";
                  return (
                    <tr key={it.id} className="hover:bg-muted/10">
                      <td className={`w-10 px-4 py-4 ${borderClass}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleOne(it.id)}
                          className="h-4 w-4 accent-primary"
                          aria-label={`Select ${it.id}`}
                        />
                      </td>
                      <td className={`px-4 py-4 ${borderClass} text-sm text-foreground`}>
                        {title ? (
                          <div className="min-w-0">
                            <div className="font-medium truncate" title={title}>
                              {title}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground truncate" title={textPreview}>
                              {textShort || "—"}
                            </div>
                          </div>
                        ) : (
                          <span title={textPreview}>{textShort || "—"}</span>
                        )}
                      </td>
                      <td className={`px-4 py-4 ${borderClass} text-sm text-muted-foreground`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="truncate" title={it.voice}>
                            {displayVoice}
                          </span>
                          <TokensUsedInline tokensUsed={it.tokensUsed} />
                        </div>
                      </td>
                      <td className={`px-4 py-4 ${borderClass} text-sm text-muted-foreground`}>
                        {new Date(it.createdAt).toLocaleString()}
                      </td>
                      <td className={`px-4 py-4 ${borderClass}`}>
                        <audio className="w-[340px] max-w-full" controls preload="metadata" src={it.audioUrl} />
                      </td>
                      <td className={`px-4 py-4 ${borderClass}`}>
                        <a
                          href={it.audioUrl}
                          download={safeDownloadName({ title: it.title, voice: it.voice })}
                          className="inline-flex items-center justify-center rounded-lg border border-border bg-muted/10 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/20 hover:text-foreground"
                        >
                          {copy.historyDownload}
                        </a>
                      </td>
                      <td className={`px-4 py-4 ${borderClass} text-right`}>
                        <button
                          type="button"
                          onClick={() => handleDelete(it.id)}
                          className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                        >
                          {copy.historyDelete}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 ? (
          <div className="mt-6">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (!canGoPrev) return;
                      void goToPage(page - 1);
                    }}
                    aria-disabled={!canGoPrev}
                    tabIndex={canGoPrev ? 0 : -1}
                    className={!canGoPrev ? "pointer-events-none opacity-50" : undefined}
                  />
                </PaginationItem>

                {pageItems.map((p, idx) => {
                  const prev = pageItems[idx - 1];
                  const needsEllipsis = prev !== undefined && p - prev > 1;
                  return (
                    <React.Fragment key={`page-${p}`}>
                      {needsEllipsis ? (
                        <PaginationItem key={`ellipsis-${p}`}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      ) : null}
                      <PaginationItem>
                        <PaginationLink
                          href="#"
                          isActive={p === page}
                          onClick={(e) => {
                            e.preventDefault();
                            if (p === page) return;
                            void goToPage(p);
                          }}
                        >
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    </React.Fragment>
                  );
                })}

                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (!canGoNext) return;
                      void goToPage(page + 1);
                    }}
                    aria-disabled={!canGoNext}
                    tabIndex={canGoNext ? 0 : -1}
                    className={!canGoNext ? "pointer-events-none opacity-50" : undefined}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default function PodcastMvpHistoryPage() {
  const isScrollable = useBodyScrollable();
  const { locale } = useLocale();

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

  const podcastLabelByLocale: Partial<Record<Locale, string>> = {
    en: "Podcast MVP",
    zh: "播客生成",
    es: "Podcast MVP",
    ar: "Podcast MVP",
    id: "Podcast MVP",
    pt: "Podcast MVP",
    fr: "Podcast MVP",
    ja: "Podcast MVP",
    ru: "Podcast MVP",
    de: "Podcast MVP",
  };

  const homeLabel = homeLabelByLocale[locale] ?? "Home";
  const podcastLabel = podcastLabelByLocale[locale] ?? "Podcast MVP";
  const homeHref = locale === "en" ? "/" : `/${locale}/`;
  const ttsHref = podcastMvpHref(locale);
  const copy = getPodcastMvpUiCopy(locale);

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden selection:bg-primary/20">
      <Sidebar active="history" />
      <div className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden">
        <main
          data-scrollable={isScrollable}
          className="flex-1 overflow-y-auto no-scrollbar px-5 pt-6 pb-32 md:pb-24"
        >
          <div className="max-w-[1300px] mx-auto">
            <div className="mb-6 flex justify-center md:justify-start">
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
                      <Link href={ttsHref}>{podcastLabel}</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{copy.sidebarHistory}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            <Header />
            <HistoryBoard />
            <Footer />
          </div>
        </main>
      </div>
    </div>
  );
}
