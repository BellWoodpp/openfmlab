import type { TtsBillingTier, TtsProvider } from "@/lib/tts";
import { getGoogleTtsPricingForTier } from "@/lib/tts-pricing";

function envFloat(name: string): number | null {
  const raw = process.env[name];
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return n;
}

function envInt(name: string): number | null {
  const raw = process.env[name];
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.floor(n);
}

function clampPositiveFloat(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return value;
}

function clampPositiveInt(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
}

export function getCharsPerToken(): number {
  return clampPositiveInt(envInt("TTS_TOKEN_CHARS_PER_TOKEN") ?? 4, 4);
}

export function estimateBaseTokens(chars: number): number {
  const safeChars = Math.max(0, Math.floor(chars));
  if (safeChars === 0) return 0;
  return Math.max(1, Math.ceil(safeChars / getCharsPerToken()));
}

function tierEnvKey(tier: TtsBillingTier): string {
  const normalized = tier.replace(/[^a-z0-9]+/gi, "_").toUpperCase();
  return `TTS_TIER_MULTIPLIER_${normalized}`;
}

export function getTokenMultiplier(opts: { provider: TtsProvider; billingTier: TtsBillingTier }): number {
  const override = envFloat(tierEnvKey(opts.billingTier));
  if (override !== null) return clampPositiveFloat(override, 1);

  if (opts.provider !== "google") return 1;

  // Default multipliers: derived from Google HKD overage rates relative to Standard.
  const standard = getGoogleTtsPricingForTier("standard");
  const tierPricing = getGoogleTtsPricingForTier(opts.billingTier);

  if (opts.billingTier === "unknown") return 4;
  if (!standard || !tierPricing) return 1;
  const ratio = tierPricing.hkdPer1MCharsOverFree / standard.hkdPer1MCharsOverFree;
  return clampPositiveFloat(ratio, 1);
}

export function estimateTokensForRequest(opts: {
  provider: TtsProvider;
  billingTier: TtsBillingTier;
  chars: number;
}): {
  charsPerToken: number;
  baseTokens: number;
  multiplier: number;
  tokens: number;
} {
  const charsPerToken = getCharsPerToken();
  const baseTokens = estimateBaseTokens(opts.chars);
  if (baseTokens === 0) {
    return { charsPerToken, baseTokens: 0, multiplier: 1, tokens: 0 };
  }
  const multiplier = getTokenMultiplier({ provider: opts.provider, billingTier: opts.billingTier });
  const tokens = Math.max(1, Math.ceil(baseTokens * multiplier));
  return { charsPerToken, baseTokens, multiplier, tokens };
}
