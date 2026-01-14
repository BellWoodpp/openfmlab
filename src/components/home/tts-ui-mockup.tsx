"use client";

import React, { useMemo, useRef, useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import { BadgeCheck, Pause, Play, Volume2, VolumeX, X } from "lucide-react";
import { Block } from "@/components/ui/Block";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site-config";
import { voiceAvatarDataUri } from "@/lib/voice-avatar";
import type { HomeDictionary } from "@/i18n/types";
import { assetUrl } from "@/lib/asset-url";

type Voice = { id: string; name: string; label: string };

type PreviewStatus = "loading" | "playing";

const avatarCache = new Map<string, string>();

const INTRO_TEXT_BY_LANG: Record<keyof typeof STATIC_VOICES, string> = {
  en: `Welcome to ${siteConfig.brandName}.\n\nPaste a script here, pick a voice, and preview natural-sounding speech in seconds.`,
  zh: `欢迎来到 ${siteConfig.brandName}。\n\n将文本粘贴到此处，选择一个声音，即可在几秒钟内预览自然流畅的语音。`,
  ja: `${siteConfig.brandName}へようこそ。\n\nここにスクリプトを貼り付け、音声を選択すれば、数秒で自然な音声を聞くことができます。`,
};

function getIntroText(lang: keyof typeof STATIC_VOICES): string {
  return INTRO_TEXT_BY_LANG[lang] ?? INTRO_TEXT_BY_LANG.en;
}

function isIntroText(value: string): boolean {
  return Object.values(INTRO_TEXT_BY_LANG).includes(value);
}

const SAMPLE_AUDIO_BY_VOICE_ID: Record<string, string> = {
  en_us_journey_d: assetUrl("/voice/English/Journey.mp3"),
  en_us_neural2_f: assetUrl("/voice/English/Neural2-F.mp3"),
  en_gb_wavenet_b: assetUrl("/voice/English/Wavenet-B.mp3"),
  en_au_standard_c: assetUrl("/voice/English/Standard-C.mp3"),
  en_in_standard_a: assetUrl("/voice/English/Standard-A.mp3"),
  en_us_chirp3_hd: assetUrl("/voice/English/Chirp3-HD.mp3"),
  zh_cn_wavenet_a: assetUrl("/voice/Chinese/Wavenet-A.mp3"),
  zh_cn_chirp3_hd: assetUrl("/voice/Chinese/Chirp3-HD.mp3"),
  zh_tw_standard_b: assetUrl("/voice/Chinese/Standard-B.mp3"),
  ja_jp_wavenet_a: assetUrl("/voice/Japanese/Wavenet-A.mp3"),
  ja_jp_neural2_b: assetUrl("/voice/Japanese/Neural2-B.mp3"),
};

function avatarDataUri(input: string): string {
  const cached = avatarCache.get(input);
  if (cached) return cached;

  const uri = voiceAvatarDataUri(input, { variant: siteConfig.voiceAvatarVariant });
  avatarCache.set(input, uri);
  return uri;
}

const STATIC_VOICES: Record<string, Voice[]> = {
  en: [
    { id: "en_us_journey_d", name: "Journey D", label: "US · Studio" },
    { id: "en_us_neural2_f", name: "Neural2 F", label: "US · Neural2" },
    { id: "en_gb_wavenet_b", name: "Wavenet B", label: "UK · Wavenet" },
    { id: "en_au_standard_c", name: "Standard C", label: "AU · Standard" },
    { id: "en_in_standard_a", name: "Standard A", label: "IN · Standard" },
    { id: "en_us_chirp3_hd", name: "Chirp3‑HD", label: "US · Chirp3‑HD" },
  ],
  zh: [
    { id: "zh_cn_wavenet_a", name: "Wavenet A", label: "CN · Wavenet" },
    { id: "zh_cn_chirp3_hd", name: "Chirp3‑HD", label: "CN · Chirp3‑HD" },
    { id: "zh_tw_standard_b", name: "Standard B", label: "TW · Standard" },
  ],
  ja: [
    { id: "ja_jp_wavenet_a", name: "Wavenet A", label: "JP · Wavenet" },
    { id: "ja_jp_neural2_b", name: "Neural2 B", label: "JP · Neural2" },
  ],
};

type TtsUiMockupStrings = Pick<
  HomeDictionary,
  | "ttsMockupTextToSpeechTitle"
  | "ttsMockupSelectVoiceTitle"
  | "ttsMockupCharTokenCount"
  | "ttsMockupClearText"
  | "ttsMockupGenerate"
  | "ttsMockupPublic"
  | "ttsMockupVoicesCount"
  | "ttsMockupLanguage"
  | "ttsMockupEnableVoicePreviewAria"
  | "ttsMockupDisableVoicePreviewAria"
>;

function formatTemplate(template: string, values: Record<string, string | number>) {
  return template.replaceAll(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}

export function TtsUiMockup({ className, strings }: { className?: string; strings: TtsUiMockupStrings }) {
  const [input, setInput] = useState(getIntroText("en"));
  const [audioPreviewEnabled, setAudioPreviewEnabled] = useState(true);
  const previewSessionRef = useRef(0);
  const [preview, setPreview] = useState<{ voiceId: string; status: PreviewStatus } | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  const [voiceLang, setVoiceLang] = useState<keyof typeof STATIC_VOICES>("en");
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(STATIC_VOICES.en[0]?.id ?? "en_us_journey_d");

  const estimatedTokens = useMemo(() => Math.max(1, Math.ceil(input.trim().length / 4)), [input]);
  const voicesForLang = STATIC_VOICES[voiceLang] ?? STATIC_VOICES.en;
  const inputPlaceholder =
    voiceLang === "zh"
      ? "输入文本即可生成语音..."
      : voiceLang === "ja"
        ? "音声生成のためにテキストを入力してください..."
        : "Enter text to generate speech…";

  const stopPreview = () => {
    if (typeof window === "undefined") return;
    window.speechSynthesis?.cancel();
    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause();
      audioPreviewRef.current.currentTime = 0;
      audioPreviewRef.current = null;
    }
    setPreview(null);
  };

  const playVoicePreview = (voice: Voice) => {
    if (typeof window === "undefined") return;
    const currentSession = ++previewSessionRef.current;
    window.speechSynthesis?.cancel();
    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause();
      audioPreviewRef.current.currentTime = 0;
      audioPreviewRef.current = null;
    }

    const sampleUrl = SAMPLE_AUDIO_BY_VOICE_ID[voice.id];
    if (sampleUrl) {
      const audio = new Audio(sampleUrl);
      audio.preload = "auto";
      audioPreviewRef.current = audio;

      audio.onplaying = () => {
        if (previewSessionRef.current !== currentSession) return;
        setPreview({ voiceId: voice.id, status: "playing" });
      };
      audio.onended = () => {
        if (previewSessionRef.current !== currentSession) return;
        audioPreviewRef.current = null;
        setPreview(null);
      };
      audio.onerror = () => {
        if (previewSessionRef.current !== currentSession) return;
        audioPreviewRef.current = null;
        setPreview(null);
      };

      setPreview({ voiceId: voice.id, status: "loading" });
      audio
        .play()
        .catch(() => {
          if (previewSessionRef.current !== currentSession) return;
          audioPreviewRef.current = null;
          setPreview(null);
        });

      window.setTimeout(() => {
        if (previewSessionRef.current !== currentSession) return;
        setPreview((prev) =>
          prev && prev.voiceId === voice.id && prev.status === "loading"
            ? { voiceId: voice.id, status: "playing" }
            : prev,
        );
      }, 500);

      return;
    }

    const synth = window.speechSynthesis;
    if (!synth) return;

    synth.cancel();

    const lang = voiceLang === "zh" ? "zh-CN" : voiceLang === "ja" ? "ja-JP" : "en-US";
	    const text =
	      voiceLang === "zh"
	        ? "你好，这是语音预览。"
	        : voiceLang === "ja"
	          ? "こんにちは、ボイスのプレビューです。"
	          : `Hello, this is a ${siteConfig.brandName} voice preview.`;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;

    const voices = synth.getVoices?.() ?? [];
    const preferred =
      voices.find((v) => v.lang === lang) ??
      voices.find((v) => v.lang.toLowerCase().startsWith(lang.toLowerCase().split("-")[0] + "-")) ??
      null;
    if (preferred) utterance.voice = preferred;

    utterance.onstart = () => {
      if (previewSessionRef.current !== currentSession) return;
      setPreview({ voiceId: voice.id, status: "playing" });
    };
    utterance.onend = () => {
      if (previewSessionRef.current !== currentSession) return;
      setPreview(null);
    };
    utterance.onerror = () => {
      if (previewSessionRef.current !== currentSession) return;
      setPreview(null);
    };

    setPreview({ voiceId: voice.id, status: "loading" });
    synth.speak(utterance);

    window.setTimeout(() => {
      if (previewSessionRef.current !== currentSession) return;
      setPreview((prev) =>
        prev && prev.voiceId === voice.id && prev.status === "loading" ? { voiceId: voice.id, status: "playing" } : prev,
      );
    }, 500);
  };

  const handleClearText = () => setInput("");

  return (
    <div
      className={clsx(
        "w-full bg-transparent text-foreground selection:bg-primary/20",
        "[--color-screen:rgba(0,0,0,0.03)]",
        "[--shadow-textarea:rgba(0,0,0,0.06)_0px_0px_0px_1px_inset]",
        "dark:[--color-screen:#111111]",
        "dark:[--shadow-textarea:rgba(255,255,255,0.10)_0px_0px_0px_1px_inset]",
        className,
      )}
    >
      <div className="flex flex-col md:flex-row gap-6">
        <div className="lg:flex-[2_1_0%] flex flex-col min-w-0">
          <Block title={strings.ttsMockupTextToSpeechTitle}>
            <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-9 items-center rounded-full border border-border bg-muted/20 px-4 text-sm text-muted-foreground">
                  {formatTemplate(strings.ttsMockupCharTokenCount, { current: input.length, max: 5000, tokens: estimatedTokens })}
                </div>
                <button
                  type="button"
                  onClick={handleClearText}
                  className={clsx(
                    "inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm font-medium transition-colors",
                    input.trim()
                      ? "text-muted-foreground hover:text-foreground"
                      : "pointer-events-none opacity-40 text-muted-foreground",
                  )}
                >
                  <X className="h-4 w-4" />
                  {strings.ttsMockupClearText}
                </button>
              </div>
            </div>

            <div className="relative flex flex-col w-full">
              <textarea
                className="w-full min-h-[320px] lg:min-h-[360px] resize-none outline-none focus:outline-none bg-screen p-6 rounded-xl shadow-textarea text-[16px] leading-relaxed"
                value={input}
                onChange={(e) => setInput(e.target.value.slice(0, 5000))}
                placeholder={inputPlaceholder}
                maxLength={5000}
              />
            </div>

            <div className="mt-5 flex justify-end">
              <Button
                asChild
                className="h-11 rounded-full bg-purple-600 px-8 text-white hover:bg-purple-700"
              >
                <Link href="/podcast-mvp">{strings.ttsMockupGenerate}</Link>
              </Button>
            </div>
          </Block>
        </div>

        <div className="lg:flex-[1_1_0%] flex flex-col min-w-0">
          <Block title={strings.ttsMockupSelectVoiceTitle}>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="inline-flex rounded-full border border-border bg-muted/10 px-3 py-1 text-xs text-muted-foreground">
                  {strings.ttsMockupPublic}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (audioPreviewEnabled) stopPreview();
                      setAudioPreviewEnabled((v) => !v);
                    }}
                    className={clsx(
                      "inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted/10 text-muted-foreground transition-colors",
                      audioPreviewEnabled ? "hover:text-foreground" : "opacity-70 hover:opacity-100",
                    )}
                    aria-label={
                      audioPreviewEnabled
                        ? strings.ttsMockupDisableVoicePreviewAria
                        : strings.ttsMockupEnableVoicePreviewAria
                    }
                  >
                    {audioPreviewEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                  </button>
                  <span className="text-xs text-muted-foreground">
                    {formatTemplate(strings.ttsMockupVoicesCount, { count: voicesForLang.length })}
                  </span>
                </div>
              </div>

              <label className="text-xs text-muted-foreground flex flex-col gap-1.5">
                {strings.ttsMockupLanguage}
                <select
                  value={voiceLang}
                  onChange={(e) => {
                    const next = (e.target.value as keyof typeof STATIC_VOICES) || "en";
                    setVoiceLang(next);
                    const nextVoices = STATIC_VOICES[next] ?? STATIC_VOICES.en;
                    setSelectedVoiceId(nextVoices[0]?.id ?? "en_us_journey_d");
                    if (!input.trim() || isIntroText(input)) setInput(getIntroText(next));
                  }}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                >
                  <option value="en">English</option>
                  <option value="zh">中文</option>
                  <option value="ja">日本語</option>
                </select>
              </label>

              <div className="rounded-xl border border-border bg-muted/10 shadow-inner overflow-hidden">
                <div className="max-h-[460px] overflow-y-auto p-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-3 justify-items-center">
                    {voicesForLang.map((voice) => {
                      const active = voice.id === selectedVoiceId;
                      const isLoading = preview?.voiceId === voice.id && preview.status === "loading";
                      const isPlaying = preview?.voiceId === voice.id && preview.status === "playing";
                      const avatarBgClass =
                        isLoading || isPlaying ? "bg-primary/90 text-primary-foreground" : "bg-white";
                      const avatarFolder =
                        voiceLang === "zh" ? "Chinese" : voiceLang === "ja" ? "Japanese" : "English";
                      const avatarSrc = assetUrl(`/avator/${avatarFolder}/${encodeURIComponent(voice.name)}.png`);
                      const legacyAvatarSrc = assetUrl(`/avator/${encodeURIComponent(voice.name)}.png`);

                      return (
                        <button
                          key={voice.id}
                          type="button"
                          onClick={() => {
                            if (!input.trim()) setInput(getIntroText(voiceLang));
                            setSelectedVoiceId(voice.id);
                            if (!audioPreviewEnabled) return;
                            if (isLoading || isPlaying) {
                              stopPreview();
                              return;
                            }
                            playVoicePreview(voice);
                          }}
                          className={clsx(
                            "group w-[146px] h-[157px] rounded-2xl bg-muted/10 hover:bg-muted/15 transition-colors",
                            active
                              ? "ring-1 ring-foreground/15"
                              : "ring-1 ring-transparent",
                          )}
                        >
                          <div className="h-full w-full p-3 flex flex-col items-center text-center">
                            <div className={clsx("relative mt-1 mb-3 h-16 w-16 rounded-full grid place-items-center", avatarBgClass)}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={avatarSrc}
                                alt={voice.name.slice(0, 1).toUpperCase()}
                                className="h-14 w-14 rounded-full object-cover"
                                onError={(e) => {
                                  if (e.currentTarget.dataset.fallbackApplied === "2") {
                                    e.currentTarget.src = assetUrl("/avatar-placeholder.svg");
                                    return;
                                  }
                                  if (e.currentTarget.dataset.fallbackApplied === "1") {
                                    e.currentTarget.dataset.fallbackApplied = "2";
                                    e.currentTarget.src = avatarDataUri(voice.name);
                                    return;
                                  }
                                  e.currentTarget.dataset.fallbackApplied = "1";
                                  e.currentTarget.src = legacyAvatarSrc;
                                }}
                              />

                              {isLoading ? (
                                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white shadow-sm grid place-items-center">
                                  <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/25 border-t-primary animate-spin" />
                                </div>
                              ) : isPlaying ? (
                                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/90 shadow-sm grid place-items-center">
                                  <Pause className="h-4 w-4 text-white" fill="currentColor" />
                                </div>
                              ) : (
                                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/90 shadow-sm grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Play className="h-4 w-4 text-white" fill="currentColor" />
                                </div>
                              )}
                            </div>

                            <div className="flex items-center justify-center gap-1.5 text-sm font-semibold text-foreground leading-5">
                              <span className="truncate max-w-[110px]">{voice.name}</span>
                              <BadgeCheck className="h-4 w-4 text-foreground/80" />
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground leading-5">{voice.label}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </Block>
        </div>
      </div>
    </div>
  );
}
