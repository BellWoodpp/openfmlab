import { NextRequest } from "next/server";
import { rateLimitOrThrow } from "@/lib/rate-limit";
import { encodePcmWav, parseWav, silencePcmBytes, type WavPcm } from "@/lib/wav";
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
] as const;

type Voice = (typeof VOICES)[number];

type RenderRequest = {
  title?: string;
  segments: Array<{
    speaker: "HOST" | "GUEST";
    text: string;
  }>;
  voices?: Partial<Record<"HOST" | "GUEST", Voice>>;
  pauseMs?: number;
  instructions?: string;
};

function getEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value) return undefined;
  return value;
}

function normalizeString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function sanitizeFilename(input: string): string {
  return input
    .trim()
    .replace(/[^\w\- ]+/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return "unknown";
}

function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

async function ttsToWavBuffer(opts: {
  voice: string;
  input: string;
  instructions?: string;
  openAi?: { apiKey: string; model: string };
}) {
  const audio = await synthesizeTts({
    provider: getTtsProvider(),
    input: opts.input,
    voice: opts.voice,
    format: "wav",
    instructions: opts.instructions,
    openAi: opts.openAi,
  });

  return Buffer.from(audio);
}

function assertCompatible(base: WavPcm, next: WavPcm) {
  if (base.audioFormat !== next.audioFormat) throw new Error("Inconsistent WAV audioFormat");
  if (base.numChannels !== next.numChannels) throw new Error("Inconsistent WAV channels");
  if (base.sampleRate !== next.sampleRate) throw new Error("Inconsistent WAV sampleRate");
  if (base.bitsPerSample !== next.bitsPerSample) throw new Error("Inconsistent WAV bitsPerSample");
  if (base.audioFormat !== 1) throw new Error("Only PCM WAV supported in MVP");
}

export async function POST(req: NextRequest) {
  const provider = getTtsProvider();
  const apiKey = provider === "openai" ? getEnv("OPENAI_API_KEY") : undefined;
  if (provider === "openai" && !apiKey) {
    return Response.json({ error: "Missing OPENAI_API_KEY on server" }, { status: 500 });
  }

  const ip = getClientIp(req);
  try {
    rateLimitOrThrow({ key: `podcast-render:${ip}`, windowMs: 60_000, max: 3 });
  } catch (err) {
    const statusValue = (err as { status?: unknown }).status;
    const status = typeof statusValue === "number" ? statusValue : 429;
    const message = err instanceof Error ? err.message : "Rate limited";
    return Response.json({ error: message }, { status });
  }

  let requestBody: RenderRequest;
  try {
    requestBody = (await req.json()) as RenderRequest;
  } catch {
    return badRequest("Invalid JSON body");
  }

  const segments = Array.isArray(requestBody.segments) ? requestBody.segments : [];
  if (segments.length < 1) return badRequest("Missing segments");
  if (segments.length > 20) return badRequest("Too many segments (max 20)");

  const pauseMs = Math.max(0, Math.min(2000, Math.round(Number(requestBody.pauseMs ?? 250))));
  const instructions = normalizeString(requestBody.instructions);

  const voiceHost: Voice =
    requestBody.voices?.HOST && (VOICES as readonly string[]).includes(requestBody.voices.HOST)
      ? requestBody.voices.HOST
    : "alloy";
  const voiceGuest: Voice =
    requestBody.voices?.GUEST && (VOICES as readonly string[]).includes(requestBody.voices.GUEST)
      ? requestBody.voices.GUEST
    : "nova";

  const model = getEnv("OPENAI_MODEL_TTS") || "gpt-4o-mini-tts";

  const wavParts: WavPcm[] = [];
  const metaSet = new Set<string>();
  for (const segment of segments) {
    const speaker = segment?.speaker === "GUEST" ? "GUEST" : "HOST";
    const text = normalizeString(segment?.text);
    if (!text) return badRequest("Empty segment text");
    if (text.length > 1200) return badRequest("Segment text too long (max 1200 chars)");

    const voice = speaker === "GUEST" ? voiceGuest : voiceHost;
    const meta = getTtsMeta({ provider, voice, format: "wav", openAiModel: model });
    metaSet.add(
      [
        meta.provider,
        meta.billingTier,
        meta.languageCode || "",
        meta.voiceName || meta.voiceInput,
        meta.model || "",
      ].join("|"),
    );
    const wavBuffer = await ttsToWavBuffer({
      voice,
      input: text,
      instructions,
      openAi: apiKey ? { apiKey, model } : undefined,
    });
    const wav = parseWav(wavBuffer);
    wavParts.push(wav);
  }

  const base = wavParts[0]!;
  for (const part of wavParts.slice(1)) {
    assertCompatible(base, part);
  }

  const silence = silencePcmBytes({
    durationMs: pauseMs,
    numChannels: base.numChannels,
    sampleRate: base.sampleRate,
    bitsPerSample: base.bitsPerSample,
  });

  const combinedPcm = Buffer.concat(
    wavParts.flatMap((part, idx) => (idx === 0 ? [part.pcmData] : [silence, part.pcmData])),
  );

  const output = encodePcmWav({
    numChannels: base.numChannels,
    sampleRate: base.sampleRate,
    bitsPerSample: base.bitsPerSample,
    pcmData: combinedPcm,
  });

  const fallbackTitle = `${siteConfig.downloadPrefix}-episode`;
  const title = normalizeString(requestBody.title) || fallbackTitle;
  const filename = `${sanitizeFilename(title) || fallbackTitle}.wav`;

  const responseBody = new Uint8Array(output);

  const metaParts = Array.from(metaSet);
  const metaSummary = metaParts.length <= 8 ? metaParts.join(",") : `${metaParts.slice(0, 8).join(",")}...`;

  return new Response(responseBody, {
    headers: {
      "Content-Type": "audio/wav",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-TTS-Provider": provider,
      "X-TTS-Meta": metaSummary,
    },
  });
}
