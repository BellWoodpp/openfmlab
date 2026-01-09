import type { TtsBillingTier } from "@/lib/tts";

export type GoogleTtsTierPricing = {
  currency: "HKD";
  billingTier: TtsBillingTier;
  freeCharsPerMonth: number;
  hkdPer1MCharsOverFree: number;
};

function envFloat(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.floor(n);
}

function clampNonNegativeInt(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

function clampNonNegativeFloat(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value;
}

export function getGoogleTtsPricingForTier(tier: TtsBillingTier): GoogleTtsTierPricing | null {
  const currency = "HKD" as const;

  // Defaults reflect the numbers you pasted (HKD per 1,000,000 chars beyond free tier).
  // You can override them via env vars.
  if (tier === "standard") {
    return {
      currency,
      billingTier: tier,
      freeCharsPerMonth: clampNonNegativeInt(envInt("GOOGLE_TTS_FREE_CHARS_STANDARD", 4_000_000)),
      hkdPer1MCharsOverFree: clampNonNegativeFloat(envFloat("GOOGLE_TTS_HKD_PER_1M_STANDARD", 31.0966)),
    };
  }
  if (tier === "wavenet") {
    return {
      currency,
      billingTier: tier,
      freeCharsPerMonth: clampNonNegativeInt(envInt("GOOGLE_TTS_FREE_CHARS_WAVENET", 1_000_000)),
      hkdPer1MCharsOverFree: clampNonNegativeFloat(envFloat("GOOGLE_TTS_HKD_PER_1M_WAVENET", 124.3864)),
    };
  }
  if (tier === "neural2") {
    // Neural2 pricing varies by SKU; default to the same as Wavenet unless overridden.
    return {
      currency,
      billingTier: tier,
      freeCharsPerMonth: clampNonNegativeInt(envInt("GOOGLE_TTS_FREE_CHARS_NEURAL2", 1_000_000)),
      hkdPer1MCharsOverFree: clampNonNegativeFloat(envFloat("GOOGLE_TTS_HKD_PER_1M_NEURAL2", 124.3864)),
    };
  }
  if (tier === "studio") {
    return {
      currency,
      billingTier: tier,
      freeCharsPerMonth: clampNonNegativeInt(envInt("GOOGLE_TTS_FREE_CHARS_STUDIO", 1_000_000)),
      hkdPer1MCharsOverFree: clampNonNegativeFloat(envFloat("GOOGLE_TTS_HKD_PER_1M_STUDIO", 1243.864)),
    };
  }
  if (tier === "chirp3-hd") {
    return {
      currency,
      billingTier: tier,
      freeCharsPerMonth: clampNonNegativeInt(envInt("GOOGLE_TTS_FREE_CHARS_CHIRP3_HD", 1_000_000)),
      hkdPer1MCharsOverFree: clampNonNegativeFloat(envFloat("GOOGLE_TTS_HKD_PER_1M_CHIRP3_HD", 233.2245)),
    };
  }
  if (tier === "chirp-voice-cloning") {
    return {
      currency,
      billingTier: tier,
      freeCharsPerMonth: clampNonNegativeInt(envInt("GOOGLE_TTS_FREE_CHARS_CHIRP_VOICE_CLONING", 0)),
      hkdPer1MCharsOverFree: clampNonNegativeFloat(
        envFloat("GOOGLE_TTS_HKD_PER_1M_CHIRP_VOICE_CLONING", 466.449),
      ),
    };
  }

  return null;
}

export function estimateHkdCostForRequest(opts: {
  pricing: GoogleTtsTierPricing;
  chars: number;
  usedCharsThisMonth: number;
}): {
  chars: number;
  usedCharsThisMonth: number;
  freeCharsPerMonth: number;
  freeRemainingChars: number;
  billableChars: number;
  hkdPer1MCharsOverFree: number;
  estimatedCostHkd: number;
} {
  const chars = clampNonNegativeInt(opts.chars);
  const used = clampNonNegativeInt(opts.usedCharsThisMonth);

  const free = clampNonNegativeInt(opts.pricing.freeCharsPerMonth);
  const remaining = Math.max(0, free - used);
  const billableChars = Math.max(0, chars - remaining);
  const rate = clampNonNegativeFloat(opts.pricing.hkdPer1MCharsOverFree);
  const estimatedCostHkd = (billableChars / 1_000_000) * rate;

  return {
    chars,
    usedCharsThisMonth: used,
    freeCharsPerMonth: free,
    freeRemainingChars: remaining,
    billableChars,
    hkdPer1MCharsOverFree: rate,
    estimatedCostHkd,
  };
}

export function monthKey(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
