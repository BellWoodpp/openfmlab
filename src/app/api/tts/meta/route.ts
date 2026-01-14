import { NextRequest } from "next/server";
import { getTtsMeta, getTtsProvider } from "@/lib/tts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeTone(value: string): "neutral" | "calm" | "serious" | "cheerful" | "excited" | "surprised" {
  const v = normalizeString(value).toLowerCase();
  if (v === "calm") return "calm";
  if (v === "serious") return "serious";
  if (v === "cheerful") return "cheerful";
  if (v === "excited") return "excited";
  if (v === "surprised") return "surprised";
  return "neutral";
}

function clampFloat(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function normalizeProvider(value: string): ReturnType<typeof getTtsProvider> | null {
  const v = normalizeString(value).toLowerCase();
  if (!v) return null;
  if (v === "google" || v === "gcp" || v === "google-cloud") return "google";
  if (v === "azure" || v === "microsoft" || v === "ms" || v === "speech") return "azure";
  if (v === "elevenlabs" || v === "eleven-labs" || v === "11labs") return "elevenlabs";
  if (v === "openai") return "openai";
  return null;
}

export async function GET(req: NextRequest) {
  const requestedProvider = normalizeProvider(req.nextUrl.searchParams.get("provider") || "");
  const provider = requestedProvider ?? getTtsProvider();
  const defaultVoice =
    provider === "google" ? "en-US-Standard-C" : provider === "azure" ? "en-US-JennyNeural" : "alloy";
  const voice = normalizeString(req.nextUrl.searchParams.get("voice")) || defaultVoice;
  const rawFormat = normalizeString(req.nextUrl.searchParams.get("format")) || "mp3";
  const format = rawFormat === "wav" ? "wav" : "mp3";
  const tone = normalizeTone(req.nextUrl.searchParams.get("tone") || "");
  const speakingRateRaw = req.nextUrl.searchParams.get("speakingRate");
  const speakingRate = speakingRateRaw ? clampFloat(speakingRateRaw, 0.25, 4, 1) : undefined;
  const volumeGainDb = clampFloat(req.nextUrl.searchParams.get("volumeGainDb"), -96, 16, 0);
  const model = process.env.OPENAI_MODEL_TTS || "gpt-4o-mini-tts";

  const meta = getTtsMeta({ provider, voice, format, openAiModel: model });

  return Response.json({
    ...meta,
    tone,
    volumeGainDb,
    speakingRate: speakingRate ?? null,
    googleApi: provider === "google" ? "texttospeech.googleapis.com/v1" : undefined,
    ts: new Date().toISOString(),
  });
}
