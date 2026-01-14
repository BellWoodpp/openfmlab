import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { Play } from "./ui/Icons";
import { Button } from "./ui/button";
import { appStore } from "@/lib/store";
import s from "./ui/Footer.module.css";
import { useLocale } from "@/hooks";

const IS_SAFARI = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

const PlayingWaveform = ({
  audioLoaded,
  amplitudeLevels,
}: {
  audioLoaded: boolean;
  amplitudeLevels: number[];
}) => (
  <div className="w-[36px] h-[16px] relative left-[4px]">
    {amplitudeLevels.map((level, idx) => {
      const height = `${Math.min(Math.max(level * 30, 0.2), 1.9) * 100}%`;
      return (
        <div
          key={idx}
          className={`w-[2px] bg-white transition-all duration-150 rounded-[2px] absolute top-1/2 -translate-y-1/2 ${
            audioLoaded ? "opacity-100" : s["animate-wave"]
          }`}
          style={{
            height,
            animationDelay: `${idx * 0.15}s`,
            left: `${idx * 6}px`,
          }}
        />
      );
    })}
  </div>
);

export default function PlayButton() {
  const inputValue = appStore.useState((s) => s.input);
  const playbackRate = appStore.useState((s) => s.playbackRate);
  const { locale } = useLocale();
  const [currentTokens, setCurrentTokens] = useState<number | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const isBusyOrPlaying = audioLoading || isPlaying;
  const [insufficientOpen, setInsufficientOpen] = useState(false);
  const [insufficientInfo, setInsufficientInfo] = useState<{ tokens: number; required: number } | null>(null);
  const [authRequiredOpen, setAuthRequiredOpen] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const requestAbortRef = useRef<AbortController | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [amplitudeLevels, setAmplitudeLevels] = useState<number[]>(
    new Array(5).fill(0)
  );
  const amplitudeIntervalRef = useRef<number | null>(null);
  const useStaticAnimation = IS_SAFARI || IS_IOS;

  useEffect(() => {
    if (!audioRef.current) return;
    const next = Number.isFinite(playbackRate) ? playbackRate : 1;
    audioRef.current.defaultPlaybackRate = next;
    audioRef.current.playbackRate = next;
  }, [playbackRate]);

  useEffect(() => {
    function handleTokensUpdate(event: Event) {
      const nextTokens = (event as CustomEvent<{ tokens?: unknown }>).detail?.tokens;
      if (typeof nextTokens === "number" && Number.isFinite(nextTokens)) {
        setCurrentTokens(nextTokens);
      }
    }

    window.addEventListener("tokens:update", handleTokensUpdate as EventListener);

    fetch("/api/tokens", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const data = (json as { data?: { tokens?: unknown; isAuthenticated?: unknown } } | null)?.data;
        const nextTokens = data?.tokens;
        if (typeof nextTokens === "number" && Number.isFinite(nextTokens)) {
          setCurrentTokens(nextTokens);
        }
        const authed = data?.isAuthenticated;
        if (typeof authed === "boolean") {
          setIsAuthenticated(authed);
        }
      })
      .catch(() => {});

    return () => window.removeEventListener("tokens:update", handleTokensUpdate as EventListener);
  }, []);

  const authCopy = (() => {
    const map: Partial<
      Record<
        string,
        { title: string; description: string; cancel: string; signIn: string; signInHref: string }
      >
    > = {
      en: {
        title: "Sign in required",
        description: "Please sign in to generate audio.",
        cancel: "Cancel",
        signIn: "Sign in",
        signInHref: "/login",
      },
      zh: {
        title: "需要登录",
        description: "请先登录后再使用生成功能。",
        cancel: "取消",
        signIn: "去登录",
        signInHref: "/zh/login",
      },
      ja: {
        title: "ログインが必要です",
        description: "生成機能を使うにはログインしてください。",
        cancel: "キャンセル",
        signIn: "ログイン",
        signInHref: "/ja/login",
      },
      es: {
        title: "Inicio de sesión requerido",
        description: "Inicia sesión para generar audio.",
        cancel: "Cancelar",
        signIn: "Iniciar sesión",
        signInHref: "/es/login",
      },
      ar: {
        title: "تسجيل الدخول مطلوب",
        description: "يرجى تسجيل الدخول لاستخدام ميزة التوليد.",
        cancel: "إلغاء",
        signIn: "تسجيل الدخول",
        signInHref: "/ar/login",
      },
      id: {
        title: "Perlu masuk",
        description: "Silakan masuk untuk membuat audio.",
        cancel: "Batal",
        signIn: "Masuk",
        signInHref: "/id/login",
      },
      pt: {
        title: "Login necessário",
        description: "Faça login para gerar áudio.",
        cancel: "Cancelar",
        signIn: "Entrar",
        signInHref: "/pt/login",
      },
      fr: {
        title: "Connexion requise",
        description: "Connectez-vous pour générer l’audio.",
        cancel: "Annuler",
        signIn: "Se connecter",
        signInHref: "/fr/login",
      },
      ru: {
        title: "Требуется вход",
        description: "Войдите, чтобы генерировать аудио.",
        cancel: "Отмена",
        signIn: "Войти",
        signInHref: "/ru/login",
      },
      de: {
        title: "Anmeldung erforderlich",
        description: "Bitte melde dich an, um Audio zu generieren.",
        cancel: "Abbrechen",
        signIn: "Anmelden",
        signInHref: "/de/login",
      },
    };

    const fallback = map.en!;
    const pick = map[locale] ?? fallback;
    if (locale === "en") return pick;
    // If we don't have a mapping for some locale variant, default to /{locale}/login.
    return {
      ...pick,
      signInHref: pick.signInHref || `/${locale}/login`,
    };
  })();

  const actionCopy = (() => {
    const map: Partial<Record<string, { generate: string; stop: string }>> = {
      en: { generate: "Generate", stop: "Stop" },
      zh: { generate: "生成", stop: "停止" },
      ja: { generate: "生成", stop: "停止" },
      es: { generate: "Generar", stop: "Detener" },
      ar: { generate: "توليد", stop: "إيقاف" },
      id: { generate: "Buat", stop: "Berhenti" },
      pt: { generate: "Gerar", stop: "Parar" },
      fr: { generate: "Générer", stop: "Arrêter" },
      ru: { generate: "Создать", stop: "Остановить" },
      de: { generate: "Generieren", stop: "Stopp" },
    };
    return map[locale] ?? map.en!;
  })();

  const generateRandomAmplitudes = () =>
    Array(5)
      .fill(0)
      .map(() => Math.random() * 0.06);

  const resetPlayback = () => {
    requestAbortRef.current?.abort();
    requestAbortRef.current = null;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (amplitudeIntervalRef.current) {
      clearInterval(amplitudeIntervalRef.current);
      amplitudeIntervalRef.current = null;
    }

    setIsPlaying(false);
    setAudioLoaded(false);
    setAudioLoading(false);
    setStatusText(null);
  };

  const getRequiredTokens = async (input: string, voice: string): Promise<number> => {
    const trimmed = input.trim();
    if (!trimmed) return 0;
    try {
      const url = new URL("/api/tts/cost", window.location.origin);
      url.searchParams.set("voice", voice);
      url.searchParams.set("chars", String(trimmed.length));
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) throw new Error("cost not available");
      const json = (await res.json()) as { data?: unknown };
      const tokenEstimate = (json as { data?: { tokenEstimate?: { tokens?: unknown } } })?.data?.tokenEstimate;
      const tokens = tokenEstimate?.tokens;
      if (typeof tokens === "number" && Number.isFinite(tokens)) return Math.max(1, Math.floor(tokens));
    } catch {
      // ignore
    }
    return Math.max(1, Math.ceil(trimmed.length / 4));
  };

  const handleSubmit = async () => {
    const { input, voice, tone, speakingRateMode, speakingRate, volumeGainDb, customTitleEnabled, customTitle } =
      appStore.getState();
    const requiredTokens = await getRequiredTokens(input, voice);

    if (!input.trim()) {
      alert("Please enter text to generate speech.");
      return;
    }

    // toggle off if already playing
    if (audioRef.current || audioLoading) {
      resetPlayback();
      return;
    }

    if (isAuthenticated === false) {
      setAuthRequiredOpen(true);
      return;
    }

    if (typeof currentTokens === "number" && Number.isFinite(currentTokens) && requiredTokens > currentTokens) {
      setInsufficientInfo({ tokens: currentTokens, required: requiredTokens });
      setInsufficientOpen(true);
      return;
    }

    setAudioLoading(true);
    setStatusText("Step 1/3 · Generating audio…");
    appStore.setState({ latestAudioId: null, latestAudioUrl: null, latestAudioBlobUrl: null });

    try {
      const metaUrl = new URL("/api/tts/meta", window.location.origin);
      metaUrl.searchParams.set("voice", voice);
      metaUrl.searchParams.set("format", "mp3");
      metaUrl.searchParams.set("tone", tone);
      metaUrl.searchParams.set("volumeGainDb", String(volumeGainDb));
      if (speakingRateMode === "custom" && Math.abs(speakingRate - 1) > 1e-6) {
        metaUrl.searchParams.set("speakingRate", String(speakingRate));
      }

      fetch(metaUrl.toString())
        .then((res) => (res.ok ? res.json() : null))
        .then((meta) => {
          if (meta) console.info("[TTS meta]", meta);
        })
        .catch(() => {});

      const controller = new AbortController();
      requestAbortRef.current = controller;
      const res = await fetch("/api/tts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          input,
          voice,
          tone,
          speakingRateMode,
          speakingRate,
          volumeGainDb,
          ...(customTitleEnabled && customTitle.trim() ? { title: customTitle.trim() } : {}),
        }),
      });
      requestAbortRef.current = null;
      if (!res.ok) {
        if (res.status === 401) {
          setAuthRequiredOpen(true);
          setAudioLoading(false);
          setStatusText(null);
          return;
        }
        if (res.status === 402) {
          const details = (await res.json().catch(() => null)) as
            | { message?: string; tokens?: number; required?: number; tokensRemaining?: number }
            | null;
          if (typeof details?.tokens === "number" && Number.isFinite(details.tokens)) {
            window.dispatchEvent(new CustomEvent("tokens:update", { detail: { tokens: details.tokens } }));
          }
          setInsufficientInfo({
            tokens: typeof details?.tokens === "number" && Number.isFinite(details.tokens) ? details.tokens : 0,
            required:
              typeof details?.required === "number" && Number.isFinite(details.required)
                ? details.required
                : 0,
          });
          setInsufficientOpen(true);
          setAudioLoading(false);
          setStatusText(null);
          return;
        }
        if (res.status === 409) {
          const details = await res.json().catch(() => null);
          const message =
            (details && typeof details.error === "string" && details.error) ||
            "Storage quota exceeded. Please delete some history and try again.";
          throw new Error(message);
        }
        const details = await res.text().catch(() => "");
        throw new Error(details || "Error generating audio");
      }

      const data = (await res.json()) as {
        id: string;
        audioUrl: string;
        createdAt?: string | null;
        title?: string | null;
        tokensUsed?: number;
        tokensRemaining?: number | null;
      };
      const audioPath = data.audioUrl;
      const audioUrl = audioPath.startsWith("http") ? audioPath : audioPath;

      if (typeof data.tokensRemaining === "number" && Number.isFinite(data.tokensRemaining)) {
        window.dispatchEvent(
          new CustomEvent("tokens:update", { detail: { tokens: data.tokensRemaining } }),
        );
      } else {
        fetch("/api/tokens", { cache: "no-store" })
          .then((resp) => (resp.ok ? resp.json() : null))
          .then((json) => {
            const nextTokens = (json as { data?: { tokens?: unknown } } | null)?.data?.tokens;
            if (typeof nextTokens === "number" && Number.isFinite(nextTokens)) {
              window.dispatchEvent(new CustomEvent("tokens:update", { detail: { tokens: nextTokens } }));
            }
          })
          .catch(() => {});
      }

      setStatusText("Step 2/3 · Saving to history…");
      appStore.setState((draft) => {
        draft.latestAudioId = data.id;
        draft.latestAudioUrl = audioUrl;
        draft.latestAudioBlobUrl = audioUrl;
        const createdAt = data.createdAt ?? new Date().toISOString();
        const tokensUsed = typeof data.tokensUsed === "number" && Number.isFinite(data.tokensUsed) ? data.tokensUsed : 0;
        draft.ttsHistory = [
          { id: data.id, createdAt, title: data.title ?? null, voice, tone, audioUrl, tokensUsed },
          ...draft.ttsHistory.filter((it) => it.id !== data.id),
        ];
      });

      // reset any old sampler
      if (amplitudeIntervalRef.current !== null) {
        clearInterval(amplitudeIntervalRef.current);
        amplitudeIntervalRef.current = null;
      }

      const audio = new Audio();
      audio.preload = "auto";
      audio.defaultPlaybackRate = playbackRate;
      audio.playbackRate = playbackRate;
      audioRef.current = audio;
      setStatusText("Step 3/3 · Loading audio…");

      // for non‑iOS/Safari, hook up WebAudio analyzer
      if (!useStaticAnimation) {
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext();
        }
        const ctx = audioContextRef.current;
        const source = ctx.createMediaElementSource(audio);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyser.connect(ctx.destination);
        analyserRef.current = analyser;
      }

      const sample = () => {
        if (useStaticAnimation) {
          setAmplitudeLevels(generateRandomAmplitudes());
          return;
        }
        if (!analyserRef.current) return;
        const data = new Uint8Array(analyserRef.current.fftSize);
        analyserRef.current.getByteTimeDomainData(data);
        const avg =
          data.reduce((sum, v) => sum + Math.abs(v - 128), 0) /
          analyserRef.current.fftSize;
        const amp = avg / 128;
        setAmplitudeLevels((prev) => [...prev.slice(1), amp]);
      };

      audio.onerror = () => {
        resetPlayback();
        alert("Error generating audio");
      };

      audio.onplay = () => {
        amplitudeIntervalRef.current = window.setInterval(sample, 100);
        setIsPlaying(true);
        setAudioLoaded(true);
        setAudioLoading(false);
        setStatusText(null);
      };

      const clearSampling = () => {
        audioRef.current = null;
        if (amplitudeIntervalRef.current !== null) {
          clearInterval(amplitudeIntervalRef.current);
          amplitudeIntervalRef.current = null;
        }
        setIsPlaying(false);
        setStatusText(null);
      };

      audio.onpause = clearSampling;
      audio.onended = clearSampling;
      audio.autoplay = true;
      audio.src = audioUrl;
    } catch (err) {
      console.error("Error generating speech:", err);
      resetPlayback();
      alert(err instanceof Error ? err.message : "Error generating audio");
    }
  };

  return (
    <div className="space-y-1">
      <Button
        onClick={handleSubmit}
        aria-pressed={audioLoading || isPlaying}
        className={`relative w-full ${
          isBusyOrPlaying
            ? "bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
            : "bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white hover:from-purple-700 hover:to-fuchsia-700 focus-visible:ring-2 focus-visible:ring-purple-500/40 dark:focus-visible:ring-purple-300/40"
        }`}
        disabled={!inputValue.trim() && !audioLoading && !isPlaying}
      >
        {isPlaying ? (
          <PlayingWaveform audioLoaded={audioLoaded} amplitudeLevels={amplitudeLevels} />
        ) : audioLoading ? (
          <PlayingWaveform
            audioLoaded={false}
            amplitudeLevels={[0.032, 0.032, 0.032, 0.032, 0.032]}
          />
        ) : (
          <Play />
        )}
	        <span className="uppercase pr-3">
	          {isPlaying || audioLoading ? actionCopy.stop : actionCopy.generate}
	        </span>
	      </Button>
      {statusText ? <div className="text-[11px] text-muted-foreground">{statusText}</div> : null}
      <Dialog.Root open={insufficientOpen} onOpenChange={setInsufficientOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-overlayShow z-50" />
          <Dialog.Content className="fixed left-[50%] top-[50%] max-h-[85vh] w-[92vw] max-w-[420px] translate-x-[-50%] translate-y-[-50%] rounded-[12px] bg-background p-6 shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] focus:outline-none z-[51] data-[state=open]:animate-contentShow">
            <Dialog.Title className="text-foreground m-0 text-lg font-semibold">
              积分不足
            </Dialog.Title>
            <Dialog.Description className="text-foreground/70 mt-3 text-sm leading-relaxed">
              {insufficientInfo ? (
                <>
                  当前剩余 <span className="font-semibold text-foreground">{insufficientInfo.tokens}</span>{" "}
                  Token，本次生成预计需要{" "}
                  <span className="font-semibold text-foreground">{insufficientInfo.required}</span>{" "}
                  Token。
                </>
              ) : (
                <>你的 Token 不足以完成本次生成。</>
              )}
            </Dialog.Description>

            <div className="mt-6 flex items-center justify-end gap-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-muted/20 px-4 text-sm font-medium text-foreground transition hover:bg-muted/30"
                >
                  关闭
                </button>
              </Dialog.Close>
              <Link
                href={locale === "en" ? "/pricing" : `/${locale}/pricing`}
                className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
              >
                充值会员
              </Link>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={authRequiredOpen} onOpenChange={setAuthRequiredOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-overlayShow z-50" />
          <Dialog.Content className="fixed left-[50%] top-[50%] max-h-[85vh] w-[92vw] max-w-[420px] translate-x-[-50%] translate-y-[-50%] rounded-[12px] bg-background p-6 shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] focus:outline-none z-[51] data-[state=open]:animate-contentShow">
            <Dialog.Title className="text-foreground m-0 text-lg font-semibold">{authCopy.title}</Dialog.Title>
            <Dialog.Description className="text-foreground/70 mt-3 text-sm leading-relaxed">
              {authCopy.description}
            </Dialog.Description>

            <div className="mt-6 flex items-center justify-end gap-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-muted/20 px-4 text-sm font-medium text-foreground transition hover:bg-muted/30"
                >
                  {authCopy.cancel}
                </button>
              </Dialog.Close>
              <Link
                href={authCopy.signInHref}
                className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
              >
                {authCopy.signIn}
              </Link>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
