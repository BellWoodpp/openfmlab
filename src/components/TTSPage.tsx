"use client";
import React, { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Header } from "./ui/Header";
import { Docs, Waveform, Refresh } from "./ui/Icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import dynamic from "next/dynamic";
import { Upload, X } from "lucide-react";
import { useLocale } from "@/hooks";
import type { Locale } from "@/i18n";
import { useBodyScrollable } from "@/hooks/useBodyScrollable";
import { Block } from "./ui/Block";
import { Footer } from "./ui/Footer";
import { appStore } from "@/lib/store";
import { Skeleton } from "@/components/ui/skeleton";
import BrowserNotSupported from "./ui/BrowserNotSupported";
import PlayButton from "./PlayButton";
import { ShareButton } from "./ShareButton";
import { VoiceCloningClient } from "@/components/voice-cloning-client";

type ViewType = 'tts' | 'cloning' | 'history';
type CostEstimateData = {
  supported: boolean;
  billingTier: string;
  estimate?: {
    chars: number;
    freeRemainingChars: number;
    billableChars: number;
    estimatedCostHkd: number;
  };
  pricing?: { freeCharsPerMonth: number; hkdPer1MCharsOverFree: number };
  tokenEstimate?: { charsPerToken: number; baseTokens: number; multiplier: number; tokens: number };
  usageTracked?: boolean;
  month?: string;
};

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

function formatClock(totalSeconds: number | null) {
  if (!Number.isFinite(totalSeconds ?? NaN) || (totalSeconds ?? 0) < 0) return "--:--";
  const s = Math.floor(totalSeconds ?? 0);
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

async function probeAudioUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: "GET",
      credentials: "same-origin",
      headers: { Range: "bytes=0-1" },
      cache: "no-store",
    });

    if (res.ok || res.status === 206) return null;
    if (res.status === 401) return "未登录（请先登录）";
    if (res.status === 403) return "没有权限访问这段音频";
    if (res.status === 404) return "音频不存在（404）";
    if (res.status === 501) return "未启用历史功能（501）";
    if (res.status >= 500) return `服务器错误（${res.status}）`;
    return `请求失败（${res.status}）`;
  } catch {
    return "网络错误（无法加载音频）";
  }
}

function HistoryAudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showLoading = loading && !error;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          总时长：{formatClock(duration)}
          {showLoading ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary/70 animate-pulse" />
              <span>正在加载…</span>
            </span>
          ) : null}
        </span>
        {error ? <span className="text-red-500">{error}</span> : null}
      </div>
      <audio
        ref={audioRef}
        className="w-full"
        controls
        preload="metadata"
        src={src}
        onLoadStart={() => {
          setLoading(true);
          setError(null);
        }}
        onLoadedMetadata={(e) => {
          const d = (e.currentTarget as HTMLAudioElement).duration;
          setDuration(Number.isFinite(d) ? d : null);
          setLoading(false);
          setError(null);
        }}
        onDurationChange={(e) => {
          const d = (e.currentTarget as HTMLAudioElement).duration;
          setDuration(Number.isFinite(d) ? d : null);
        }}
        onPlaying={() => {
          setLoading(false);
          setError(null);
        }}
        onCanPlay={() => {
          setLoading(false);
          setError(null);
        }}
        onWaiting={() => {
          setLoading(true);
          setError(null);
        }}
        onError={() => {
          setLoading(false);
          void probeAudioUrl(src).then((detail) => {
            setError(detail || "无法加载音频");
          });
        }}
      />
    </div>
  );
}

function VoicePickerSkeleton() {
  return (
    <div className="flex flex-col gap-3 h-full">
      <Skeleton className="h-9 w-full rounded-xl" />
      <Skeleton className="h-9 w-full rounded-xl" />
      <Skeleton className="h-9 w-full rounded-xl" />
      <div className="mt-3 flex-1 min-h-0 max-h-[500px] overflow-y-auto rounded-xl border border-border bg-muted/20 shadow-inner">
        <div className="p-3 grid grid-cols-3 gap-2">
          {Array.from({ length: 12 }).map((_, idx) => (
            <div
              key={`voice-skel-${idx}`}
              className="w-full flex flex-col items-center gap-2 rounded-lg p-2"
            >
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const GoogleVoicePicker = dynamic(() => import("./GoogleVoicePicker"), {
  ssr: false,
  loading: () => <VoicePickerSkeleton />,
});

export default function TtsPage() {
  const isVoiceCloningUiEnabled = process.env.NEXT_PUBLIC_VOICE_CLONING_ENABLED === "1";
  const [currentView, setCurrentView] = useState<ViewType>('tts');
  const isScrollable = useBodyScrollable();
  const { locale } = useLocale();
  const router = useRouter();
  const [isVoiceCloningPaid, setIsVoiceCloningPaid] = useState<boolean | null>(null);

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
  const pricingHref = `/${locale}/pricing`;

  useEffect(() => {
    if (!isVoiceCloningUiEnabled && currentView === "cloning") {
      setCurrentView("tts");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVoiceCloningUiEnabled]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/membership/status", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled) return;
        const isPaid = (json as { data?: { isPaid?: unknown } } | null)?.data?.isPaid;
        if (typeof isPaid === "boolean") setIsVoiceCloningPaid(isPaid);
        else setIsVoiceCloningPaid(false);
      })
      .catch(() => {
        if (cancelled) return;
        setIsVoiceCloningPaid(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleVoiceCloningClick = async () => {
    if (!isVoiceCloningUiEnabled) return;
    if (isVoiceCloningPaid === true) {
      setCurrentView("cloning");
      return;
    }

    // If status is unknown, re-check once to avoid stale UI.
    if (isVoiceCloningPaid === null) {
      try {
        const res = await fetch("/api/membership/status", { cache: "no-store" });
        const json = res.ok ? ((await res.json()) as { data?: { isPaid?: unknown } }) : null;
        const isPaid = json?.data?.isPaid;
        if (typeof isPaid === "boolean") {
          setIsVoiceCloningPaid(isPaid);
          if (isPaid) {
            setCurrentView("cloning");
            return;
          }
        }
      } catch {
        setIsVoiceCloningPaid(false);
      }
    }

    router.push(pricingHref);
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden selection:bg-primary/20">
      <Sidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        onVoiceCloningClick={handleVoiceCloningClick}
        showVoiceCloning={isVoiceCloningUiEnabled}
      />
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
                      <BreadcrumbPage>{podcastLabel}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
	             <Header />
	             {currentView === 'tts' ? (
	               <TTSBoard />
	             ) : currentView === 'cloning' && isVoiceCloningUiEnabled ? (
	               <CloningBoard onGoToTts={() => setCurrentView("tts")} />
	             ) : (
	               <HistoryBoard />
	             )}
	             <Footer />
	          </div>
	        </main>
      </div>
    </div>
  );
}

const Sidebar = ({
  currentView,
  onViewChange,
  onVoiceCloningClick,
  showVoiceCloning,
}: {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  onVoiceCloningClick: () => void;
  showVoiceCloning: boolean;
}) => {

  return (
    <aside className="w-64 bg-background border-r border-border hidden md:flex flex-col">
      <div className="p-6">
        <div className="flex items-center gap-3">
           <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
             <Waveform className="text-white w-5 h-5" />
           </div>
           <span className="font-bold text-lg tracking-tight">Voiceslab</span>
        </div>
      </div>

      <nav className="flex-1 px-4 py-2 space-y-1">
	        <SidebarItem 
	          icon={<Docs className="w-5 h-5" />} 
	          label="Text to Speech" 
	          active={currentView === 'tts'} 
	          onClick={() => onViewChange('tts')}
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
	            active={currentView === 'cloning'}
	            onClick={onVoiceCloningClick}
	          />
          ) : null}
	        <SidebarItem
	          icon={<Refresh className="w-5 h-5" />}
	          label="History"
	          active={currentView === 'history'}
	          onClick={() => onViewChange('history')}
	        />
	      </nav>

	      <div className="px-4 py-2 mt-auto">
	        <div className="p-3 rounded-lg bg-muted/30 border border-border mb-6">
	          <div className="text-sm font-medium">如果有使用上的问题，联系我们</div>
	          <a
	            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
	            href="mailto:support@voiceslab.ai"
	          >
	            support@voiceslab.ai
	          </a>
	        </div>
	      </div>
	    </aside>
	  );
	};

const SidebarItem = ({ icon, label, active, onClick }: { icon: React.ReactNode; label: React.ReactNode; active?: boolean; onClick?: () => void }) => {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {icon}
      <span className="flex items-center gap-2">{label}</span>
    </button>
  );
};

const TTSBoard = () => {
  const tone = appStore.useState((state) => state.tone);
  const speakingRateMode = appStore.useState((state) => state.speakingRateMode);
  const speakingRate = appStore.useState((state) => state.speakingRate);
  const playbackRate = appStore.useState((state) => state.playbackRate);
  const volumeGainDb = appStore.useState((state) => state.volumeGainDb);
  const input = appStore.useState((state) => state.input);
  const voice = appStore.useState((state) => state.voice);
  const ttsHistory = appStore.useState((state) => state.ttsHistory);
  const browserNotSupported = appStore.useState(
    () => !("serviceWorker" in navigator)
  );
  const [costEstimate, setCostEstimate] = useState<CostEstimateData | null>(null);
  const estimatedTokens =
    costEstimate?.supported && typeof costEstimate?.tokenEstimate?.tokens === "number"
      ? costEstimate.tokenEstimate.tokens
      : input.length === 0
        ? 0
        : Math.ceil(input.length / 4);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyPolicy, setHistoryPolicy] = useState<{
    maxItems: number;
    maxDays: number;
    maxTotalBytes: number;
  } | null>(null);
  const [historyUsage, setHistoryUsage] = useState<{ totalItems: number; totalBytes: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importedParts, setImportedParts] = useState<string[] | null>(null);
  const [activePartIndex, setActivePartIndex] = useState(0);
  const historyPageSize = 6;
  const [historyPage, setHistoryPage] = useState(1);

	  useEffect(() => {
	    let cancelled = false;
	    const chars = input.length;
	    const v = voice;
	    const t = window.setTimeout(() => {
        if (cancelled) return;
        if (!chars || !v) {
          setCostEstimate(null);
          return;
        }
	      const url = new URL("/api/tts/cost", window.location.origin);
	      url.searchParams.set("voice", v);
	      url.searchParams.set("chars", String(chars));
	      fetch(url.toString(), { cache: "no-store" })
	        .then((res) => (res.ok ? res.json() : null))
        .then((json) => {
          if (cancelled) return;
          const data = (json as { data?: unknown } | null)?.data as CostEstimateData | undefined;
          if (!data || typeof data.supported !== "boolean") {
            setCostEstimate(null);
            return;
          }
          setCostEstimate(data);
        })
        .catch(() => {
          if (cancelled) return;
          setCostEstimate(null);
        });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [input.length, voice]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      setHistoryLoading(true);
      setHistoryError(null);
    }, 0);

    fetch("/api/tts/history?limit=20")
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 401) throw new Error("AUTH_REQUIRED");
          if (res.status === 501) throw new Error("DB_REQUIRED");
          const details = await res.text().catch(() => "");
          throw new Error(details || `Failed to load history (${res.status})`);
        }
        return res.json() as Promise<{
          items: Array<{
            id: string;
            createdAt: string;
            voice: string;
            tone: string;
            audioUrl: string;
          }>;
          policy: { maxItems: number; maxDays: number; maxTotalBytes: number };
          usage: { totalItems: number; totalBytes: number };
        }>;
      })
      .then((data) => {
        if (cancelled) return;
        setHistoryPolicy(data.policy);
        setHistoryUsage(data.usage);
        appStore.setState((draft) => {
          draft.ttsHistory = data.items.map((it) => ({
            id: it.id,
            createdAt: it.createdAt,
            voice: it.voice,
            tone:
              it.tone === "calm" ||
              it.tone === "serious" ||
              it.tone === "cheerful" ||
              it.tone === "excited" ||
              it.tone === "surprised"
                ? it.tone
                : "neutral",
            audioUrl: it.audioUrl,
          }));
        });
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load history";
        if (message === "AUTH_REQUIRED") {
          setHistoryError("Sign in to sync history across devices.");
          return;
        }
        if (message === "DB_REQUIRED") {
          setHistoryError("Set DATABASE_URL and run migrations to enable history.");
          return;
        }
        setHistoryError(message);
      })
      .finally(() => {
        clearTimeout(timer);
        if (cancelled) return;
        setHistoryLoading(false);
      });

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

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

	  const safeDownloadName = (voice: string) => {
	    const safe = voice.replace(/[^\w\-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "voice";
	    return `voiceslab-${safe}.mp3`;
	  };

  const formatPartSize = (length: number) => {
    if (!Number.isFinite(length) || length <= 0) return "0";
    if (length >= 1000) return `${Math.floor(length / 1000)}k`;
    return String(length);
  };

  const splitTextIntoParts = (text: string, maxLen = 5000) => {
    const normalized = text.replace(/\r\n/g, "\n");
    const parts: string[] = [];
    let remaining = normalized;

    while (remaining.length > maxLen) {
      const candidate = remaining.slice(0, maxLen);
      const breakAt = Math.max(candidate.lastIndexOf("\n"), candidate.lastIndexOf(" "));
      const cut = breakAt > Math.floor(maxLen * 0.6) ? breakAt : maxLen;
      parts.push(remaining.slice(0, cut).trimEnd());
      remaining = remaining.slice(cut).replace(/^\s+/, "");
    }

    parts.push(remaining);
    return parts.filter((p) => p.length > 0);
  };

  const setInputText = (next: string) => {
    appStore.setState((draft) => {
      draft.input = next;
      draft.latestAudioUrl = null;
      draft.latestAudioBlobUrl = null;
    });
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("File too large. Please upload a text file under 5MB.");
      return;
    }

    const text = await file.text();
    const parts = splitTextIntoParts(text, 5000);
    if (parts.length === 0) return;

    setImportedParts(parts);
    setActivePartIndex(0);
    setInputText(parts[0] ?? "");
  };

  const handleSelectPart = (idx: number) => {
    if (!importedParts?.[idx]) return;
    setActivePartIndex(idx);
    setInputText(importedParts[idx] ?? "");
  };

  const handleClearText = () => {
    if (!input.trim() && !importedParts) return;
    setImportedParts(null);
    setActivePartIndex(0);
    setInputText("");
  };

  const handleClearHistory = async () => {
    if (!confirm("Clear all generated history?")) return;
    const res = await fetch("/api/tts/history", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    if (!res.ok) {
      const details = await res.text().catch(() => "");
      alert(details || "Failed to clear history");
      return;
    }
    const data = (await res.json()) as { usage?: { totalItems: number; totalBytes: number } };
    setHistoryUsage(data.usage ?? { totalItems: 0, totalBytes: 0 });
    appStore.setState((draft) => {
      draft.ttsHistory = [];
      draft.latestAudioId = null;
      draft.latestAudioUrl = null;
      draft.latestAudioBlobUrl = null;
    });
  };

  const handleDeleteHistoryItem = async (id: string) => {
    if (!confirm("Delete this audio from history?")) return;
    const res = await fetch("/api/tts/history", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      const details = await res.text().catch(() => "");
      alert(details || "Failed to delete");
      return;
    }
    const data = (await res.json()) as { usage?: { totalItems: number; totalBytes: number } };
    setHistoryUsage(data.usage ?? historyUsage);
    appStore.setState((draft) => {
      draft.ttsHistory = draft.ttsHistory.filter((it) => it.id !== id);
      if (draft.latestAudioId === id) {
        const next = draft.ttsHistory[0] ?? null;
        draft.latestAudioId = next?.id ?? null;
        draft.latestAudioUrl = next?.audioUrl ?? null;
        draft.latestAudioBlobUrl = next?.audioUrl ?? null;
      }
    });
  };

	  const historyVisibleItems = ttsHistory.slice(0, 20);
	  const historyTotalPages = Math.max(1, Math.ceil(historyVisibleItems.length / historyPageSize));
	  const historyPageClamped = Math.min(Math.max(1, historyPage), historyTotalPages);
	  const historyPagedItems = historyVisibleItems.slice(
	    (historyPageClamped - 1) * historyPageSize,
	    historyPageClamped * historyPageSize,
	  );

  return (
    <div className="flex-1 flex flex-col h-full w-full relative">
      {browserNotSupported && (
        <BrowserNotSupported
          open={browserNotSupported}
          onOpenChange={() => {}}
        />
      )}

      <div className="flex flex-col lg:flex-row gap-6 h-full pb-6">
        {/* Left Column: Text Input & Controls (1/2 Width) */}
        <div className="lg:flex-[2_1_0%] flex flex-col min-w-0 h-full">
          <Block title="Text to speech">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,text/plain,text/markdown"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  type="button"
                  onClick={handleUploadClick}
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-muted/20 px-4 text-sm font-medium text-foreground hover:bg-muted/30"
                >
                  <Upload className="h-4 w-4" />
                  Upload File
                </button>

                {importedParts ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {importedParts.map((part, idx) => {
                      const active = idx === activePartIndex;
                      return (
                        <button
                          key={`part-${idx}`}
                          type="button"
                          onClick={() => handleSelectPart(idx)}
                          className={clsx(
                            "inline-flex h-9 items-center rounded-full border px-4 text-sm transition-colors",
                            active
                              ? "border-foreground/40 bg-foreground/10 text-foreground"
                              : "border-border bg-muted/10 text-muted-foreground hover:bg-muted/20 hover:text-foreground",
                          )}
                          aria-pressed={active}
                        >
                          Part {idx + 1}
                          <span className={clsx("ml-2 text-xs", active ? "text-foreground/80" : "text-muted-foreground")}>
                            {formatPartSize(part.length)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>

		              <div className="flex items-center gap-3">
		                <div
                      className="inline-flex h-9 items-center rounded-full border border-border bg-muted/20 px-4 text-sm text-muted-foreground"
                    >
		                  {input.length} / 5000 characters · {estimatedTokens} tokens
		                </div>
		                <button
		                  type="button"
	                  onClick={handleClearText}
                  className={clsx(
                    "inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm font-medium transition-colors",
                    input.trim() || importedParts ? "text-muted-foreground hover:text-foreground" : "pointer-events-none opacity-40 text-muted-foreground",
                  )}
                >
                  <X className="h-4 w-4" />
                  Clear Text
                </button>
              </div>
            </div>
            <div className="relative flex flex-col h-full w-full">
              <textarea
                id="input"
                className="w-full min-h-[400px] lg:min-h-[450px] flex-1 resize-none outline-none focus:outline-none bg-screen p-6 rounded-xl shadow-textarea text-[18px] md:text-[16px] leading-relaxed"
                value={input}
                onChange={({ target }) => {
                  const nextValue = target.value.slice(0, 5000);
                  appStore.setState((draft) => {
                    draft.input = nextValue;
                    draft.latestAudioUrl = null;
                    draft.latestAudioBlobUrl = null;
                  });
                  if (importedParts) {
                    setImportedParts((prev) => {
                      if (!prev) return prev;
                      const next = [...prev];
                      next[activePartIndex] = nextValue;
                      return next;
                    });
                  }
                }}
                placeholder="Enter text to generate speech…"
                maxLength={5000}
              />
            </div>


            {/* Controls */}
            <div className="mt-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <label className="text-xs text-muted-foreground flex flex-col gap-1.5 md:col-span-3">
                  Tone
                  <select
                    value={tone}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const next =
                        raw === "calm" ||
                        raw === "serious" ||
                        raw === "cheerful" ||
                        raw === "excited" ||
                        raw === "surprised"
                          ? raw
                          : "neutral";
                      appStore.setState((draft) => {
                        draft.tone = next;
                        draft.latestAudioUrl = null;
                        draft.latestAudioBlobUrl = null;
                      });
                    }}
                    className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  >
                    <option value="neutral">Neutral</option>
                    <option value="calm">Calm</option>
                    <option value="serious">Serious</option>
                    <option value="cheerful">Cheerful</option>
                    <option value="excited">Excited</option>
                    <option value="surprised">Surprised</option>
                  </select>
                </label>

                <label className="text-xs text-muted-foreground flex flex-col gap-1.5 md:col-span-3">
                  Speed
                  <select
                    value={speakingRateMode}
                    onChange={(e) => {
                      const next = e.target.value === "custom" ? "custom" : "auto";
                      appStore.setState((draft) => {
                        draft.speakingRateMode = next;
                        draft.latestAudioUrl = null;
                        draft.latestAudioBlobUrl = null;
                      });
                    }}
                    className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  >
                    <option value="auto">Auto</option>
                    <option value="custom">Custom</option>
                  </select>
                </label>

                {speakingRateMode === "custom" ? (
                  <label className="text-xs text-muted-foreground flex flex-col gap-1.5 md:col-span-6">
                    <div className="flex justify-between">
                      <span>Rate</span>
                      <span className="font-mono text-foreground">{speakingRate.toFixed(2)}x</span>
                    </div>
                    <input
                      type="range"
                      min={0.25}
                      max={4}
                      step={0.05}
                      value={speakingRate}
                      onChange={(e) => {
                        const next = Math.max(0.25, Math.min(4, Number(e.target.value) || 1));
                        appStore.setState((draft) => {
                          draft.speakingRate = next;
                          draft.latestAudioUrl = null;
                          draft.latestAudioBlobUrl = null;
                        });
                      }}
                      className="w-full mt-1.5"
                    />
                  </label>
                ) : null}

                <label className="text-xs text-muted-foreground flex flex-col gap-1.5 md:col-span-6">
                  <div className="flex justify-between">
                    <span>Playback</span>
                    <span className="font-mono text-foreground">{playbackRate.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={4}
                    step={0.05}
                    value={playbackRate}
                    onChange={(e) => {
                      const next = Math.max(0.25, Math.min(4, Number(e.target.value) || 1));
                      appStore.setState((draft) => {
                        draft.playbackRate = next;
                      });
                    }}
                    className="w-full mt-1.5"
                  />
                  <div className="text-[11px] leading-4 text-muted-foreground">
                    只影响播放倍速（更接近严格倍速），不会重新生成音频，也不会增加合成用量。
                  </div>
                </label>

                <label className="text-xs text-muted-foreground flex flex-col gap-1.5 md:col-span-6">
                  <div className="flex justify-between">
                    <span>Volume</span>
                    <span className="font-mono text-foreground">{volumeGainDb > 0 ? `+${volumeGainDb}` : volumeGainDb}dB</span>
                  </div>
                  <input
                    type="range"
                    min={-10}
                    max={10}
                    step={1}
                    value={volumeGainDb}
                    onChange={(e) => {
                      const next = Math.max(-96, Math.min(16, Math.round(Number(e.target.value) || 0)));
                      appStore.setState((draft) => {
                        draft.volumeGainDb = next;
                        draft.latestAudioUrl = null;
                        draft.latestAudioBlobUrl = null;
                      });
                    }}
                    className="w-full mt-1.5"
                  />
                </label>
              </div>

              {speakingRateMode === "custom" ? (
                <div className="rounded-xl border border-border bg-background/60 p-4 text-[11px] leading-4 text-muted-foreground">
                  <div className="font-medium text-foreground/80">为什么体感可能不像 4x？</div>
                  <ul className="mt-2 list-disc pl-4 space-y-1">
                    <li>
                      它是“相对语速/韵律目标”：Google 会重新合成语音（不是把音频简单时间拉伸），为了可懂度/自然度会做限制，所以体感不一定线性。
                    </li>
                    <li>
                      停顿不一定等比例缩短：句号/逗号/换行带来的停顿、强调、断句有一部分是“固定成本”，即使你提速，停顿可能缩得没那么多，整体听感就不像 4x。
                    </li>
                    <li>
                      不同 voice 的响应差异很大：尤其像 Chirp3‑HD（Despina）这类，模型会更“稳”，提速更保守，实际提升幅度可能明显小于你预期。
                    </li>
                    <li>如果你想要更快的语速，可以改用上面的 Playback（播放倍速）。</li>
                  </ul>
                </div>
              ) : null}

		              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between pt-4 border-t border-border/50">
		                <div className="text-[11px] text-muted-foreground italic">
		                  Tip: switching Language auto-picks a safe default; click a card to pin a voice for that language.
		                </div>
		                <div className="flex flex-row gap-3 w-full sm:w-auto">
		                  <ShareButton />
		                  <div className="flex-1 sm:min-w-[120px]">
		                    <PlayButton />
		                  </div>
		                </div>
		              </div>
	            </div>
	          </Block>
	        </div>

        {/* Right Column: Voice Selection Only (1/2 Width) */}
        <div className="lg:flex-[1_1_0%] flex flex-col min-w-0 h-full">
          <Block title="Select a voice">
            <div className="flex flex-col h-full">
              <div className="flex-1 overflow-hidden flex flex-col min-h-[400px] lg:min-h-[600px]">
                <GoogleVoicePicker />
              </div>
	            </div>
	          </Block>
	        </div>
	      </div>

	      {/* Full-width history (spans both columns) */}
	      <div className="mt-6">
	        <Block title="Generated History">
	          <div className="flex items-center justify-end mb-3">
	            <div className="flex items-center gap-3">
	              {historyPolicy && historyUsage ? (
	                <span className="text-xs text-muted-foreground">
	                  {historyUsage.totalItems}/{historyPolicy.maxItems} · {formatBytes(historyUsage.totalBytes)}/
	                  {formatBytes(historyPolicy.maxTotalBytes)}
	                </span>
	              ) : (
	                <span className="text-xs text-muted-foreground">{ttsHistory.length}</span>
	              )}
	              {ttsHistory.length > 0 ? (
	                <button
	                  type="button"
	                  onClick={handleClearHistory}
	                  className="text-xs font-medium text-muted-foreground hover:text-foreground underline underline-offset-4"
	                >
	                  Clear
	                </button>
	              ) : null}
	            </div>
	          </div>

	          <div className="mb-3 text-xs text-muted-foreground">
	            Auto retention: keep the latest {historyPolicy?.maxItems ?? 20} items and only the last{" "}
	            {historyPolicy?.maxDays ?? 7} days. If exceeded, older items are deleted automatically. Storage quota:{" "}
	            {historyPolicy ? formatBytes(historyPolicy.maxTotalBytes) : "50 MB"}; if exceeded, generation is blocked until you delete.
	          </div>

	          {historyLoading ? (
              <div className="grid w-full grid-cols-1 md:grid-cols-2 gap-3">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div
                    key={`history-skel-${idx}`}
                    className="rounded-xl border border-border bg-background/60 p-4 flex flex-col gap-3 h-full"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 space-y-2">
                        <Skeleton className="h-4 w-44" />
                        <Skeleton className="h-3 w-28" />
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Skeleton className="h-3 w-14" />
                        <Skeleton className="h-3 w-12" />
                        <Skeleton className="h-8 w-8 rounded-full" />
                      </div>
                    </div>
                    <Skeleton className="h-10 w-full rounded-full" />
                  </div>
                ))}
              </div>
	          ) : historyError ? (
	            <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
	              {historyError}
	            </div>
		          ) : ttsHistory.length === 0 ? (
		            <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
		              No audio yet. Click <span className="font-medium text-foreground">Generate</span> to create your first MP3.
		            </div>
		          ) : (
		            <div className="space-y-4">
		              <div className="grid w-full grid-cols-1 md:grid-cols-2 gap-3">
		                {historyPagedItems.map((item) => (
		                  <div
		                    key={item.id}
		                    className="rounded-xl border border-border bg-background/60 p-4 flex flex-col gap-3 h-full"
		                  >
		                    <div className="flex items-center justify-between gap-3">
		                      <div className="min-w-0">
		                        <div className="text-sm font-medium text-foreground truncate">
		                          {item.voice} · {item.tone}
		                        </div>
		                        <div className="text-xs text-muted-foreground">
		                          {new Date(item.createdAt).toLocaleString()}
		                        </div>
		                    </div>
		                      <div className="flex items-center gap-3 shrink-0">
			                        <a
			                          className="text-xs font-medium text-primary underline underline-offset-4"
			                          href={item.audioUrl}
			                          download={safeDownloadName(item.voice)}
			                        >
			                          Download
			                        </a>
		                        <button
		                          type="button"
		                          className="text-xs font-medium text-muted-foreground hover:text-foreground underline underline-offset-4"
		                          onClick={() => handleDeleteHistoryItem(item.id)}
		                        >
		                          Delete
		                        </button>
		                        <ShareButton generationId={item.id} />
		                      </div>
		                    </div>
		                    <HistoryAudioPlayer src={item.audioUrl} />
		                  </div>
		                ))}
		              </div>

			              {historyTotalPages > 1 ? (
			                <div className="flex items-center justify-center gap-2">
			                  {Array.from({ length: historyTotalPages }).map((_, idx) => {
			                    const pageNum = idx + 1;
			                    const active = pageNum === historyPageClamped;
			                    return (
			                      <button
		                        key={`generated-history-page-${pageNum}`}
		                        type="button"
		                        onClick={() => setHistoryPage(pageNum)}
		                        aria-current={active ? "page" : undefined}
		                        className={clsx(
		                          "h-9 min-w-9 px-3 rounded-full border text-sm font-medium transition-colors",
		                          active
		                            ? "border-foreground/30 bg-foreground/10 text-foreground"
		                            : "border-border bg-muted/10 text-muted-foreground hover:bg-muted/20 hover:text-foreground",
		                        )}
		                      >
		                        {pageNum}
		                      </button>
		                    );
		                  })}
		                </div>
		              ) : null}
		            </div>
		          )}
		        </Block>
		      </div>
    </div>
  );
};

const CloningBoard = ({ onGoToTts }: { onGoToTts: () => void }) => {
  return <VoiceCloningClient onGoToTts={onGoToTts} />;
};

const HistoryBoard = () => {
  const [items, setItems] = useState<
    Array<{
      id: string;
      createdAt: string;
      voice: string;
      tone: string;
      input: string;
      audioUrl: string;
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

  const safeDownloadName = (voice: string) => {
    const safe = voice.replace(/[^\w\-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "voice";
    return `voiceslab-${safe}.mp3`;
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
        items: Array<{ id: string; createdAt: string; voice: string; tone: string; input: string; audioUrl: string }>;
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
    if (!confirm("Delete this audio?")) return;
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
        <h1 className="text-3xl font-bold">Audio Generation History</h1>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-border bg-muted/20 px-4 py-2 text-sm font-medium hover:bg-muted/30 disabled:opacity-60"
        >
          <Refresh className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="mt-6 rounded-3xl border border-border bg-background/40 p-6">
        <div className="text-sm text-muted-foreground italic">
          Note: Audio files are retained for {noteDays} day(s), and only the latest {policy?.maxItems ?? 20} items are kept.
        </div>
        <div className="mt-2 text-sm text-muted-foreground">
          {selectedCount} of {items.length} row(s) selected on this page. Total: {totalCount}.
          {usage && policy ? (
            <span className="ml-3">
              {usage.totalItems}/{policy.maxItems} · {formatBytes(usage.totalBytes)}/{formatBytes(policy.maxTotalBytes)}
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
                    aria-label="Select all"
                  />
                </th>
                <th className="px-4 py-3 border-y border-border bg-muted/20">Text</th>
                <th className="px-4 py-3 border-y border-border bg-muted/20">Voice</th>
                <th className="px-4 py-3 border-y border-border bg-muted/20">Created At</th>
                <th className="px-4 py-3 border-y border-border bg-muted/20">Audio</th>
                <th className="px-4 py-3 border-y border-border bg-muted/20">Actions</th>
                <th className="w-20 px-4 py-3 border-y border-border bg-muted/20 rounded-r-2xl text-right">
                  <span className="sr-only">Delete</span>
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
                    No history yet. Generate audio from the Text to Speech page.
                  </td>
                </tr>
              ) : (
                items.map((it, idx) => {
                  const checked = selectedIds.has(it.id);
                  const isLast = idx === items.length - 1;
                  const borderClass = isLast ? "border-b border-border" : "border-b border-border/50";
                  const displayVoice =
                    cloneNameByVoiceId[it.voice] ||
                    (it.voice === "mic-recording" ? "Record your audio" : it.voice);
                  const textPreview = (it.input || "").trim();
                  const textShort = textPreview.length > 40 ? `${textPreview.slice(0, 40)}…` : textPreview;
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
                        <span title={textPreview}>{textShort || "—"}</span>
                      </td>
                      <td className={`px-4 py-4 ${borderClass} text-sm text-muted-foreground`}>
                        <span title={it.voice}>{displayVoice}</span>
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
                          download={safeDownloadName(it.voice)}
                          className="inline-flex items-center justify-center rounded-lg border border-border bg-muted/10 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/20 hover:text-foreground"
                        >
                          Download
                        </a>
                      </td>
                      <td className={`px-4 py-4 ${borderClass} text-right`}>
                        <button
                          type="button"
                          onClick={() => handleDelete(it.id)}
                          className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                        >
                          Delete
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
