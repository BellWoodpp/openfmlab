export const PRO_MONTHLY_TOKENS = 200_000;
export const PRO_YEARLY_TOKENS = PRO_MONTHLY_TOKENS * 12;

export type MembershipPeriod = "monthly" | "yearly";

export function membershipTokensForPeriod(period: unknown): number | null {
  if (period === "monthly") return PRO_MONTHLY_TOKENS;
  if (period === "yearly") return PRO_YEARLY_TOKENS;
  return null;
}

