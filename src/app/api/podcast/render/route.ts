import { NextRequest } from "next/server";
import { rateLimitOrThrow } from "@/lib/rate-limit";
import { encodePcmWav, parseWav, silencePcmBytes, type WavPcm } from "@/lib/wav";

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
  apiKey: string;
  model: string;
  voice: string;
  input: string;
  instructions?: string;
}) {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      voice: opts.voice,
      input: opts.input,
      response_format: "wav",
      ...(opts.instructions ? { instructions: opts.instructions } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`TTS failed (${res.status}): ${text || "unknown error"}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function assertCompatible(base: WavPcm, next: WavPcm) {
  if (base.audioFormat !== next.audioFormat) throw new Error("Inconsistent WAV audioFormat");
  if (base.numChannels !== next.numChannels) throw new Error("Inconsistent WAV channels");
  if (base.sampleRate !== next.sampleRate) throw new Error("Inconsistent WAV sampleRate");
  if (base.bitsPerSample !== next.bitsPerSample) throw new Error("Inconsistent WAV bitsPerSample");
  if (base.audioFormat !== 1) throw new Error("Only PCM WAV supported in MVP");
}

export async function POST(req: NextRequest) {
  const apiKey = getEnv("OPENAI_API_KEY");
  if (!apiKey) {
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
  for (const segment of segments) {
    const speaker = segment?.speaker === "GUEST" ? "GUEST" : "HOST";
    const text = normalizeString(segment?.text);
    if (!text) return badRequest("Empty segment text");
    if (text.length > 1200) return badRequest("Segment text too long (max 1200 chars)");

    const voice = speaker === "GUEST" ? voiceGuest : voiceHost;
    const wavBuffer = await ttsToWavBuffer({ apiKey, model, voice, input: text, instructions });
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

  const title = normalizeString(requestBody.title) || "openfm-episode";
  const filename = `${sanitizeFilename(title) || "openfm-episode"}.wav`;

  const responseBody = new Uint8Array(output);

  return new Response(responseBody, {
    headers: {
      "Content-Type": "audio/wav",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
