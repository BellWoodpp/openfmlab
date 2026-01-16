import { defaultLocale, type Locale } from "@/i18n/types";

const homeLabelByLocale: Partial<Record<Locale, string>> = {
  en: "Home",
  zh: "首页",
  es: "Inicio",
  ar: "الرئيسية",
  id: "Beranda",
  pt: "Início",
  fr: "Accueil",
  ja: "ホーム",
  ru: "Главная",
  de: "Start",
};

export function getHomeLabel(locale: Locale): string {
  return homeLabelByLocale[locale] ?? homeLabelByLocale[defaultLocale] ?? "Home";
}

export function getHomeHref(locale: Locale): string {
  return locale === defaultLocale ? "/" : `/${locale}/`;
}
