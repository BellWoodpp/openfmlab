export type RefundProductKind = "membership_monthly" | "membership_yearly" | "points";

export type RefundEstimate = {
  ok: true;
  kind: RefundProductKind;
  currency: string;
  originalAmountCents: number;
  refundableAmountCents: number;
  feeCents: number;
  netRefundCents: number;
  details: Record<string, string | number | boolean | null>;
};

export type RefundEstimateError = {
  ok: false;
  error: string;
};

export type RefundPolicyConfig = {
  monthlyCycleDays: number; // e.g. 30
  yearlyCycleMonths: number; // e.g. 12
  feeRate: number; // 0-1, applied on refundable amount
  feeFixedCents: number; // applied on top of feeRate
  nonRefundableBaseTokens: number; // default/free tokens not refundable
};

function clampInt(value: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function toCents(amount: string | number): number {
  if (typeof amount === "number" && Number.isFinite(amount)) {
    return Math.round(amount * 100);
  }
  if (typeof amount === "string") {
    const n = Number(amount);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100);
  }
  return 0;
}

function diffDays(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const targetMonth = d.getMonth() + months;
  d.setMonth(targetMonth);
  return d;
}

function diffWholeMonths(from: Date, to: Date): number {
  // Count whole months since `from` ignoring days.
  const years = to.getFullYear() - from.getFullYear();
  const months = to.getMonth() - from.getMonth();
  let total = years * 12 + months;
  // If we haven't reached the "anniversary day" in the current month, subtract one month.
  const fromDay = from.getDate();
  const toDay = to.getDate();
  if (toDay < fromDay) total -= 1;
  return Math.max(0, total);
}

function calcFeeCents(refundableAmountCents: number, cfg: RefundPolicyConfig): number {
  const rateFee = Math.round(refundableAmountCents * clampInt(cfg.feeRate * 10_000, 0, 10_000) / 10_000);
  const fixed = clampInt(cfg.feeFixedCents, 0, 1_000_000_000);
  return clampInt(rateFee + fixed, 0, refundableAmountCents);
}

export function estimateMembershipTokensRefund(opts: {
  kind: "membership_monthly" | "membership_yearly";
  amount: string | number;
  currency: string;
  tokensPurchased: number;
  userAvailableTokens: number;
  now: Date;
  cfg: RefundPolicyConfig;
}): RefundEstimate {
  const originalAmountCents = toCents(opts.amount);
  const tokensPurchased = clampInt(opts.tokensPurchased, 0, 2_000_000_000);
  const available = clampInt(opts.userAvailableTokens, 0, 2_000_000_000);
  const nonRefundable = clampInt(Math.min(available, opts.cfg.nonRefundableBaseTokens), 0, available);
  const refundableTokensTotal = clampInt(available - nonRefundable, 0, available);
  const refundableTokensThisOrder = clampInt(Math.min(refundableTokensTotal, tokensPurchased), 0, tokensPurchased);

  const centsPerToken = tokensPurchased > 0 ? originalAmountCents / tokensPurchased : 0;
  const refundableAmountCents = Math.round(refundableTokensThisOrder * centsPerToken);
  const feeCents = calcFeeCents(refundableAmountCents, opts.cfg);
  const netRefundCents = clampInt(refundableAmountCents - feeCents, 0, refundableAmountCents);

  return {
    ok: true,
    kind: opts.kind,
    currency: opts.currency,
    originalAmountCents,
    refundableAmountCents,
    feeCents,
    netRefundCents,
    details: {
      tokensPurchased,
      refundableTokens: refundableTokensThisOrder,
      userAvailableTokens: available,
      nonRefundableBaseTokens: opts.cfg.nonRefundableBaseTokens,
      centsPerToken: Number.isFinite(centsPerToken) ? centsPerToken : 0,
      calculatedAt: opts.now.toISOString(),
    },
  };
}

export function estimateMembershipMonthlyRefund(opts: {
  amount: string | number;
  currency: string;
  paidAt: Date;
  now: Date;
  cfg: RefundPolicyConfig;
}): RefundEstimate {
  const originalAmountCents = toCents(opts.amount);
  const usedDays = clampInt(diffDays(opts.paidAt, opts.now), 0, opts.cfg.monthlyCycleDays);
  const remainingDays = clampInt(opts.cfg.monthlyCycleDays - usedDays, 0, opts.cfg.monthlyCycleDays);
  const refundableAmountCents = Math.round(originalAmountCents * (remainingDays / opts.cfg.monthlyCycleDays));
  const feeCents = calcFeeCents(refundableAmountCents, opts.cfg);
  const netRefundCents = clampInt(refundableAmountCents - feeCents, 0, refundableAmountCents);
  return {
    ok: true,
    kind: "membership_monthly",
    currency: opts.currency,
    originalAmountCents,
    refundableAmountCents,
    feeCents,
    netRefundCents,
    details: {
      usedDays,
      remainingDays,
      cycleDays: opts.cfg.monthlyCycleDays,
    },
  };
}

export function estimateMembershipYearlyRefund(opts: {
  amountPaid: string | number;
  amountList?: string | number;
  currency: string;
  paidAt: Date;
  now: Date;
  cfg: RefundPolicyConfig;
}): RefundEstimate {
  const paidAmountCents = toCents(opts.amountPaid);
  const listAmountCents = opts.amountList !== undefined ? toCents(opts.amountList) : paidAmountCents;
  const wholeMonths = clampInt(diffWholeMonths(opts.paidAt, opts.now), 0, opts.cfg.yearlyCycleMonths);
  const currentCycleStart = addMonths(opts.paidAt, wholeMonths);
  const nextCycleStart = addMonths(currentCycleStart, 1);
  const midpoint = new Date(currentCycleStart.getTime() + (nextCycleStart.getTime() - currentCycleStart.getTime()) / 2);

  const countCurrentMonth =
    opts.now.getTime() >= midpoint.getTime() &&
    wholeMonths < opts.cfg.yearlyCycleMonths;

  const usedMonths = clampInt(wholeMonths + (countCurrentMonth ? 1 : 0), 0, opts.cfg.yearlyCycleMonths);
  const remainingMonths = clampInt(opts.cfg.yearlyCycleMonths - usedMonths, 0, opts.cfg.yearlyCycleMonths);

  // If the yearly plan was purchased with a discount, refund is prorated using the original list price
  // (i.e. discount is forfeited upon cancellation).
  const usedValueCents = Math.round((listAmountCents * usedMonths) / opts.cfg.yearlyCycleMonths);
  const refundableAmountCents = clampInt(paidAmountCents - usedValueCents, 0, paidAmountCents);
  const feeCents = calcFeeCents(refundableAmountCents, opts.cfg);
  const netRefundCents = clampInt(refundableAmountCents - feeCents, 0, refundableAmountCents);

  return {
    ok: true,
    kind: "membership_yearly",
    currency: opts.currency,
    originalAmountCents: paidAmountCents,
    refundableAmountCents,
    feeCents,
    netRefundCents,
    details: {
      paidAmountCents,
      basisYearlyCents: listAmountCents,
      discountForfeited: listAmountCents > paidAmountCents,
      usedValueCents,
      usedMonths,
      remainingMonths,
      cycleMonths: opts.cfg.yearlyCycleMonths,
      countCurrentMonth,
      cycleMonthMidpoint: midpoint.toISOString(),
    },
  };
}

export function estimatePointsRefund(opts: {
  amount: string | number;
  currency: string;
  creditsPurchased: number;
  userAvailableTokens: number;
  now: Date;
  cfg: RefundPolicyConfig;
}): RefundEstimate {
  const originalAmountCents = toCents(opts.amount);
  const creditsPurchased = clampInt(opts.creditsPurchased, 0, 1_000_000_000);
  const available = clampInt(opts.userAvailableTokens, 0, 1_000_000_000);
  const nonRefundable = clampInt(Math.min(available, opts.cfg.nonRefundableBaseTokens), 0, available);
  const refundableCreditsTotal = clampInt(available - nonRefundable, 0, available);
  const refundableCreditsThisOrder = clampInt(Math.min(refundableCreditsTotal, creditsPurchased), 0, creditsPurchased);

  const centsPerCredit = creditsPurchased > 0 ? originalAmountCents / creditsPurchased : 0;
  const refundableAmountCents = Math.round(refundableCreditsThisOrder * centsPerCredit);
  const feeCents = calcFeeCents(refundableAmountCents, opts.cfg);
  const netRefundCents = clampInt(refundableAmountCents - feeCents, 0, refundableAmountCents);

  return {
    ok: true,
    kind: "points",
    currency: opts.currency,
    originalAmountCents,
    refundableAmountCents,
    feeCents,
    netRefundCents,
    details: {
      creditsPurchased,
      refundableCredits: refundableCreditsThisOrder,
      userAvailableTokens: available,
      nonRefundableBaseTokens: opts.cfg.nonRefundableBaseTokens,
      centsPerCredit: Number.isFinite(centsPerCredit) ? centsPerCredit : 0,
    },
  };
}
