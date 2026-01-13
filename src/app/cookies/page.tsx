import LocaleCookiesPage, { generateMetadata as generateLocaleMetadata } from "@/app/[locale]/cookies/page";
import { defaultLocale } from "@/i18n/types";

export default function CookiesPage() {
  return <LocaleCookiesPage params={Promise.resolve({ locale: defaultLocale })} />;
}

export async function generateMetadata() {
  return generateLocaleMetadata({ params: Promise.resolve({ locale: defaultLocale }) });
}

