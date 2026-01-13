import type { RefundPolicyConfig } from "@/lib/refunds/calc";

function numEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function getRefundPolicyConfig(): RefundPolicyConfig {
  // Defaults are conservative. Adjust via env vars if needed.
  const monthlyCycleDays = Math.max(1, Math.floor(numEnv("REFUND_MONTHLY_CYCLE_DAYS", 30)));
  const yearlyCycleMonths = Math.max(1, Math.floor(numEnv("REFUND_YEARLY_CYCLE_MONTHS", 12)));

  const feeRate = Math.min(1, Math.max(0, numEnv("REFUND_FEE_RATE", 0.05)));
  const feeFixedCents = Math.max(0, Math.floor(numEnv("REFUND_FEE_FIXED_CENTS", 0)));

  const nonRefundableBaseTokens = Math.max(0, Math.floor(numEnv("REFUND_NON_REFUNDABLE_BASE_TOKENS", 500)));

  return {
    monthlyCycleDays,
    yearlyCycleMonths,
    feeRate,
    feeFixedCents,
    nonRefundableBaseTokens,
  };
}
