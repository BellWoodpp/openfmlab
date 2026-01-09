"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Share, Waveform } from "@/components/ui/Icons";
import { appStore } from "@/lib/store";
import { Skeleton } from "@/components/ui/skeleton";

type CloneStatus = "creating" | "training" | "ready" | "failed" | string;

type CloneItem = {
  id: string;
  name: string;
  status: CloneStatus;
  provider: string;
  languageCode?: string;
  modelName?: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

type ListResponse = { maxClones: number; clones: CloneItem[] };

const CLONE_PREFIX = "clone:";

const MicIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z" />
    <path d="M19 11a7 7 0 0 1-14 0" />
    <path d="M12 18v3" />
    <path d="M8 21h8" />
  </svg>
);

function formatStatus(status: CloneStatus) {
  if (status === "ready") return "Ready";
  if (status === "training") return "Training";
  if (status === "creating") return "Creating";
  if (status === "failed") return "Failed";
  return String(status || "unknown");
}

function writeAscii(view: DataView, offset: number, text: string) {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i) & 0xff);
  }
}

function encodeWav16MonoFromAudioBuffer(audioBuffer: AudioBuffer): ArrayBuffer {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;

  const mono = new Float32Array(length);
  for (let ch = 0; ch < numChannels; ch += 1) {
    const data = audioBuffer.getChannelData(ch);
    for (let i = 0; i < length; i += 1) mono[i] += data[i] / numChannels;
  }

  const bytesPerSample = 2;
  const dataSize = length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true); // PCM fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true); // byteRate
  view.setUint16(32, bytesPerSample, true); // blockAlign
  view.setUint16(34, 16, true); // bitsPerSample
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < length; i += 1) {
    const s = Math.max(-1, Math.min(1, mono[i] ?? 0));
    view.setInt16(offset, Math.round(s * 0x7fff), true);
    offset += 2;
  }

  return buffer;
}

export default function VoiceCloningPanel({
  onGoToTts,
}: {
  onGoToTts?: () => void;
}) {
  const [list, setList] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [languageCode, setLanguageCode] = useState("en-US");
  const [modelName, setModelName] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [recordedFile, setRecordedFile] = useState<File | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordSaved, setRecordSaved] = useState<null | { id: string; audioUrl: string }>(null);
  const [recordSaving, setRecordSaving] = useState(false);
  const [recordSaveError, setRecordSaveError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const [pinnedHelpId, setPinnedHelpId] = useState<string | null>(null);
  const [hoverHelpId, setHoverHelpId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [availableLanguages, setAvailableLanguages] = useState<string[] | null>(null);
  const [languagesLoading, setLanguagesLoading] = useState(false);
  const [languagesError, setLanguagesError] = useState<string | null>(null);
  const uiLocale = useMemo(() => (typeof navigator === "undefined" ? "en" : navigator.language || "en"), []);
  const [languageListMode, setLanguageListMode] = useState<"common" | "all">("common");
  const [adminVoiceCloningKey, setAdminVoiceCloningKey] = useState("");

  const clones = list?.clones ?? [];
  const maxClones = list?.maxClones ?? 3;
  const remaining = Math.max(0, maxClones - clones.length);

  const defaultClone = useMemo(() => clones.find((c) => c.isDefault) ?? null, [clones]);
  const activeHelpId = pinnedHelpId ?? hoverHelpId;

  const COMMON_LANGUAGE_CODES = useMemo(
    () =>
      [
        "en-US",
        "cmn-CN",
        "yue-HK",
        "ja-JP",
        "ko-KR",
        "es-ES",
        "fr-FR",
        "de-DE",
        "ar-XA",
      ] as const,
    [],
  );

  const languageOptions = useMemo(() => {
    const loaded = availableLanguages?.length ? availableLanguages : [];
    if (languageListMode === "all") {
      return loaded.length ? loaded : COMMON_LANGUAGE_CODES.slice();
    }

    // common mode
    const set = new Set(loaded);
    const common = COMMON_LANGUAGE_CODES.filter((c) => set.has(c));
    return common.length ? common : COMMON_LANGUAGE_CODES.slice();
  }, [availableLanguages, COMMON_LANGUAGE_CODES, languageListMode]);

  useEffect(() => {
    if (languageListMode !== "common") return;
    const allowed = new Set(languageOptions);
    if (!allowed.has(languageCode)) {
      setLanguageCode(languageOptions[0] ?? "en-US");
    }
  }, [languageListMode, languageOptions, languageCode]);

  function languageOptionLabel(tag: string, locale: string): string {
    const [rawLang, rawRegion] = tag.split("-");
    const lang = rawLang || tag;
    const region = rawRegion && /^[A-Z]{2}$/.test(rawRegion) ? rawRegion : undefined;

    let langName = lang;
    try {
      const dnLang = new Intl.DisplayNames([locale], { type: "language" });
      langName = dnLang.of(lang) ?? lang;
    } catch {
      // ignore
    }

    if (!region) return `${langName} · ${tag}`;

    try {
      const dnRegion = new Intl.DisplayNames([locale], { type: "region" });
      const regionName = dnRegion.of(region);
      if (regionName) return `${langName} (${regionName}) · ${tag}`;
    } catch {
      // ignore
    }

    return `${langName} (${region}) · ${tag}`;
  }

  const HelpTip = ({ id, text }: { id: string; text: string }) => {
    const open = activeHelpId === id;
    return (
      <span className="relative inline-flex">
        <button
          type="button"
          aria-label="Help"
          aria-expanded={open}
          onMouseEnter={() => setHoverHelpId(id)}
          onMouseLeave={() => setHoverHelpId((prev) => (prev === id ? null : prev))}
          onFocus={() => setHoverHelpId(id)}
          onBlur={() => {
            setHoverHelpId(null);
            setPinnedHelpId(null);
          }}
          onClick={() => setPinnedHelpId((prev) => (prev === id ? null : id))}
          className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-border bg-muted/30 text-[11px] font-semibold text-muted-foreground hover:bg-muted/40 hover:text-foreground"
        >
          ?
        </button>
        {open ? (
          <div className="absolute left-1/2 top-6 z-30 w-96 -translate-x-1/2 rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground shadow-lg max-h-80 overflow-y-auto whitespace-pre-wrap">
            {text.trim()}
          </div>
        ) : null}
      </span>
    );
  };

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/voice-clone", { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 401) throw new Error("Sign in to create and manage voice clones.");
        if (res.status === 501) {
          const json = (await res.json().catch(() => null)) as { error?: unknown } | null;
          const msg = typeof json?.error === "string" ? json.error : null;
          throw new Error(msg || "Voice cloning is not enabled.");
        }
        throw new Error((await res.text().catch(() => "")) || "Failed to load voice clones");
      }
      const data = (await res.json()) as ListResponse;
      setList(data);
    } catch (err) {
      setList(null);
      setError(err instanceof Error ? err.message : "Failed to load voice clones");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/status", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        setIsAdmin(Boolean(data?.data?.isAdmin));
      })
      .catch(() => {
        if (cancelled) return;
        setIsAdmin(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLanguagesLoading(true);
    setLanguagesError(null);
    fetch("/api/tts/languages", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text().catch(() => "Failed to load languages"));
        return (await res.json()) as { languages?: string[] };
      })
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data?.languages) ? data.languages.filter((x) => typeof x === "string") : [];
        setAvailableLanguages(list);
      })
      .catch((err) => {
        if (cancelled) return;
        setAvailableLanguages(null);
        setLanguagesError(err instanceof Error ? err.message : "Failed to load languages");
      })
      .finally(() => {
        if (cancelled) return;
        setLanguagesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
      mediaRecorderRef.current = null;
      if (mediaStreamRef.current) {
        for (const t of mediaStreamRef.current.getTracks()) t.stop();
        mediaStreamRef.current = null;
      }
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopRecordingInternal = () => {
    if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
    recordTimerRef.current = null;

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        // ignore
      }
    }
    mediaRecorderRef.current = null;

    if (mediaStreamRef.current) {
      for (const t of mediaStreamRef.current.getTracks()) t.stop();
      mediaStreamRef.current = null;
    }
    setRecording(false);
  };

  const saveRecordingToHistory = async (file: File) => {
    setRecordSaveError(null);
    setRecordSaved(null);
    setRecordSaving(true);
    try {
      const form = new FormData();
      form.set("file", file, file.name);
      form.set("voice", "mic-recording");
      form.set("input", "Recording sample");

      const res = await fetch("/api/tts/upload", { method: "POST", body: form });
      if (!res.ok) {
        if (res.status === 401) throw new Error("Sign in to save recordings to History.");
        const details = await res.text().catch(() => "");
        throw new Error(details || "Failed to save recording");
      }
      const data = (await res.json()) as { id: string; audioUrl: string };
      setRecordSaved({ id: data.id, audioUrl: data.audioUrl });
    } catch (err) {
      setRecordSaveError(err instanceof Error ? err.message : "Failed to save recording");
    } finally {
      setRecordSaving(false);
    }
  };

  const handleToggleRecording = async () => {
    setRecordError(null);
    setRecordSaveError(null);
    setRecordSaved(null);
    if (recording) {
      stopRecordingInternal();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setRecordError("Recording is not supported in this browser.");
      return;
    }

    try {
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      setRecordedUrl(null);
      setRecordedFile(null);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      recordChunksRef.current = [];

      const preferredTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/ogg",
      ];
      const mimeType = preferredTypes.find((t) => MediaRecorder.isTypeSupported(t));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        try {
          const blob = new Blob(recordChunksRef.current, { type: recorder.mimeType || "audio/webm" });
          const ab = await blob.arrayBuffer();
          const ctx = new AudioContext();
          const audioBuffer = await ctx.decodeAudioData(ab.slice(0));
          await ctx.close();

          const wav = encodeWav16MonoFromAudioBuffer(audioBuffer);
          const file = new File([wav], `recording-${Date.now()}.wav`, { type: "audio/wav" });
          const url = URL.createObjectURL(new Blob([wav], { type: "audio/wav" }));
          setRecordedFile(file);
          setRecordedUrl(url);
        } catch (err) {
          console.error(err);
          const msg = err instanceof Error ? err.message : "Failed to process recording";
          setRecordError(`Recording saved, but converting to WAV failed: ${msg}`);
          const blob = new Blob(recordChunksRef.current, { type: recorder.mimeType || "audio/webm" });
          const file = new File([blob], `recording-${Date.now()}.webm`, {
            type: blob.type || "audio/webm",
          });
          const url = URL.createObjectURL(blob);
          setRecordedFile(file);
          setRecordedUrl(url);
        } finally {
          recordChunksRef.current = [];
        }
      };

      recorder.start(250);
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = window.setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch (err) {
      console.error(err);
      setRecordError(err instanceof Error ? err.message : "Microphone permission denied");
      stopRecordingInternal();
    }
  };

  const handleCreate = async () => {
    setCreateError(null);
    if (creating) return;

    const trimmedName = name.trim().slice(0, 40);
    if (!trimmedName) {
      setCreateError("Please enter a name.");
      return;
    }

    const sampleFiles: File[] = [];
    if (recordedFile) sampleFiles.push(recordedFile);
    for (const f of uploadedFiles) sampleFiles.push(f);

    if (!isAdmin && sampleFiles.length === 0) {
      setCreateError("Please upload or record at least one audio sample.");
      return;
    }

    setCreating(true);
    try {
      const form = new FormData();
      form.set("name", trimmedName);
      form.set("languageCode", languageCode.trim() || "en-US");
      if (modelName.trim()) form.set("modelName", modelName.trim());
      for (const f of sampleFiles) {
        form.append("samples", f, f.name);
      }
      if (isAdmin && adminVoiceCloningKey.trim()) {
        form.set("voiceCloningKey", adminVoiceCloningKey.trim());
      }

      const res = await fetch("/api/voice-clone", { method: "POST", body: form });
      if (!res.ok) {
        if (res.status === 401) throw new Error("Sign in to create a voice clone.");

        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const json = (await res.json().catch(() => null)) as { error?: unknown; message?: unknown; detail?: unknown } | null;
          const msg =
            (typeof json?.error === "string" && json.error.trim()) ||
            (typeof json?.message === "string" && json.message.trim()) ||
            (typeof json?.detail === "string" && json.detail.trim());
          if (msg) throw new Error(msg);
        }

        const text = await res.text().catch(() => "");
        if (text?.trim()) throw new Error(text.trim());

        if (res.status >= 500) {
          throw new Error("Server error (500). Check the dev server logs for the stack trace.");
        }

        throw new Error(`Create failed (${res.status})`);
      }

      // Save recording to History only after Clone Voice succeeds.
      // Keep the file in memory until saving completes, then clear UI state.
      if (recordedFile) {
        await saveRecordingToHistory(recordedFile);
      } else {
        setRecordSaved(null);
        setRecordSaveError(null);
      }

      setName("");
      setAdminVoiceCloningKey("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setUploadedFiles([]);
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      setRecordedUrl(null);
      setRecordedFile(null);
      await refresh();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create voice clone");
    } finally {
      setCreating(false);
    }
  };

  const handleSetDefault = async (cloneId: string) => {
    try {
      const res = await fetch(`/api/voice-clone/${cloneId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "Failed to set default");
      }
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to set default");
    }
  };

  const handleDelete = async (cloneId: string) => {
    if (!confirm("Delete this cloned voice?")) return;
    try {
      const res = await fetch(`/api/voice-clone/${cloneId}`, { method: "DELETE" });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "Failed to delete");
      }
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const handleUseForTts = (clone: CloneItem) => {
    appStore.setState((draft) => {
      draft.voice = `${CLONE_PREFIX}${clone.id}`;
      draft.latestAudioId = null;
      draft.latestAudioUrl = null;
      draft.latestAudioBlobUrl = null;
    });
    if (onGoToTts) onGoToTts();
  };

  const faqItems = [
    {
      q: "目前支持哪些语言？",
      a: "我们的 AI 声音克隆技术支持 8 种语言：英语、西班牙语、韩语、法语、日语、中文、德语和阿拉伯语。每种语言模型都经过专门训练，以捕捉地道的发音和自然的语音模式，确保您的克隆声音在每种语言中都听起来像母语者。",
    },
    {
      q: "使用是免费的吗？",
      a: "免费用户可以创建一个声音克隆，并拥有 500 个字符的生成配额。我们的付费计划提供多个声音克隆、更高的字符限制和高级功能。请访问我们的定价页面，探索最适合您需求的基础版和专业版计划。",
    },
    {
      q: "我该如何创建声音克隆？",
      a: "创建声音克隆非常简单：1）上传音频文件或直接使用工具录制；2）确保样本时长为 10-60 秒且语音清晰、背景噪音小；3）为您的声音克隆命名；4）点击创建，等待系统处理完成。为获得更佳效果，请自然说话并保持一致的音质。",
    },
    {
      q: "我该如何使用我克隆的声音？",
      a: "使用您克隆的声音很简单：1）前往“文本转语音”页面；2）在声音列表中选择“我的克隆声音”；3）输入要朗读的文本；4）点击 Play 生成音频。生成结果会进入历史记录，方便下载或分享。",
    },
    {
      q: "什么样的声音样本最适合克隆？",
      a: "为获得最佳效果：1）使用高质量、背景噪音最小的音频；2）以一致的速度自然说话；3）录制 10-60 秒清晰语音；4）使用正确的麦克风位置；5）避免背景音乐或其他声音；6）以正常的音调和风格说话。输入质量越好，克隆越准确。",
    },
    {
      q: "我可以为克隆的声音添加停顿和调整语速吗？",
      a: "目前克隆的声音不支持直接设置停顿和语速。但您可以在文本中使用自然标点（逗号、句号等）引导停顿节奏；我们会尽量保持原始录音中的自然节奏和说话风格。",
    },
    {
      q: "克隆声音的最大文本长度是多少？",
      a: "每次生成的文本上限为 2,000 个字符，以确保最佳质量和一致的声音特征。对于更长的文本，建议拆分为多个段落生成。我们可能会在未来更新中提高该限制。",
    },
    {
      q: "如果我的声音克隆听起来不对劲怎么办？",
      a: "如果效果未达预期：1）录制更清晰的新样本；2）确保样本没有明显背景噪音；3）自然说话，不要紧张；4）在样本中使用不同类型的句子；5）确保样本时长在建议的 10-60 秒范围内。您也可以创建新的克隆来改善效果。",
    },
  ];

  return (
    <div className="mt-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">AI Voice Cloning</h1>
        <p className="text-muted-foreground">
          Upload or record a short sample and request a Google Chirp voice clone. Limit: {maxClones} clones per user.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
        {/* Left: Create + Manage */}
        <div className="bg-screen border border-border rounded-2xl p-8">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="audio/*,.mp3,.wav,.ogg,.m4a"
            className="hidden"
            onChange={(e) => setUploadedFiles(Array.from(e.target.files ?? []))}
          />

          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDragOver(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const files = Array.from(e.dataTransfer.files ?? []).filter((f) => f.type.startsWith("audio/"));
              if (files.length === 0) {
                setCreateError("Please drop audio files only.");
                return;
              }
              setUploadedFiles(files);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
            className={[
              "border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center mb-4 transition-colors outline-none",
              dragOver ? "border-primary/60 bg-primary/5" : "border-border hover:border-primary/50",
            ].join(" ")}
          >
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Share className="w-6 h-6 text-muted-foreground" />
            </div>
            <div className="text-sm font-medium mb-1 text-center">Click to upload or drag and drop</div>
            <div className="text-xs text-muted-foreground text-center">
              Format: MP3, WAV, OGG · Size: up to 10MB per file
            </div>
          </div>

          {uploadedFiles.length > 0 ? (
            <div className="mb-6 rounded-xl border border-border bg-background/50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium">Selected files</div>
                <button
                  type="button"
                  className="text-xs font-medium text-muted-foreground hover:text-foreground underline underline-offset-4"
                  onClick={() => {
                    setUploadedFiles([]);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  Clear
                </button>
              </div>
              <div className="mt-2 space-y-1">
                {uploadedFiles.slice(0, 6).map((f) => (
                  <div key={`${f.name}-${f.size}-${f.lastModified}`} className="text-xs text-muted-foreground truncate">
                    {f.name} · {(f.size / 1024).toFixed(0)} KB
                  </div>
                ))}
                {uploadedFiles.length > 6 ? (
                  <div className="text-xs text-muted-foreground">…and {uploadedFiles.length - 6} more</div>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="relative flex items-center justify-center mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <span className="relative px-4 bg-screen text-xs text-muted-foreground uppercase">OR</span>
          </div>

	          <div className="flex flex-col items-center mb-8">
	            <button
	              type="button"
	              onClick={handleToggleRecording}
              disabled={creating}
              className={[
                "flex items-center gap-2 px-6 py-3 rounded-lg transition-colors mb-2 border border-border bg-muted/30 hover:bg-muted/40",
                recording ? "text-red-300 border-red-900/30 bg-red-950/20 hover:bg-red-950/30" : "text-foreground",
              ].join(" ")}
            >
              <MicIcon className="w-4 h-4" />
              <span className="text-sm font-medium">
                {recording ? `Stop recording (${recordSeconds}s)` : "Record your audio"}
	              </span>
	            </button>
	            <div className="text-xs text-muted-foreground flex items-center">
                10-20 seconds of speaking is advisable.
                <HelpTip
                  id="sample-length"
                  text={`10–20 秒是一个“性价比区间”：足够让模型抓住你的音色特征（音高范围、共振、咬字、能量分布、语速/停顿习惯），同时又不至于把大量无关信息（噪声、房间混响、情绪变化、距离变化）带进去。

太短（比如 <5–8 秒）常见问题：
- 特征不稳定：生成出来更像“泛化人声”，像你但不够像
- 某些音素/语调覆盖不足：遇到没出现过的发音时容易跑偏
- 更容易被噪声/一次性口误主导

太长（比如 >60 秒甚至更久）常见问题：
- 质量更依赖一致性：只要中间有一段噪声、距离变了、情绪变了，整体克隆稳定性可能反而下降
- 多风格混在一起：模型学到“平均风格”，生成时不够像某个固定状态
- 对你来说成本/操作负担更高（录制、上传、挑选、清理）

最佳做法通常是：选 10–60 秒里“最干净、最一致”的一段；如果想更稳，比起无限加长，优先保证：无噪/无混响/单人/音量稳定/语速自然。`}
                />
              </div>

            {recordError ? (
              <div className="mt-3 w-full text-xs text-red-400 border border-red-900/30 bg-red-950/20 rounded-lg px-4 py-3">
                {recordError}
              </div>
            ) : null}

            {recordedFile && recordedUrl ? (
              <div className="mt-4 w-full rounded-xl border border-border bg-background/50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">Recording ready</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {recordedFile.name} · {(recordedFile.size / 1024).toFixed(0)} KB
                    </div>
                  </div>
                  <button
                    type="button"
                    className="text-xs font-medium text-muted-foreground hover:text-foreground underline underline-offset-4"
                    onClick={() => {
                      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
                      setRecordedUrl(null);
                      setRecordedFile(null);
                      setRecordSaved(null);
                      setRecordSaveError(null);
                    }}
                  >
                    Remove
                  </button>
                </div>
                <audio className="w-full mt-3" controls preload="metadata" src={recordedUrl} />
                <div className="mt-2 text-xs text-muted-foreground">
                  {recordSaving ? (
                    <span>Saving to History…</span>
                  ) : recordSaved ? (
                    <span>
                      Saved to <span className="font-medium text-foreground">History</span>.
                    </span>
                  ) : recordSaveError ? (
                    <span className="text-red-400">{recordSaveError}</span>
                  ) : (
                    <span>
                      Will be saved to <span className="font-medium text-foreground">History</span> after you click{" "}
                      <span className="font-medium text-foreground">Clone Voice</span>.
                    </span>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-6">
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium flex items-center">
                  Enter a name for your voice
                  <HelpTip id="clone-name" text="给你自己看的克隆名称（用于列表展示）。" />
                </label>
                <span className="text-xs text-muted-foreground">{name.trim().length}/40</span>
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. My Voice Clone"
                className="w-full bg-background border border-border rounded-lg px-4 py-3 outline-none focus:border-primary transition-colors"
              />
            </div>

            <div>
              <div className="rounded-xl border border-border bg-background/50 px-4 py-3 text-xs text-muted-foreground">
                克隆请求会使用你上传/录制的样本音频。你不需要提供任何 Google key。
                {isAdmin ? (
                  <div className="mt-2">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <label className="text-sm font-medium flex items-center text-foreground/80">
                        Admin: voiceCloningKey (optional)
                        <HelpTip
                          id="admin-clone-key"
                          text="仅管理员可见：如你已经从 Google/内部工具拿到了 voiceCloningKey，可在此绑定并立即将该克隆标记为 ready。"
                        />
                      </label>
                      <span className="text-xs text-muted-foreground">{adminVoiceCloningKey.trim().length}/2048</span>
                    </div>
                    <textarea
                      value={adminVoiceCloningKey}
                      onChange={(e) => setAdminVoiceCloningKey(e.target.value)}
                      placeholder="Paste voiceCloningKey here"
                      rows={3}
                      className="w-full resize-none bg-background border border-border rounded-lg px-4 py-3 outline-none focus:border-primary transition-colors font-mono text-xs"
                    />
                  </div>
                ) : null}
              </div>
            </div>

            <details className="rounded-xl border border-border bg-background/40 px-4 py-3">
              <summary className="cursor-pointer select-none text-sm font-medium text-muted-foreground hover:text-foreground">
                高级设置（可选）
              </summary>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 flex items-center">
                    Language (BCP-47)
                    <HelpTip
                      id="clone-lang"
                      text="选择合成语言/口音（BCP‑47 标签），会影响发音与可用声音。一般保持默认即可。"
                    />
                  </label>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setLanguageListMode("common")}
                      className={[
                        "inline-flex h-8 items-center rounded-full border px-3 text-xs transition-colors",
                        languageListMode === "common"
                          ? "border-foreground/40 bg-foreground/10 text-foreground"
                          : "border-border bg-muted/10 text-muted-foreground hover:bg-muted/20 hover:text-foreground",
                      ].join(" ")}
                      aria-pressed={languageListMode === "common"}
                    >
                      常用
                    </button>
                    <button
                      type="button"
                      onClick={() => setLanguageListMode("all")}
                      disabled={languagesLoading || !!languagesError || !(availableLanguages?.length)}
                      className={[
                        "inline-flex h-8 items-center rounded-full border px-3 text-xs transition-colors",
                        languagesLoading || !!languagesError || !(availableLanguages?.length) ? "opacity-60 cursor-not-allowed" : "",
                        languageListMode === "all"
                          ? "border-foreground/40 bg-foreground/10 text-foreground"
                          : "border-border bg-muted/10 text-muted-foreground hover:bg-muted/20 hover:text-foreground",
                      ].join(" ")}
                      aria-pressed={languageListMode === "all"}
                      title={
                        languagesLoading
                          ? "Loading languages…"
                          : languagesError
                            ? "Failed to load full language list"
                            : !(availableLanguages?.length)
                              ? "Full language list unavailable"
                              : "Show all languages"
                      }
                    >
                      All
                      {availableLanguages?.length ? (
                        <span className="ml-2 font-mono text-[10px] opacity-70">{availableLanguages.length}</span>
                      ) : null}
                    </button>
                  </div>
                  <div className="relative">
                    <select
                      value={languageCode}
                      onChange={(e) => setLanguageCode(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-4 py-3 outline-none appearance-none cursor-pointer focus:border-primary transition-colors"
                      disabled={languagesLoading}
                    >
                      {languagesLoading ? <option value={languageCode}>Loading languages…</option> : null}
                      {!languagesLoading && languagesError ? (
                        <option value={languageCode}>Failed to load languages (showing current)</option>
                      ) : null}
                      {!languagesLoading && !languagesError ? (
                        <>
                          {!languageOptions.includes(languageCode) ? (
                            <option value={languageCode}>{languageOptionLabel(languageCode, uiLocale)}</option>
                          ) : null}
                          {languageOptions.map((code) => (
                            <option key={code} value={code}>
                              {languageOptionLabel(code, uiLocale)}
                            </option>
                          ))}
                        </>
                      ) : null}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                      <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                      </svg>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {languagesLoading
                      ? "Loading languages…"
                      : languagesError
                        ? `Failed to load languages: ${languagesError}`
                        : availableLanguages?.length
                          ? `Available: ${availableLanguages.length} languages`
                          : "Default: en-US."}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 flex items-center">
                    Model name (optional)
                    <HelpTip
                      id="clone-model"
                      text="可选：指定 Google 侧模型名；留空将使用默认模型。只有你明确需要某个模型时才填写。"
                    />
                  </label>
                  <input
                    type="text"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    placeholder="(optional)"
                    className="w-full bg-background border border-border rounded-lg px-4 py-3 outline-none focus:border-primary transition-colors font-mono text-sm"
                  />
                  <div className="mt-2 text-xs text-muted-foreground">
                    仅在你明确需要指定 Google 侧模型时填写；留空将使用默认模型。
                  </div>
                </div>
              </div>
            </details>

              <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
                <div className="font-medium text-foreground/80">建议的样本质量</div>
                <ul className="mt-1 list-disc pl-4 space-y-1">
                  <li>建议 10–60 秒的清晰人声（越干净越好）</li>
                  <li>背景噪音越少越好、不要音乐/混响</li>
                  <li>语速自然、音量稳定、不要刻意表演</li>
                  <li>单人讲话、16kHz+（越高越好）</li>
                </ul>
              </div>

	            <button
	              type="button"
	              disabled={creating || remaining <= 0}
	              onClick={handleCreate}
	              className="w-full bg-[#a855f7] text-white font-bold py-4 rounded-xl hover:bg-[#9333ea] disabled:opacity-60 disabled:hover:bg-[#a855f7] transition-all flex items-center justify-center gap-2 mt-2 shadow-lg shadow-purple-500/20"
	            >
              <Waveform className="w-5 h-5" />
              {creating ? "Creating…" : remaining <= 0 ? "Clone Limit Reached" : "Clone Voice"}
            </button>

              <div className="text-xs text-muted-foreground -mt-1">
                创建（Clone Voice）不消耗积分；只有在 Text to Speech 实际生成音频时才会消耗积分。
              </div>

	            {createError ? (
	              <div className="text-sm text-red-400 border border-red-900/30 bg-red-950/20 rounded-lg px-4 py-3">
	                {createError}
	              </div>
            ) : null}
          </div>

          <div className="mt-8 border-t border-border pt-6">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Your cloned voices</div>
              <button
                type="button"
                className="text-xs font-medium text-muted-foreground hover:text-foreground underline underline-offset-4"
                onClick={refresh}
                disabled={loading}
              >
                Refresh
              </button>
            </div>

            {loading ? (
              list ? (
                <div className="mt-3 text-sm text-muted-foreground">Refreshing…</div>
              ) : (
                <div className="mt-4 space-y-3">
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <div
                      key={`clone-loading-${idx}`}
                      className="rounded-xl border border-border bg-background/60 p-4 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 space-y-2">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-56" />
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-3 w-14" />
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : error ? (
              <div className="mt-3 text-sm text-muted-foreground">{error}</div>
            ) : clones.length === 0 ? (
              <div className="mt-3 text-sm text-muted-foreground">No clones yet. Create one above.</div>
            ) : (
              <div className="mt-4 space-y-3">
                {clones.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-xl border border-border bg-background/60 p-4 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-foreground truncate">{c.name}</div>
                        {c.isDefault ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">
                            Default
                          </span>
                        ) : null}
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted/40 text-muted-foreground border border-border">
                          {formatStatus(c.status)}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {c.provider} · {new Date(c.createdAt).toLocaleString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        type="button"
                        className="text-xs font-medium text-primary underline underline-offset-4"
                        onClick={() => handleUseForTts(c)}
                        disabled={c.status !== "ready"}
                      >
                        Use for TTS
                      </button>
                      {!c.isDefault ? (
                        <button
                          type="button"
                          className="text-xs font-medium text-muted-foreground hover:text-foreground underline underline-offset-4"
                          onClick={() => handleSetDefault(c.id)}
                        >
                          Set default
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="text-xs font-medium text-muted-foreground hover:text-foreground underline underline-offset-4"
                        onClick={() => handleDelete(c.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 text-xs text-muted-foreground">
              Tip: once a clone is ready, it appears under “My cloned voices” in the voice picker, and generation uses
              the same storage/quota rules as TTS history.
            </div>
          </div>
        </div>

        {/* Right: FAQ */}
        <div className="lg:-mt-2">
          <div className="text-center text-2xl font-bold mb-6">常见问题</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {faqItems.map((item) => (
              <details
                key={item.q}
                className="group rounded-2xl border border-border bg-background/40 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset]"
              >
                <summary className="cursor-pointer select-none [&::-webkit-details-marker]:hidden">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-lg font-semibold">{item.q}</div>
                    <svg
                      className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </div>
                </summary>
                <div className="mt-3 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
