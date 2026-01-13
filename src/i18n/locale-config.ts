import type { Locale } from "@/i18n/types";

const intlLocaleMap: Record<Locale, string> = {
  en: "en-US",
  zh: "zh-CN",
  es: "es-ES",
  ar: "ar-SA",
  id: "id-ID",
  pt: "pt-BR",
  fr: "fr-FR",
  ja: "ja-JP",
  ru: "ru-RU",
  de: "de-DE",
};

export function resolveIntlLocale(locale: string | Locale | undefined): string {
  if (locale && Object.prototype.hasOwnProperty.call(intlLocaleMap, locale)) {
    return intlLocaleMap[locale as Locale];
  }
  return intlLocaleMap.en;
}

// Some locales (e.g. Arabic) default to non-Latin digits which can look like garbled glyphs
// depending on the active font fallback in the UI. For numeric UI counters, prefer Latin digits.
export function resolveIntlNumberLocale(locale: string | Locale | undefined): string {
  if (locale === "ar") return intlLocaleMap.en;
  return resolveIntlLocale(locale);
}
