import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";

import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { ttsGenerations } from "@/lib/db/schema/tts";
import { getTtsProvider, synthesizeTts } from "@/lib/tts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeTone(
  value: string,
): "neutral" | "calm" | "serious" | "cheerful" | "excited" | "surprised" {
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

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "no auth, please sign-in" }, { status: 401 });
  }

  const provider = getTtsProvider();
  const apiKey = provider === "openai" ? process.env.OPENAI_API_KEY : undefined;
  if (provider === "openai" && !apiKey) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY on server" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const input = normalizeString((body as { input?: unknown })?.input);
  const voice = normalizeString((body as { voice?: unknown })?.voice);
  const tone = normalizeTone(String((body as { tone?: unknown })?.tone ?? ""));
  const speakingRateMode = normalizeString((body as { speakingRateMode?: unknown })?.speakingRateMode) === "custom" ? "custom" : "auto";
  const speakingRateRaw = (body as { speakingRate?: unknown })?.speakingRate;
  const speakingRate =
    speakingRateMode === "custom" ? clampFloat(speakingRateRaw, 0.25, 4, 1) : undefined;
  const volumeGainDb = clampFloat((body as { volumeGainDb?: unknown })?.volumeGainDb, -96, 16, 0);

  if (!input) return NextResponse.json({ error: "Missing input" }, { status: 400 });
  if (!voice) return NextResponse.json({ error: "Missing voice" }, { status: 400 });
  if (input.length > 5000) return NextResponse.json({ error: "Input too long" }, { status: 400 });
  if (voice.length > 128) return NextResponse.json({ error: "Voice too long" }, { status: 400 });

  const id = nanoid(12);
  const format = "mp3" as const;

  try {
    const audioBytes = await synthesizeTts({
      provider,
      input,
      format,
      voice,
      tone,
      speakingRate,
      volumeGainDb,
      openAi: apiKey ? { apiKey, model: process.env.OPENAI_MODEL_TTS || "gpt-4o-mini-tts" } : undefined,
    });

    const [inserted] = await db.insert(ttsGenerations).values({
      id,
      userId,
      input,
      voice,
      tone,
      speakingRateMode,
      speakingRate,
      volumeGainDb,
      format,
      mimeType: "audio/mpeg",
      audio: Buffer.from(audioBytes),
    }).returning({ createdAt: ttsGenerations.createdAt });

    return NextResponse.json({
      id,
      audioUrl: `/api/tts/audio/${id}`,
      createdAt: inserted?.createdAt ? inserted.createdAt.toISOString() : null,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate audio" },
      { status: 502 },
    );
  }
}
