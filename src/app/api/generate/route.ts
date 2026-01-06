import { NextRequest } from "next/server";
import { rateLimitOrThrow } from "@/lib/rate-limit";

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

async function tts(opts: {
  apiKey: string;
  model: string;
  voice: Voice;
  input: string;
  instructions?: string;
  format: AudioFormat;
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
      response_format: opts.format,
      ...(opts.instructions ? { instructions: opts.instructions } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`TTS failed (${res.status}): ${text || "unknown error"}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

export async function GET(req: NextRequest) {
  const apiKey = getEnv("OPENAI_API_KEY");
  if (!apiKey) {
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
  const voiceParam = normalizeString(searchParams.get("voice")) || "alloy";
  const generation = normalizeString(searchParams.get("generation"));
  const requestedFormat = searchParams.get("format");

  if (!input) return Response.json({ error: "Missing input" }, { status: 400 });
  if (!isValidVoice(voiceParam)) return Response.json({ error: "Invalid voice" }, { status: 400 });

  const model = getEnv("OPENAI_MODEL_TTS") || "gpt-4o-mini-tts";
  const format = resolveFormat(requestedFormat, req);

  const maxChars = clampInt(Number(searchParams.get("maxChars")), 100, 5000, 2000);
  if (input.length > maxChars) {
    return Response.json({ error: `Input too long (max ${maxChars} chars)` }, { status: 400 });
  }

  try {
    const audio = await tts({
      apiKey,
      model,
      voice: voiceParam,
      input,
      instructions: instructions || undefined,
      format,
    });

    return new Response(audio, {
      headers: {
        "Content-Type": contentType(format),
        "Cache-Control": generation ? "public, max-age=31536000, immutable" : "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const apiKey = getEnv("OPENAI_API_KEY");
  if (!apiKey) {
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
  const voiceParam = normalizeString(formData.get("voice")) || "alloy";
  const vibe = normalizeString(formData.get("vibe")) || "audio";
  const requestedFormat = normalizeString(formData.get("format"));

  if (!input) return Response.json({ error: "Missing input" }, { status: 400 });
  if (!isValidVoice(voiceParam)) return Response.json({ error: "Invalid voice" }, { status: 400 });

  const model = getEnv("OPENAI_MODEL_TTS") || "gpt-4o-mini-tts";
  const format = resolveFormat(requestedFormat, req);

  if (input.length > 5000) {
    return Response.json({ error: "Input too long (max 5000 chars)" }, { status: 400 });
  }

  const ext = format;
  const filename = `openai-fm-${voiceParam}-${sanitizeFilename(vibe) || "audio"}.${ext}`;

  try {
    const audio = await tts({
      apiKey,
      model,
      voice: voiceParam,
      input,
      instructions: instructions || undefined,
      format,
    });

    return new Response(audio, {
      headers: {
        "Content-Type": contentType(format),
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}

