import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { ttsMonthlyUsage } from "@/lib/db/schema/tts";
import { getTtsProvider, inferGoogleBillingTier, type TtsBillingTier } from "@/lib/tts";
import { estimateHkdCostForRequest, getGoogleTtsPricingForTier, monthKey } from "@/lib/tts-pricing";
import { estimateTokensForRequest } from "@/lib/tts-tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function intParam(value: string | null, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function tierFromVoiceInput(voice: string): TtsBillingTier {
  if (voice.startsWith("clone:")) return "chirp-voice-cloning";
  return inferGoogleBillingTier(voice);
}

export async function GET(req: NextRequest) {
  const voice = normalizeString(req.nextUrl.searchParams.get("voice"));
  const chars = intParam(req.nextUrl.searchParams.get("chars"), 0, 0, 5000);

  if (!voice) {
    return Response.json({ error: "Missing voice" }, { status: 400 });
  }

  const provider = voice.startsWith("clone:") ? "google" : getTtsProvider();
  const billingTier = provider === "google" ? tierFromVoiceInput(voice) : provider;
  const tokenEstimate = estimateTokensForRequest({
    provider,
    billingTier: typeof billingTier === "string" ? (billingTier as TtsBillingTier) : "unknown",
    chars,
  });

  if (provider !== "google") {
    return Response.json({
      ok: true,
      data: {
        currency: "HKD",
        provider,
        billingTier,
        supported: false,
        chars,
        tokenEstimate,
      },
    });
  }

  const pricing = getGoogleTtsPricingForTier(billingTier);
  if (!pricing) {
    return Response.json({
      ok: true,
      data: {
        currency: "HKD",
        provider,
        billingTier,
        supported: false,
        chars,
        tokenEstimate,
      },
    });
  }

  const month = monthKey();
  let usedCharsThisMonth = 0;
  let usageTracked = false;

  if (process.env.DATABASE_URL) {
    try {
      const [row] = await db
        .select({ chars: ttsMonthlyUsage.chars })
        .from(ttsMonthlyUsage)
        .where(and(eq(ttsMonthlyUsage.month, month), eq(ttsMonthlyUsage.provider, "google"), eq(ttsMonthlyUsage.billingTier, billingTier)))
        .limit(1);

      usedCharsThisMonth = row?.chars ?? 0;
      usageTracked = true;
    } catch {
      // If we can't load usage, be conservative and assume free tier has been consumed.
      usedCharsThisMonth = pricing.freeCharsPerMonth;
      usageTracked = false;
    }
  } else {
    usedCharsThisMonth = pricing.freeCharsPerMonth;
    usageTracked = false;
  }

  const estimate = estimateHkdCostForRequest({
    pricing,
    chars,
    usedCharsThisMonth,
  });

  return Response.json({
    ok: true,
    data: {
      supported: true,
      month,
      usageTracked,
      provider,
      billingTier,
      pricing: {
        currency: pricing.currency,
        freeCharsPerMonth: pricing.freeCharsPerMonth,
        hkdPer1MCharsOverFree: pricing.hkdPer1MCharsOverFree,
      },
      estimate,
      tokenEstimate,
    },
  });
}
