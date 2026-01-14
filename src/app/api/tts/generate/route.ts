import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";

import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema/users";
import { ttsGenerations } from "@/lib/db/schema/tts";
import { ttsMonthlyUsage } from "@/lib/db/schema/tts";
import { voiceClones } from "@/lib/db/schema/voiceClones";
import type { GoogleVoiceSelectionParams } from "@/lib/tts";
import { inferGoogleBillingTier, getTtsProvider, type TtsBillingTier, synthesizeTts } from "@/lib/tts";
import { estimateHkdCostForRequest, getGoogleTtsPricingForTier, monthKey } from "@/lib/tts-pricing";
import { estimateTokensForRequest } from "@/lib/tts-tokens";
import { checkUserPaidMembership } from "@/lib/membership";
import { isVoiceCloningEnabled } from "@/lib/voice-cloning-enabled";
import { isR2Configured, r2DeleteObjects, r2PutObject } from "@/lib/storage/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ELEVEN_PREFIX = "elevenlabs:";
const CLONE_PREFIX = "clone:";

function googleTierFromVoiceInput(voice: string): TtsBillingTier {
  if (voice.startsWith(CLONE_PREFIX)) return "chirp-voice-cloning";
  return inferGoogleBillingTier(voice);
}

async function getGoogleMonthlyUsedChars(month: string, tier: TtsBillingTier): Promise<number> {
  const [row] = await db
    .select({ chars: ttsMonthlyUsage.chars })
    .from(ttsMonthlyUsage)
    .where(and(eq(ttsMonthlyUsage.month, month), eq(ttsMonthlyUsage.provider, "google"), eq(ttsMonthlyUsage.billingTier, tier)))
    .limit(1);
  return row?.chars ?? 0;
}

async function addGoogleMonthlyUsedChars(month: string, tier: TtsBillingTier, delta: number): Promise<void> {
  const now = new Date();
  await db
    .insert(ttsMonthlyUsage)
    .values({
      month,
      provider: "google",
      billingTier: tier,
      chars: Math.max(0, Math.floor(delta)),
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [ttsMonthlyUsage.month, ttsMonthlyUsage.provider, ttsMonthlyUsage.billingTier],
      set: {
        chars: sql`${ttsMonthlyUsage.chars} + ${Math.max(0, Math.floor(delta))}`,
        updatedAt: now,
      },
    });
}

async function refundTokens(userId: string, amount: number): Promise<void> {
  if (!Number.isFinite(amount) || amount <= 0) return;
  try {
    await db
      .update(users)
      .set({ tokens: sql`${users.tokens} + ${Math.floor(amount)}` })
      .where(eq(users.id, userId));
  } catch {
    // ignore
  }
}

function normalizeString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function isUndefinedColumnError(err: unknown, column: string): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  const message = (err as { message?: unknown }).message;
  if (code === "42703") return typeof message === "string" ? message.includes(column) : true;
  return typeof message === "string" && message.includes(`column "${column}" does not exist`);
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

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.floor(n);
}

const POLICY = {
  maxItems: Math.max(1, envInt("TTS_HISTORY_MAX_ITEMS", 20)),
  maxDays: Math.max(1, envInt("TTS_HISTORY_MAX_DAYS", 7)),
  maxTotalBytes: Math.max(1, envInt("TTS_HISTORY_MAX_TOTAL_BYTES", 50 * 1024 * 1024)),
};

async function applyRetention(userId: string): Promise<void> {
  const cutoff = new Date(Date.now() - POLICY.maxDays * 24 * 60 * 60 * 1000);

  const deletedOldKeys: string[] = [];
  try {
    const rows = await db
      .delete(ttsGenerations)
      .where(and(eq(ttsGenerations.userId, userId), lt(ttsGenerations.createdAt, cutoff)))
      .returning({ audioKey: ttsGenerations.audioKey });
    for (const r of rows) {
      if (typeof r.audioKey === "string" && r.audioKey.trim()) deletedOldKeys.push(r.audioKey.trim());
    }
  } catch (err) {
    if (!isUndefinedColumnError(err, "audio_key")) throw err;
    await db
      .delete(ttsGenerations)
      .where(and(eq(ttsGenerations.userId, userId), lt(ttsGenerations.createdAt, cutoff)));
  }

  if (deletedOldKeys.length && isR2Configured()) {
    try {
      await r2DeleteObjects(deletedOldKeys);
    } catch {
      // ignore
    }
  }

  while (true) {
    const overflow = await (async () => {
      try {
        return await db
          .select({ id: ttsGenerations.id, audioKey: ttsGenerations.audioKey })
          .from(ttsGenerations)
          .where(eq(ttsGenerations.userId, userId))
          .orderBy(desc(ttsGenerations.createdAt))
          .offset(POLICY.maxItems)
          .limit(200);
      } catch (err) {
        if (!isUndefinedColumnError(err, "audio_key")) throw err;
        return await db
          .select({ id: ttsGenerations.id })
          .from(ttsGenerations)
          .where(eq(ttsGenerations.userId, userId))
          .orderBy(desc(ttsGenerations.createdAt))
          .offset(POLICY.maxItems)
          .limit(200);
      }
    })();

    if (overflow.length === 0) break;
    await db.delete(ttsGenerations).where(inArray(ttsGenerations.id, overflow.map((r) => r.id)));

    const keys = overflow
      .map((r) => (r as { audioKey?: unknown }).audioKey)
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .map((v) => v.trim());
    if (keys.length && isR2Configured()) {
      try {
        await r2DeleteObjects(keys);
      } catch {
        // ignore
      }
    }
  }
}

async function getUsage(userId: string): Promise<{ totalItems: number; totalBytes: number }> {
  const [row] = await (async () => {
    try {
      return await db
        .select({
          totalItems: sql<number>`count(*)::int`,
          totalBytes: sql<number>`coalesce(sum(coalesce(${ttsGenerations.audioSize}, octet_length(${ttsGenerations.audio}))), 0)::bigint`,
        })
        .from(ttsGenerations)
        .where(eq(ttsGenerations.userId, userId));
    } catch (err) {
      if (!isUndefinedColumnError(err, "audio_size")) throw err;
      return await db
        .select({
          totalItems: sql<number>`count(*)::int`,
          totalBytes: sql<number>`coalesce(sum(octet_length(${ttsGenerations.audio})), 0)::bigint`,
        })
        .from(ttsGenerations)
        .where(eq(ttsGenerations.userId, userId));
    }
  })();

  return {
    totalItems: row?.totalItems ?? 0,
    totalBytes: Number(row?.totalBytes ?? 0),
  };
}

function extFromMimeType(mimeType: string): string {
  const t = (mimeType || "").toLowerCase();
  if (t.includes("wav")) return "wav";
  if (t.includes("ogg")) return "ogg";
  if (t.includes("webm")) return "webm";
  if (t.includes("mpeg") || t.includes("mp3")) return "mp3";
  return "bin";
}

async function persistTtsGeneration(opts: {
  id: string;
  userId: string;
  title: string | null;
  input: string;
  voice: string;
  tone: string;
  speakingRateMode: string;
  speakingRate: number | null | undefined;
  volumeGainDb: number;
  format: string;
  mimeType: string;
  audioBytes: Uint8Array;
}): Promise<{ createdAt: Date | null; audioKey: string | null }> {
  const audioSize = opts.audioBytes.length;
  const audioDb = Buffer.from(opts.audioBytes);

  const candidateTitle = typeof opts.title === "string" && opts.title.trim() ? opts.title.trim() : "";
  const wantsTitle = Boolean(candidateTitle);

  const r2Key = isR2Configured() ? `tts/${opts.userId}/${opts.id}.${extFromMimeType(opts.mimeType)}` : null;
  let uploadedToR2 = false;
  if (r2Key) {
    try {
      await r2PutObject({
        key: r2Key,
        body: new Uint8Array(audioDb),
        contentType: opts.mimeType || "application/octet-stream",
      });
      uploadedToR2 = true;
    } catch (err) {
      console.warn("[r2] upload failed; falling back to DB storage:", err);
      uploadedToR2 = false;
    }
  }

  const base = {
    id: opts.id,
    userId: opts.userId,
    input: opts.input,
    voice: opts.voice,
    tone: opts.tone,
    speakingRateMode: opts.speakingRateMode,
    speakingRate: opts.speakingRate ?? null,
    volumeGainDb: opts.volumeGainDb,
    format: opts.format,
    mimeType: opts.mimeType,
  };

  const candidates: Array<{
    withTitle: boolean;
    withR2Columns: boolean;
    persistAudioKey: string | null;
    values: Record<string, unknown>;
  }> = [];

  const pushCandidate = (p: { withTitle: boolean; withR2Columns: boolean; persistAudioKey: string | null }) => {
    candidates.push({
      ...p,
      values: {
        ...base,
        ...(p.withTitle ? { title: candidateTitle } : {}),
        ...(p.withR2Columns
          ? {
              ...(p.persistAudioKey ? { audioKey: p.persistAudioKey } : {}),
              audioSize,
            }
          : {}),
        ...(p.persistAudioKey ? { audio: null } : { audio: audioDb }),
      },
    });
  };

  // Prefer R2: store key + size, keep DB audio empty.
  if (uploadedToR2 && r2Key) {
    if (wantsTitle) pushCandidate({ withTitle: true, withR2Columns: true, persistAudioKey: r2Key });
    pushCandidate({ withTitle: false, withR2Columns: true, persistAudioKey: r2Key });
  }

  // Fallback: DB audio (still write audioSize if column exists).
  if (wantsTitle) pushCandidate({ withTitle: true, withR2Columns: true, persistAudioKey: null });
  pushCandidate({ withTitle: false, withR2Columns: true, persistAudioKey: null });
  if (wantsTitle) pushCandidate({ withTitle: true, withR2Columns: false, persistAudioKey: null });
  pushCandidate({ withTitle: false, withR2Columns: false, persistAudioKey: null });

  const isRetryable = (err: unknown): boolean => {
    const code = (err as { code?: unknown })?.code;
    if (code === "42703" || code === "23502") return true; // undefined column / not-null violation
    if (isUndefinedColumnError(err, "title")) return true;
    if (isUndefinedColumnError(err, "audio_key") || isUndefinedColumnError(err, "audio_size")) return true;
    return false;
  };

  let lastErr: unknown = null;
  for (const c of candidates) {
    try {
      const [inserted] = await db
        .insert(ttsGenerations)
        .values(c.values as never)
        .returning({ createdAt: ttsGenerations.createdAt });

      // If we uploaded to R2 but couldn't persist the key in DB, clean up the orphan.
      if (uploadedToR2 && r2Key && !c.persistAudioKey && isR2Configured()) {
        try {
          await r2DeleteObjects([r2Key]);
        } catch {
          // ignore
        }
      }

      return { createdAt: inserted?.createdAt ?? null, audioKey: c.persistAudioKey };
    } catch (err) {
      lastErr = err;
      if (isRetryable(err)) continue;
      throw err;
    }
  }

  // If we got here, all candidates failed. Best-effort cleanup if we uploaded.
  if (uploadedToR2 && r2Key && isR2Configured()) {
    try {
      await r2DeleteObjects([r2Key]);
    } catch {
      // ignore
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function POST(req: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "TTS saving is disabled. Set DATABASE_URL and run migrations to enable it." },
      { status: 501 },
    );
  }

  const session = await auth.api.getSession({ headers: req.headers });
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "no auth, please sign-in" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const input = normalizeString((body as { input?: unknown })?.input);
  const voiceRaw = normalizeString((body as { voice?: unknown })?.voice);
  const titleRaw = normalizeString((body as { title?: unknown })?.title);
  const title = titleRaw && titleRaw.length <= 80 ? titleRaw : "";
  const tone = normalizeTone(String((body as { tone?: unknown })?.tone ?? ""));
  const speakingRateMode = normalizeString((body as { speakingRateMode?: unknown })?.speakingRateMode) === "custom" ? "custom" : "auto";
  const speakingRateRaw = (body as { speakingRate?: unknown })?.speakingRate;
  const speakingRate =
    speakingRateMode === "custom" ? clampFloat(speakingRateRaw, 0.25, 4, 1) : undefined;
  const volumeGainDb = clampFloat((body as { volumeGainDb?: unknown })?.volumeGainDb, -96, 16, 0);

  if (!input) return NextResponse.json({ error: "Missing input" }, { status: 400 });
  if (!voiceRaw) return NextResponse.json({ error: "Missing voice" }, { status: 400 });
  if (titleRaw && !title) return NextResponse.json({ error: "Title too long" }, { status: 400 });
  if (input.length > 5000) return NextResponse.json({ error: "Input too long" }, { status: 400 });
  if (voiceRaw.length > 256) return NextResponse.json({ error: "Voice too long" }, { status: 400 });

  const id = nanoid(12);
  const format = "mp3" as const;
  let tokensUsed = 0;
  let tokensRemaining: number | null = null;
  let charged = false;
  let googleVoiceSelection: GoogleVoiceSelectionParams | undefined;
  let googleBillingTier: TtsBillingTier | null = null;

  try {
    const wantsElevenLabs = voiceRaw.startsWith(ELEVEN_PREFIX);
    const wantsClone = voiceRaw.startsWith(CLONE_PREFIX);

    let provider = wantsElevenLabs ? "elevenlabs" : getTtsProvider();
    let voice = wantsElevenLabs ? voiceRaw.slice(ELEVEN_PREFIX.length) : voiceRaw;

    if (wantsClone) {
      if (!isVoiceCloningEnabled()) {
        return NextResponse.json({ error: "Voice cloning is currently disabled." }, { status: 501 });
      }
      const membership = await checkUserPaidMembership(userId);
      if (!membership.isPaid) {
        if (membership.reason === "orders_table_missing") {
          return NextResponse.json(
            { error: "Orders table is missing. Run `pnpm db:push` to apply migrations." },
            { status: 501 },
          );
        }
        return NextResponse.json(
          { error: "PREMIUM_REQUIRED", message: "Voice cloning is available to paid members only." },
          { status: 402 },
        );
      }

      const cloneId = voiceRaw.slice(CLONE_PREFIX.length);
      if (!cloneId || cloneId.length > 32) {
        return NextResponse.json({ error: "Invalid cloned voice id" }, { status: 400 });
      }

      const [clone] = await db
        .select({
          id: voiceClones.id,
          provider: voiceClones.provider,
          providerVoiceId: voiceClones.providerVoiceId,
          languageCode: voiceClones.languageCode,
          modelName: voiceClones.modelName,
          status: voiceClones.status,
        })
        .from(voiceClones)
        .where(and(eq(voiceClones.userId, userId), eq(voiceClones.id, cloneId)))
        .limit(1);

      if (!clone || clone.status !== "ready") {
        return NextResponse.json({ error: "Unknown cloned voice" }, { status: 403 });
      }

      if (clone.provider === "google") {
        if (!clone.providerVoiceId) {
          return NextResponse.json({ error: "Cloned voice is not fully configured yet." }, { status: 409 });
        }
        provider = "google";
        voice = voiceRaw;
        googleBillingTier = "chirp-voice-cloning";
        googleVoiceSelection = {
          languageCode: clone.languageCode || "en-US",
          voiceClone: { voiceCloningKey: clone.providerVoiceId },
          ...(clone.modelName ? { modelName: clone.modelName } : {}),
        };
      } else if (clone.provider === "elevenlabs") {
        if (!clone.providerVoiceId) {
          return NextResponse.json({ error: "Cloned voice is not fully configured yet." }, { status: 409 });
        }
        provider = "elevenlabs";
        voice = clone.providerVoiceId;
      } else {
        return NextResponse.json({ error: "Unsupported cloned voice provider" }, { status: 501 });
      }
    }

    if (provider === "google" && !wantsClone) {
      const tier = googleBillingTier ?? googleTierFromVoiceInput(voiceRaw);
      googleBillingTier = tier;
      if (tier !== "standard") {
        const membership = await checkUserPaidMembership(userId);
        if (!membership.isPaid) {
          if (membership.reason === "orders_table_missing") {
            return NextResponse.json(
              { error: "Orders table is missing. Run `pnpm db:push` to apply migrations." },
              { status: 501 },
            );
          }
          return NextResponse.json(
            { error: "PREMIUM_REQUIRED", message: "This voice tier is available to paid members only." },
            { status: 402 },
          );
        }
      }
    }

    if (provider === "google") {
      const tier = googleBillingTier ?? googleTierFromVoiceInput(voiceRaw);
      googleBillingTier = tier;
      tokensUsed = estimateTokensForRequest({ provider: "google", billingTier: tier, chars: input.length }).tokens;
    } else {
      // Keep existing behavior for non-Google providers for now.
      tokensUsed = Math.max(1, Math.ceil(input.length / Math.max(1, envInt("TTS_TOKEN_CHARS_PER_TOKEN", 4))));
    }

    if (provider === "elevenlabs") {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      if (!apiKey) {
        return NextResponse.json({ error: "Missing ELEVENLABS_API_KEY on server" }, { status: 500 });
      }

      if (!wantsClone) {
        const [owned] = await db
          .select({ id: voiceClones.id })
          .from(voiceClones)
          .where(and(eq(voiceClones.userId, userId), eq(voiceClones.providerVoiceId, voice)))
          .limit(1);

        if (!owned) {
          return NextResponse.json({ error: "Unknown cloned voice" }, { status: 403 });
        }
      }

      const [chargedRow] = await db
        .update(users)
        .set({ tokens: sql`${users.tokens} - ${tokensUsed}` })
        .where(and(eq(users.id, userId), gte(users.tokens, tokensUsed)))
        .returning({ tokens: users.tokens });

      if (!chargedRow) {
        const [row] = await db
          .select({ tokens: users.tokens })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        return NextResponse.json(
          {
            error: "INSUFFICIENT_TOKENS",
            message: "Not enough tokens to generate this audio.",
            tokens: row?.tokens ?? 0,
            required: tokensUsed,
          },
          { status: 402 },
        );
      }

      charged = true;
      tokensRemaining = chargedRow.tokens;

      const audioBytes = await synthesizeTts({
        provider,
        input,
        format,
        voice,
        tone,
        speakingRate,
        volumeGainDb,
        elevenLabs: { apiKey },
      });

      const persisted = await persistTtsGeneration({
        id,
        userId,
        title: title || null,
        input,
        voice: voiceRaw,
        tone,
        speakingRateMode,
        speakingRate,
        volumeGainDb,
        format,
        mimeType: "audio/mpeg",
        audioBytes,
      });

      await applyRetention(userId);

      const usage = await getUsage(userId);
      if (usage.totalBytes > POLICY.maxTotalBytes) {
        await db.delete(ttsGenerations).where(and(eq(ttsGenerations.userId, userId), eq(ttsGenerations.id, id)));
        if (persisted.audioKey && isR2Configured()) {
          try {
            await r2DeleteObjects([persisted.audioKey]);
          } catch {
            // ignore
          }
        }
        await refundTokens(userId, tokensUsed);
        return NextResponse.json(
          {
            error: `Storage quota exceeded. Limit is ${POLICY.maxTotalBytes} bytes.`,
            code: "QUOTA_EXCEEDED",
            policy: POLICY,
            usage,
          },
          { status: 409 },
        );
      }

      return NextResponse.json({
        id,
        audioUrl: `/api/tts/audio/${id}`,
        createdAt: persisted.createdAt ? persisted.createdAt.toISOString() : null,
        title: title || null,
        tokensUsed,
        tokensRemaining,
      });
    }

    const apiKey = provider === "openai" ? process.env.OPENAI_API_KEY : undefined;
    if (provider === "openai" && !apiKey) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY on server" }, { status: 500 });
    }

    const [chargedRow] = await db
      .update(users)
      .set({ tokens: sql`${users.tokens} - ${tokensUsed}` })
      .where(and(eq(users.id, userId), gte(users.tokens, tokensUsed)))
      .returning({ tokens: users.tokens });

    if (!chargedRow) {
      const [row] = await db
        .select({ tokens: users.tokens })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      return NextResponse.json(
        {
          error: "INSUFFICIENT_TOKENS",
          message: "Not enough tokens to generate this audio.",
          tokens: row?.tokens ?? 0,
          required: tokensUsed,
        },
        { status: 402 },
      );
    }

    charged = true;
    tokensRemaining = chargedRow.tokens;

    const audioBytes = await synthesizeTts({
      provider,
      input,
      format,
      voice: voiceRaw,
      tone,
      speakingRate,
      volumeGainDb,
      openAi: apiKey ? { apiKey, model: process.env.OPENAI_MODEL_TTS || "gpt-4o-mini-tts" } : undefined,
      google: googleVoiceSelection ? { voiceSelection: googleVoiceSelection } : undefined,
    });

    const persisted = await persistTtsGeneration({
      id,
      userId,
      title: title || null,
      input,
      voice: voiceRaw,
      tone,
      speakingRateMode,
      speakingRate,
      volumeGainDb,
      format,
      mimeType: "audio/mpeg",
      audioBytes,
    });

    await applyRetention(userId);

    const usage = await getUsage(userId);
    if (usage.totalBytes > POLICY.maxTotalBytes) {
      await db.delete(ttsGenerations).where(and(eq(ttsGenerations.userId, userId), eq(ttsGenerations.id, id)));
      if (persisted.audioKey && isR2Configured()) {
        try {
          await r2DeleteObjects([persisted.audioKey]);
        } catch {
          // ignore
        }
      }
      await refundTokens(userId, tokensUsed);
      return NextResponse.json(
        {
          error: `Storage quota exceeded. Limit is ${POLICY.maxTotalBytes} bytes.`,
          code: "QUOTA_EXCEEDED",
          policy: POLICY,
          usage,
        },
        { status: 409 },
      );
    }

    let cost: unknown = null;
    if (provider === "google") {
      const tier = googleBillingTier ?? googleTierFromVoiceInput(voiceRaw);
      const pricing = getGoogleTtsPricingForTier(tier);
      const month = monthKey();
      try {
        const usedCharsThisMonth = await getGoogleMonthlyUsedChars(month, tier);
        if (pricing) {
          const estimate = estimateHkdCostForRequest({
            pricing,
            chars: input.length,
            usedCharsThisMonth,
          });
          cost = {
            currency: pricing.currency,
            month,
            billingTier: tier,
            pricing: {
              freeCharsPerMonth: pricing.freeCharsPerMonth,
              hkdPer1MCharsOverFree: pricing.hkdPer1MCharsOverFree,
            },
            estimate,
          };
        } else {
          cost = { currency: "HKD", month, billingTier: tier, supported: false, chars: input.length };
        }
        await addGoogleMonthlyUsedChars(month, tier, input.length);
      } catch {
        // If usage tracking fails, still return the audio.
        cost = pricing
          ? {
              currency: pricing.currency,
              month,
              billingTier: tier,
              pricing: {
                freeCharsPerMonth: pricing.freeCharsPerMonth,
                hkdPer1MCharsOverFree: pricing.hkdPer1MCharsOverFree,
              },
              estimate: estimateHkdCostForRequest({
                pricing,
                chars: input.length,
                usedCharsThisMonth: pricing.freeCharsPerMonth,
              }),
              usageTracked: false,
            }
          : { currency: "HKD", billingTier: tier, supported: false, chars: input.length, usageTracked: false };
      }
    }

    return NextResponse.json({
      id,
      audioUrl: `/api/tts/audio/${id}`,
      createdAt: persisted.createdAt ? persisted.createdAt.toISOString() : null,
      title: title || null,
      tokensUsed,
      tokensRemaining,
      cost,
    });
  } catch (err) {
    if (charged) await refundTokens(userId, tokensUsed);
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate audio" },
      { status: 502 },
    );
  }
}
