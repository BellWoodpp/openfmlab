import { NextRequest } from "next/server";
import { rateLimitOrThrow } from "@/lib/rate-limit";
import { getTtsMeta, getTtsProvider, synthesizeTts } from "@/lib/tts";
import { siteConfig } from "@/lib/site-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VOICES = [
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
  "verse",
] as const;

type Voice = (typeof VOICES)[number];

type AudioFormat = "mp3" | "wav";

function getEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value) return undefined;
  return value;
}

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

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return "unknown";
}

function isValidVoice(value: string): value is Voice {
  return (VOICES as readonly string[]).includes(value);
}

function sanitizeFilename(input: string): string {
  return input
    .trim()
    .replace(/[^\w\- ]+/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

function isChrome(req: NextRequest): boolean {
  const secChUa = req.headers.get("sec-ch-ua") || "";
  if (secChUa.includes("Google Chrome")) return true;

  const userAgent = req.headers.get("user-agent") || "";
  if (!userAgent.includes("Chrome/")) return false;
  if (userAgent.includes("Edg/")) return false;
  if (userAgent.includes("OPR/")) return false;
  return true;
}

function resolveFormat(explicit: string | null | undefined, req: NextRequest): AudioFormat {
  const normalized = normalizeString(explicit).toLowerCase();
  if (normalized === "wav" || normalized === "mp3") return normalized;
  return isChrome(req) ? "wav" : "mp3";
}

function contentType(format: AudioFormat): string {
  return format === "wav" ? "audio/wav" : "audio/mpeg";
}

function buildTtsHeaders(meta: ReturnType<typeof getTtsMeta>) {
  const headers: Record<string, string> = {
    "X-TTS-Provider": meta.provider,
    "X-TTS-Format": meta.format,
    "X-TTS-Voice-Input": meta.voiceInput,
    "X-TTS-Billing-Tier": meta.billingTier,
  };

  if (meta.languageCode) headers["X-TTS-Language-Code"] = meta.languageCode;
  if (meta.voiceName) headers["X-TTS-Voice-Name"] = meta.voiceName;
  if (meta.model) headers["X-TTS-Model"] = meta.model;

  return headers;
}

export async function GET(req: NextRequest) {
  const provider = getTtsProvider();
  const apiKey = provider === "openai" ? getEnv("OPENAI_API_KEY") : undefined;
  if (provider === "openai" && !apiKey) {
    return Response.json({ error: "Missing OPENAI_API_KEY on server" }, { status: 500 });
  }

  const ip = getClientIp(req);
  try {
    rateLimitOrThrow({ key: `tts:${ip}`, windowMs: 60_000, max: 20 });
  } catch (err) {
    const statusValue = (err as { status?: unknown }).status;
    const status = typeof statusValue === "number" ? statusValue : 429;
    const message = err instanceof Error ? err.message : "Rate limited";
    return Response.json({ error: message }, { status });
  }

  const searchParams = req.nextUrl.searchParams;
  const input = normalizeString(searchParams.get("input"));
  const instructions = normalizeString(searchParams.get("prompt"));
  const defaultVoice = provider === "google" ? "en-US-Standard-C" : "alloy";
  const voiceParam = normalizeString(searchParams.get("voice")) || defaultVoice;
  const tone = normalizeTone(searchParams.get("tone") || "");
  const speakingRateRaw = searchParams.get("speakingRate");
  const speakingRate = speakingRateRaw ? clampFloat(speakingRateRaw, 0.25, 4, 1) : undefined;
  const volumeGainDb = clampFloat(searchParams.get("volumeGainDb"), -96, 16, 0);
  const generation = normalizeString(searchParams.get("generation"));
  const requestedFormat = searchParams.get("format");

  if (!input) return Response.json({ error: "Missing input" }, { status: 400 });
  if (provider === "openai" && !isValidVoice(voiceParam)) {
    return Response.json({ error: "Invalid voice" }, { status: 400 });
  }

  const model = getEnv("OPENAI_MODEL_TTS") || "gpt-4o-mini-tts";
  const format = resolveFormat(requestedFormat, req);
  const meta = getTtsMeta({ provider, voice: voiceParam, format, openAiModel: model });
  if (getEnv("TTS_DEBUG_LOG") === "1") {
    console.info("[TTS]", {
      provider: meta.provider,
      billingTier: meta.billingTier,
      voiceInput: meta.voiceInput,
      voiceName: meta.voiceName,
      languageCode: meta.languageCode,
      format: meta.format,
      model: meta.model,
      tone,
      speakingRate,
      volumeGainDb,
    });
  }

  const maxChars = clampInt(Number(searchParams.get("maxChars")), 100, 5000, 2000);
  if (input.length > maxChars) {
    return Response.json({ error: `Input too long (max ${maxChars} chars)` }, { status: 400 });
  }

  try {
    const audio = await synthesizeTts({
      provider,
      input,
      format,
      voice: voiceParam,
      tone,
      speakingRate,
      volumeGainDb,
      instructions: instructions || undefined,
      openAi: apiKey ? { apiKey, model } : undefined,
    });

    return new Response(Buffer.from(audio), {
      headers: {
        "Content-Type": contentType(format),
        "Cache-Control": generation ? "public, max-age=31536000, immutable" : "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-TTS-Tone": tone,
        ...(speakingRate !== undefined ? { "X-TTS-Speaking-Rate": String(speakingRate) } : { "X-TTS-Speaking-Rate": "auto" }),
        "X-TTS-Volume-Gain-Db": String(volumeGainDb),
        ...buildTtsHeaders(meta),
      },
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const provider = getTtsProvider();
  const apiKey = provider === "openai" ? getEnv("OPENAI_API_KEY") : undefined;
  if (provider === "openai" && !apiKey) {
    return Response.json({ error: "Missing OPENAI_API_KEY on server" }, { status: 500 });
  }

  const ip = getClientIp(req);
  try {
    rateLimitOrThrow({ key: `tts:download:${ip}`, windowMs: 60_000, max: 10 });
  } catch (err) {
    const statusValue = (err as { status?: unknown }).status;
    const status = typeof statusValue === "number" ? statusValue : 429;
    const message = err instanceof Error ? err.message : "Rate limited";
    return Response.json({ error: message }, { status });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const input = normalizeString(formData.get("input"));
  const instructions = normalizeString(formData.get("prompt"));
  const defaultVoice = provider === "google" ? "en-US-Standard-C" : "alloy";
  const voiceParam = normalizeString(formData.get("voice")) || defaultVoice;
  const tone = normalizeTone(String(formData.get("tone") || ""));
  const speakingRateRaw = formData.get("speakingRate");
  const speakingRate = speakingRateRaw ? clampFloat(speakingRateRaw, 0.25, 4, 1) : undefined;
  const volumeGainDb = clampFloat(formData.get("volumeGainDb"), -96, 16, 0);
  const vibe = normalizeString(formData.get("vibe")) || "audio";
  const requestedFormat = normalizeString(formData.get("format"));

  if (!input) return Response.json({ error: "Missing input" }, { status: 400 });
  if (provider === "openai" && !isValidVoice(voiceParam)) {
    return Response.json({ error: "Invalid voice" }, { status: 400 });
  }

  const model = getEnv("OPENAI_MODEL_TTS") || "gpt-4o-mini-tts";
  const format = resolveFormat(requestedFormat, req);
  const meta = getTtsMeta({ provider, voice: voiceParam, format, openAiModel: model });
  if (getEnv("TTS_DEBUG_LOG") === "1") {
    console.info("[TTS]", {
      provider: meta.provider,
      billingTier: meta.billingTier,
      voiceInput: meta.voiceInput,
      voiceName: meta.voiceName,
      languageCode: meta.languageCode,
      format: meta.format,
      model: meta.model,
      tone,
      speakingRate,
      volumeGainDb,
    });
  }

  if (input.length > 5000) {
    return Response.json({ error: "Input too long (max 5000 chars)" }, { status: 400 });
  }

  const ext = format;
  const filename = `${siteConfig.downloadPrefix}-${voiceParam}-${sanitizeFilename(vibe) || "audio"}.${ext}`;
  try {
    const audio = await synthesizeTts({
      provider,
      input,
      format,
      voice: voiceParam,
      tone,
      speakingRate,
      volumeGainDb,
      instructions: instructions || undefined,
      openAi: apiKey ? { apiKey, model } : undefined,
    });

    return new Response(Buffer.from(audio), {
      headers: {
        "Content-Type": contentType(format),
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-TTS-Tone": tone,
        ...(speakingRate !== undefined ? { "X-TTS-Speaking-Rate": String(speakingRate) } : { "X-TTS-Speaking-Rate": "auto" }),
        "X-TTS-Volume-Gain-Db": String(volumeGainDb),
        ...buildTtsHeaders(meta),
      },
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
