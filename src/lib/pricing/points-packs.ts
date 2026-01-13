import { getPricingConfig } from "@/lib/pricing/i18n-config";
import type { Locale } from "@/i18n/types";

export type PointsPackId = `x${number}`;

export interface PointsPack {
  id: PointsPackId;
  credits: number;
  originalCredits: number;
  price: number;
  currency: string;
  title: string;
  description: string;
  units?: number;
  bonusPercent?: number;
}

function resolveCurrency(locale: Locale): string {
  return getPricingConfig(locale).currency;
}

export function getPointsPacks(locale: Locale): PointsPack[] {
  const currency = resolveCurrency(locale);

  const topupTitleByLocale: Partial<Record<Locale, { one: string; multi: (n: number) => string }>> = {
    en: { one: "Top up", multi: (n) => `Top up x${n}` },
    zh: { one: "充值", multi: (n) => `充值 x${n}` },
    ja: { one: "チャージ", multi: (n) => `チャージ x${n}` },
    es: { one: "Recargar", multi: (n) => `Recargar x${n}` },
    ar: { one: "إعادة الشحن", multi: (n) => `إعادة الشحن x${n}` },
    id: { one: "Isi ulang", multi: (n) => `Isi ulang x${n}` },
    pt: { one: "Recarregar", multi: (n) => `Recarregar x${n}` },
    fr: { one: "Recharger", multi: (n) => `Recharger x${n}` },
    ru: { one: "Пополнить", multi: (n) => `Пополнить x${n}` },
    de: { one: "Aufladen", multi: (n) => `Aufladen x${n}` },
  };

  const topupDescByLocale: Partial<Record<Locale, string>> = {
    en: "Best used when your plan credits aren’t enough.",
    zh: "适合在积分不足时快速补充。",
    ja: "クレジットが足りない時に補充できます。",
    es: "Ideal cuando tus créditos no son suficientes.",
    ar: "مناسب عندما لا تكفي أرصدتك.",
    id: "Cocok saat kredit paketmu tidak cukup.",
    pt: "Ideal quando seus créditos não são suficientes.",
    fr: "Idéal lorsque vos crédits ne suffisent pas.",
    ru: "Подходит, когда кредитов не хватает.",
    de: "Ideal, wenn deine Credits nicht reichen.",
  };

  const titleCopy = topupTitleByLocale[locale] ?? topupTitleByLocale.en!;
  const description = topupDescByLocale[locale] ?? topupDescByLocale.en!;

  // Base is $3. Add larger packs up to $72 (x24).
  const options = Array.from({ length: 24 }, (_, i) => i + 1);
  const makeTitle = (units: number) => (units === 1 ? titleCopy.one : titleCopy.multi(units));

  // USD / EUR billing (Creem only supports USD/EUR currently).
  const basePrice = 3;
  const baseCredits = 100_000;

  return options.map((units) => {
    // Progressive bonus: starts at $15 (x5) => 1% and increases by +1% per +$3, capped at 20% for $72 (x24).
    const bonusPercent = Math.max(0, Math.min(20, units - 4));
    const originalCredits = baseCredits * units;
    const credits = Math.round(originalCredits * (1 + bonusPercent / 100));

    return {
      id: `x${units}` as PointsPackId,
      units,
      credits,
      originalCredits,
      price: basePrice * units,
      currency,
      title: makeTitle(units),
      description,
      bonusPercent: bonusPercent > 0 ? bonusPercent : undefined,
    };
  });
}

export function findPointsPack(locale: Locale, packId: string): PointsPack | null {
  const packs = getPointsPacks(locale);
  const match = packs.find((pack) => pack.id === packId);
  return match ?? null;
}
