"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { appStore } from "@/lib/store";
import { defaultLocale, locales, type Locale } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Check } from "@/components/ui/Icons";
import { Skeleton } from "@/components/ui/skeleton";

const avatarCache = new Map<string, string>();

type VoicesResponse = {
  lang: string;
  q?: string;
  count: number;
  voices: Array<{
    name: string;
    languageCodes: string[];
    ssmlGender?: string;
    naturalSampleRateHertz?: number | null;
    billingTier: string;
    billingTierSource?: "name" | "heuristic";
  }>;
};

type MetaResponse = {
  provider: "openai" | "google";
  voiceInput?: string;
  voiceName?: string;
  languageCode?: string;
  billingTier?: string;
};

type LanguagesResponse = {
  count: number;
  languages: string[];
};

type PublicVoiceTier = "all" | "standard" | "wavenet" | "neural2" | "chirp3-hd" | "studio";

function PremiumCrownIcon({ className }: { className?: string }) {
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
    >
      <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
      <path d="M5 21h14" />
    </svg>
  );
}

function localeFromPathname(pathname: string): Locale {
  const pathSegments = pathname.split("/").filter(Boolean);
  if (pathSegments.length > 0 && locales.includes(pathSegments[0] as Locale)) {
    return pathSegments[0] as Locale;
  }
  return defaultLocale;
}

function voiceDisplayName(voiceName: string): string {
  // Examples:
  // - en-US-Wavenet-F -> Wavenet F
  // - en-US-Standard-C -> Standard C
  // - en-US-Studio-O -> Studio O
  // - en-US-Chirp3-HD-Umbriel -> Umbriel
  // - Achernar (alias) -> Achernar
  const parts = voiceName.split("-");
  const looksLikeLangPrefix = parts.length >= 3 && parts[0]?.length === 2 && parts[1]?.length === 2;
  const withoutLang = looksLikeLangPrefix ? parts.slice(2).join("-") : voiceName;

  const chirpPrefix = "Chirp3-HD-";
  const idx = withoutLang.indexOf(chirpPrefix);
  if (idx >= 0) {
    const after = withoutLang.slice(idx + chirpPrefix.length);
    if (after) return after.replace(/-/g, " ");
  }

  return withoutLang.replace(/-/g, " ");
}

function languageDisplayName(lang: string): string {
  const code = lang.split("-")[0] || lang;
  try {
    const dn = new Intl.DisplayNames(["en"], { type: "language" });
    const name = dn.of(code);
    if (typeof name === "string" && name.trim()) return name;
  } catch {
    // ignore
  }
  return lang;
}

function voiceAvatarAlt(voiceName: string): string {
  const display = voiceDisplayName(voiceName);
  const first = display.trim().slice(0, 1).toUpperCase();
  return first || "V";
}

function hashString(input: string): number {
  // Simple stable 32-bit hash (FNV-1a style)
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function base64EncodeUtf8(input: string): string {
  // btoa only supports latin-1; encode as UTF-8 first.
  return btoa(unescape(encodeURIComponent(input)));
}

function avatarDataUriForVoice(voiceName: string): string {
  const cached = avatarCache.get(voiceName);
  if (cached) return cached;

  const hash = hashString(voiceName);
  const hue1 = hash % 360;
  const hue2 = (hue1 + 45 + ((hash >>> 8) % 90)) % 360;
  const initial = voiceAvatarAlt(voiceName);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${hue1} 80% 55%)"/>
      <stop offset="100%" stop-color="hsl(${hue2} 80% 45%)"/>
    </linearGradient>
  </defs>
  <circle cx="40" cy="40" r="40" fill="url(#g)"/>
  <circle cx="40" cy="40" r="39" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="2"/>
  <text x="40" y="46" text-anchor="middle" font-size="34" font-family="ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto" font-weight="700" fill="rgba(255,255,255,0.92)">${initial}</text>
</svg>`;

  const uri = `data:image/svg+xml;base64,${base64EncodeUtf8(svg)}`;
  avatarCache.set(voiceName, uri);
  return uri;
}

function languageOptionLabel(tag: string, uiLocale: string): string {
  const [rawLang, rawRegion] = tag.split("-");
  const lang = rawLang || tag;
  const region = rawRegion && /^[A-Z]{2}$/.test(rawRegion) ? rawRegion : undefined;

  const specialLang: Record<string, string> = {
    cmn: uiLocale.startsWith("zh") ? "中文" : "Chinese",
    yue: uiLocale.startsWith("zh") ? "粤语" : "Cantonese",
  };

  let langName = specialLang[lang];
  if (!langName) {
    try {
      const dnLang = new Intl.DisplayNames([uiLocale], { type: "language" });
      langName = dnLang.of(lang) ?? lang;
    } catch {
      langName = lang;
    }
  }

  if (!region) return `${langName} · ${tag}`;

  try {
    const dnRegion = new Intl.DisplayNames([uiLocale], { type: "region" });
    const regionName = dnRegion.of(region);
    if (regionName) return `${langName}（${regionName}） · ${tag}`;
  } catch {
    // ignore
  }

  return `${langName} (${region}) · ${tag}`;
}

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function normalizeLang(value: string): string {
  const v = value.trim();
  if (!v) return "en-US";
  return v.slice(0, 32);
}

function voiceLanguageFromName(voiceName: string): string | null {
  const parts = voiceName.split("-");
  if (parts.length < 2) return null;
  if (parts[0]?.length !== 2 || parts[1]?.length !== 2) return null;
  return `${parts[0]}-${parts[1]}`;
}

function pickDefaultVoice(
  voices: VoicesResponse["voices"],
): VoicesResponse["voices"][number] | undefined {
  const tierOrder: Array<VoicesResponse["voices"][number]["billingTier"]> = [
    "standard",
    "wavenet",
    "neural2",
    "studio",
    "chirp3-hd",
  ];

  for (const tier of tierOrder) {
    const found = voices.find((v) => v.billingTier === tier);
    if (found) return found;
  }
  return voices[0];
}

function pickDefaultVoiceForTier(
  voices: VoicesResponse["voices"],
  tier: PublicVoiceTier | null,
): VoicesResponse["voices"][number] | undefined {
  if (!tier || tier === "all") return pickDefaultVoice(voices);
  const inTier = voices.filter((v) => v.billingTier === tier);
  return inTier[0] ?? pickDefaultVoice(voices);
}

export default function GoogleVoicePicker() {
  const isVoiceCloningUiEnabled = process.env.NEXT_PUBLIC_VOICE_CLONING_ENABLED === "1";
  const router = useRouter();
  const pathname = usePathname();

  const currentVoice = appStore.useState((s) => s.voice);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [selectedMeta, setSelectedMeta] = useState<MetaResponse | null>(null);
  const uiLocale = useMemo(() => (typeof navigator === "undefined" ? "en" : navigator.language || "en"), []);
  const [isPaidMember, setIsPaidMember] = useState<boolean | null>(null);

  const [clones, setClones] = useState<
    Array<{
      id: string;
      name: string;
      status: string;
      provider: string;
      languageCode?: string;
      modelName?: string | null;
      isDefault: boolean;
    }>
  >([]);
  const [clonesError, setClonesError] = useState<string | null>(null);
  const [clonesLoading, setClonesLoading] = useState(false);

  const [voiceSource, setVoiceSource] = useState<"public" | "private">("public");
  const [publicTier, setPublicTier] = useState<PublicVoiceTier | null>(null);

  const [lang, setLang] = useState("en-US");
  const [query, setQuery] = useState("");
  const debouncedLang = useDebounced(lang, 250);
  const debouncedQuery = useDebounced(query, 250);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voices, setVoices] = useState<VoicesResponse["voices"]>([]);
  const [languages, setLanguages] = useState<LanguagesResponse | null>(null);
  const [manualVoiceByLang, setManualVoiceByLang] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    fetch("/api/membership/status", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        setIsPaidMember(Boolean(data?.data?.isPaid));
      })
      .catch(() => {
        if (cancelled) return;
        setIsPaidMember(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    fetch("/api/tts/meta?voice=en-US-Standard-C&format=mp3")
      .then((res) => (res.ok ? (res.json() as Promise<MetaResponse>) : null))
      .then((meta) => setEnabled(meta?.provider === "google"))
      .catch(() => setEnabled(false));
  }, []);

  useEffect(() => {
    if (enabled === false && (clones.length > 0 || clonesLoading)) {
      setVoiceSource("private");
    }
  }, [enabled, clones.length, clonesLoading]);

  useEffect(() => {
    if (!isVoiceCloningUiEnabled) {
      setClones([]);
      setClonesError(null);
      setClonesLoading(false);
      return;
    }
    let cancelled = false;
    setClonesLoading(true);
    setClonesError(null);
    fetch("/api/voice-clone", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 401) return null;
          if (res.status === 501) {
            const text = await res.text().catch(() => "");
            throw new Error(text || "Voice cloning is not enabled.");
          }
          throw new Error(await res.text().catch(() => "Failed to load cloned voices"));
        }
        return (await res.json()) as { clones: typeof clones; maxClones: number };
      })
      .then((data) => {
        if (cancelled) return;
        setClones((data?.clones ?? []).filter((c) => c.status === "ready"));
      })
      .catch((err) => {
        if (cancelled) return;
        setClones([]);
        setClonesError(err instanceof Error ? err.message : "Failed to load cloned voices");
      })
      .finally(() => {
        if (cancelled) return;
        setClonesLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVoiceCloningUiEnabled]);

  useEffect(() => {
    if (enabled !== true) return;
    const inferred = voiceLanguageFromName(appStore.getState().voice);
    if (inferred && lang === "en-US") setLang(inferred);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  useEffect(() => {
    // Changing the language should not keep an old search filter, otherwise auto-pick becomes confusing.
    setQuery("");
  }, [lang]);

  useEffect(() => {
    if (enabled !== true) return;
    const controller = new AbortController();
    fetch("/api/tts/languages", { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<LanguagesResponse>) : null))
      .then((data) => setLanguages(data))
      .catch(() => setLanguages(null));
    return () => controller.abort();
  }, [enabled]);

  useEffect(() => {
    if (enabled !== true) return;
    const controller = new AbortController();
    fetch(`/api/tts/meta?voice=${encodeURIComponent(currentVoice)}&format=mp3`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? (res.json() as Promise<MetaResponse>) : null))
      .then((meta) => setSelectedMeta(meta))
      .catch(() => setSelectedMeta(null));
    return () => controller.abort();
  }, [enabled, currentVoice]);

  const resolvedLang = useMemo(() => normalizeLang(debouncedLang), [debouncedLang]);
  const isAutoMode = !manualVoiceByLang[resolvedLang];

  const limitedVoices = useMemo(
    () => {
      if (!publicTier) return [];
      if (publicTier === "all") return voices;
      return voices.filter((v) => v.billingTier === publicTier);
    },
    [voices, publicTier],
  );
  const tierCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of voices) {
      counts.set(v.billingTier, (counts.get(v.billingTier) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [voices]);

  useEffect(() => {
    if (enabled !== true) return;
    if (voiceSource !== "public") return;
    if (!publicTier) {
      setLoading(false);
      setError(null);
      setVoices([]);
      return;
    }
    const controller = new AbortController();
    Promise.resolve().then(() => {
      setLoading(true);
      setError(null);
    });

    const url = new URL("/api/tts/voices", window.location.origin);
    url.searchParams.set("lang", resolvedLang);
    if (debouncedQuery.trim()) url.searchParams.set("q", debouncedQuery.trim());

    fetch(url.toString(), { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return (await res.json()) as VoicesResponse;
      })
      .then((data) => {
        const list = (data.voices ?? []).filter((v) => v.billingTier !== "unknown");
        setVoices(list);

        const current = appStore.getState().voice;
        const manual = manualVoiceByLang[resolvedLang];
        const hasVoice = (name: string) => list.some((v) => v.name === name);

        // If the user has a manual pick for this language, prefer it.
        if (manual && hasVoice(manual) && manual !== current) {
          setVoice(manual);
          return;
        }

        // Otherwise, keep current voice if it's valid for the selected language.
        if (hasVoice(current)) return;

        // Fallback to a safe default voice for the selected language.
        const picked = pickDefaultVoiceForTier(list, publicTier);
        if (picked?.name) setVoice(picked.name);
      })
      .catch((err) => {
        if ((err as { name?: string }).name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load voices");
        setVoices([]);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [enabled, resolvedLang, debouncedQuery, voiceSource, publicTier]);

  const setVoice = (voiceName: string) => {
    appStore.setState((draft) => {
      draft.voice = voiceName;
      draft.latestAudioUrl = null;
      draft.latestAudioBlobUrl = null;
    });
  };

  const currentClone = useMemo(() => {
    const prefix = "clone:";
    if (!currentVoice.startsWith(prefix)) return null;
    const cloneId = currentVoice.slice(prefix.length);
    return clones.find((c) => c.id === cloneId) ?? null;
  }, [clones, currentVoice]);

  const shouldRenderAnything =
    enabled !== false || (isVoiceCloningUiEnabled && (clones.length > 0 || !!clonesError));
  if (!shouldRenderAnything) return null;

  const hasPublicVoices = enabled !== false;

  const pricingHref = useMemo(() => {
    const locale = localeFromPathname(pathname || "");
    return `/${locale}/pricing`;
  }, [pathname]);

  const premiumLocked = isPaidMember !== true;

  return (
    <div className="mt-3 flex flex-col h-full min-h-0">
      <div className="mb-3 flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setVoiceSource("public")}
          className={[
            "inline-flex h-9 items-center rounded-full border px-4 text-sm transition-colors",
            voiceSource === "public"
              ? "border-foreground/40 bg-foreground/10 text-foreground"
              : "border-border bg-muted/10 text-muted-foreground hover:bg-muted/20 hover:text-foreground",
          ].join(" ")}
          aria-pressed={voiceSource === "public"}
          disabled={!hasPublicVoices}
        >
          Public voices
        </button>
        <button
          type="button"
          onClick={() => setVoiceSource("private")}
          className={[
            "inline-flex h-9 items-center rounded-full border px-4 text-sm transition-colors",
            voiceSource === "private"
              ? "border-foreground/40 bg-foreground/10 text-foreground"
              : "border-border bg-muted/10 text-muted-foreground hover:bg-muted/20 hover:text-foreground",
          ].join(" ")}
          aria-pressed={voiceSource === "private"}
        >
          Private voices
        </button>
      </div>

      {voiceSource === "public" && enabled === null && clones.length === 0 && !clonesError ? (
        <div className="flex flex-col gap-3 shrink-0">
          <div className="flex flex-col gap-2">
            <div className="text-xs text-muted-foreground">Language</div>
            <Skeleton className="h-9 w-full rounded-xl" />
            <div className="text-xs text-muted-foreground">Search</div>
            <Skeleton className="h-9 w-full rounded-xl" />
          </div>
          <Skeleton className="h-9 w-full rounded-xl" />
          <div className="mt-3 flex-1 min-h-0 max-h-[500px] overflow-y-auto rounded-xl border border-border bg-muted/20 shadow-inner">
            <div className="p-3 grid grid-cols-3 gap-2">
              {Array.from({ length: 12 }).map((_, idx) => (
                <div
                  key={`voice-init-skeleton-${idx}`}
                  className="w-full flex flex-col items-center gap-2 rounded-lg p-2"
                >
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {voiceSource === "private" ? (
        clonesLoading && clones.length === 0 && !clonesError ? (
          <div className="rounded-xl border border-border bg-muted/20 shadow-inner p-3 mb-3 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-muted-foreground">Private voices</div>
              <div className="text-[11px] text-muted-foreground">Loading…</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={`private-voice-skeleton-${idx}`}
                  className="w-full rounded-lg border border-border bg-background/60 px-3 py-2"
                >
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="mt-2 h-3 w-20 opacity-70" />
                </div>
              ))}
            </div>
          </div>
        ) : clones.length > 0 ? (
          <div className="rounded-xl border border-border bg-muted/20 shadow-inner p-3 mb-3 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-muted-foreground">Private voices</div>
              <div className="text-[11px] text-muted-foreground">
                {clones.length}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {clones.slice(0, 6).map((c) => {
                const selected = currentClone?.id === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={[
                      "w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                      selected
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border bg-background/60 text-muted-foreground hover:text-foreground hover:bg-background/80",
                    ].join(" ")}
                    onClick={() => setVoice(`clone:${c.id}`)}
                    title={c.languageCode || undefined}
                  >
                    <div className="font-medium truncate">{c.name}</div>
                    <div className="text-[10px] opacity-70 truncate">
                      {c.isDefault ? "Default" : "Cloned voice"} · {c.provider}
                    </div>
                  </button>
                );
              })}
            </div>
            {clonesError ? (
              <div className="mt-2 text-xs text-red-600 whitespace-pre-wrap">{clonesError}</div>
            ) : null}
          </div>
        ) : clonesError ? (
          <div className="rounded-xl border border-border bg-muted/20 shadow-inner p-3 mb-3 shrink-0">
            <div className="text-xs text-muted-foreground">Private voices</div>
            <div className="mt-1 text-xs text-red-600 whitespace-pre-wrap">{clonesError}</div>
          </div>
        ) : null
      ) : null}

      {voiceSource === "public" ? (
        enabled ? (
          <div className="flex flex-col gap-3 shrink-0">
            <div className="flex flex-col gap-2">
              <label className="text-xs text-muted-foreground">
                Language{languages?.count ? ` (${languages.count})` : ""}
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
                >
                  {(languages?.languages?.length ? languages.languages : [lang]).map((code) => (
                    <option key={code} value={code}>
                      {languageOptionLabel(code, uiLocale)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-row gap-2">
                <label className="text-xs text-muted-foreground flex-1">
                  Search
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
                    placeholder="wavenet / studio / chirp"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-muted/20 shadow-inner p-3">
              <div className="text-xs font-medium text-foreground/80">Voice categories</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  { id: "standard", label: "standard", premium: false },
                  { id: "wavenet", label: "wavenet", premium: true },
                  { id: "neural2", label: "Neural2", premium: true },
                  { id: "chirp3-hd", label: "Chirp3-HD", premium: true },
                  { id: "studio", label: "studio", premium: true },
                  { id: "all", label: "All", premium: true },
                ].map((t) => {
                  const isSelected = publicTier === (t.id as PublicVoiceTier);
                  const disabled = !hasPublicVoices;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        if (t.premium && premiumLocked) {
                          router.push(pricingHref);
                          return;
                        }
                        setPublicTier(t.id as PublicVoiceTier);
                      }}
                      className={[
                        "inline-flex h-9 items-center gap-2 rounded-full border px-4 text-sm transition-colors",
                        disabled ? "opacity-60 cursor-not-allowed" : "",
                        isSelected
                          ? "border-foreground/40 bg-foreground/10 text-foreground"
                          : "border-border bg-background/60 text-muted-foreground hover:bg-background/80 hover:text-foreground",
                      ].join(" ")}
                      aria-pressed={isSelected}
                      title={t.premium && premiumLocked ? "Paid members only" : undefined}
                    >
                      {t.premium ? <PremiumCrownIcon className="h-4 w-4" /> : null}
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer select-none text-xs text-muted-foreground hover:text-foreground">
                  查看价格/档位说明
                </summary>
                <div className="mt-2 text-[11px] leading-4 text-muted-foreground">
                  <ul className="space-y-1">
                    <li>
                      <span className="font-mono text-foreground/80">standard</span>：最基础/最便宜（基准 1x；超出免费额度后按最低单价计费）
                    </li>
                    <li>
                      <span className="font-mono text-foreground/80">wavenet</span>：WaveNet 系列（约 4x standard）
                    </li>
                    <li>
                      <span className="font-mono text-foreground/80">Neural2</span>：新一代神经网络声音系列（通常质量更好、也通常更贵；默认按约 4x standard 预算）
                    </li>
                    <li>
                      <span className="font-mono text-foreground/80">Chirp3-HD</span>：更高质量的 Chirp3‑HD 系列（约 7.5x standard）
                    </li>
                    <li>
                      <span className="font-mono text-foreground/80">studio</span>：Studio 系列（约 40x standard）
                    </li>
                    <li>
                      <span className="font-mono text-foreground/80">All</span>：显示当前语言下所有可用声音（包含更贵的 tier）
                    </li>
                    <li className="pt-1">
                      价格基于 Google Cloud Text-to-Speech 官方价目表（按超出免费额度后的每 100 万字符，HKD 口径；standard≈31.1、wavenet≈124.4→4x、chirp3‑hd≈233.2→7.5x、studio≈1243.9→40x）。
                    </li>
                  </ul>
                </div>
              </details>
            </div>

            <Button
              variant={isAutoMode ? "default" : "outline"}
              onClick={() => {
                setManualVoiceByLang((prev) => {
                  if (!prev[resolvedLang]) return prev;
                  const next = { ...prev };
                  delete next[resolvedLang];
                  return next;
                });
                const picked = pickDefaultVoiceForTier(voices, publicTier);
                if (picked?.name) setVoice(picked.name);
              }}
              className="w-full justify-center"
              disabled={!publicTier}
            >
              <span className="relative inline-flex items-center">{publicTier ? "Auto pick" : "Pick a category first"}</span>
            </Button>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground mb-2">
            Google voice list is unavailable (TTS provider is not Google). You can still use Private voices above.
          </div>
        )
      ) : null}

      <div className="mt-2 text-xs text-muted-foreground shrink-0">
        Current voice:{" "}
        <span className="font-mono text-foreground">
          {currentClone ? `${currentClone.name} (cloned)` : currentVoice}
        </span>
        {selectedMeta?.billingTier ? (
          <>
            {" "}
            · Tier: <span className="font-mono text-foreground">{selectedMeta.billingTier}</span>
          </>
        ) : null}
        {selectedMeta?.voiceName && selectedMeta.voiceName !== currentVoice ? (
          <>
            {" "}
            · Resolved: <span className="font-mono text-foreground">{selectedMeta.voiceName}</span>
          </>
      ) : null}
      </div>
      {voiceSource === "public" && enabled ? (
        <>
          <div className="mt-1 text-xs text-muted-foreground shrink-0">
            {publicTier ? (
              <>
                Found <span className="font-mono text-foreground">{limitedVoices.length}</span> voices{" "}
                {publicTier === "all" ? (
                  <>
                    in <span className="font-mono text-foreground">All</span>.{" "}
                  </>
                ) : (
                  <>
                    in <span className="font-mono text-foreground">{publicTier}</span>.{" "}
                  </>
                )}
              </>
            ) : (
              <>Pick a category above to load voices.{" "}</>
            )}
            {tierCounts.length > 0 && (
              <>
                Tiers:{" "}
                {tierCounts
                  .slice(0, 6)
                  .map(([tier, count]) => `${tier} ${count}`)
                  .join(", ")}
                {tierCounts.length > 6 ? "…" : ""}.
              </>
            )}
          </div>

          <div className="mt-3 flex-1 min-h-0 max-h-[500px] overflow-y-auto rounded-xl border border-border bg-muted/20 shadow-inner">
            {!publicTier ? (
              <div className="p-6 text-sm text-muted-foreground text-center">Select a category (tier) above to show voices.</div>
            ) : loading ? (
              <div className="p-3 grid grid-cols-3 gap-2">
                {Array.from({ length: 12 }).map((_, idx) => (
                  <div
                    key={`voice-skeleton-${idx}`}
                    className="w-full flex flex-col items-center gap-2 rounded-lg p-2"
                  >
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="p-4 text-sm text-red-600 whitespace-pre-wrap">{error}</div>
            ) : voices.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground text-center">No voices found.</div>
            ) : limitedVoices.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground text-center">
                No voices found for <span className="font-mono text-foreground">{publicTier}</span> in{" "}
                <span className="font-mono text-foreground">{resolvedLang}</span>.
              </div>
            ) : (
              <div className="p-3 grid grid-cols-3 gap-2">
                {limitedVoices.map((v) => {
                  const label = `${v.name} (${v.billingTier}${v.billingTierSource === "heuristic" ? "?" : ""})`;
                  const selected = v.name === currentVoice;
                  const displayName = voiceDisplayName(v.name);
                  return (
                    <button
                      key={v.name}
                      type="button"
                      className={[
                        "group w-full flex flex-col items-center gap-2 rounded-lg p-2 transition-all",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                        selected
                          ? "bg-primary/10 shadow-sm"
                          : "hover:bg-background/80",
                      ].join(" ")}
                      onClick={() => {
                        setManualVoiceByLang((prev) => ({ ...prev, [resolvedLang]: v.name }));
                        setVoice(v.name);
                      }}
                      title={label}
                    >
                      <div
                        className={[
                          "relative shrink-0 rounded-full p-[1px]",
                          selected ? "bg-primary/30" : "bg-transparent",
                        ].join(" ")}
                      >
                        <img
                          src={avatarDataUriForVoice(v.name)}
                          alt={voiceAvatarAlt(v.name)}
                          className="w-10 h-10 rounded-full object-cover bg-muted ring-1 ring-border/50 group-hover:ring-primary/30"
                          onError={(e) => {
                            e.currentTarget.src = "/avatar-placeholder.svg";
                          }}
                        />
                        {selected ? (
                          <span className="absolute -top-1 -right-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background shadow-sm">
                            <Check className="h-2.5 w-2.5" />
                          </span>
                        ) : null}
                      </div>
                      <div className="min-w-0 w-full text-center">
                        <div className={["text-[11px] font-medium leading-tight truncate", selected ? "text-primary" : "text-muted-foreground group-hover:text-foreground"].join(" ")}>
                          {displayName}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
