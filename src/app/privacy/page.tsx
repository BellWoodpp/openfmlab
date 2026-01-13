import LocalePrivacyPage, { generateMetadata as generateLocaleMetadata } from "@/app/[locale]/privacy/page";
import { defaultLocale } from "@/i18n/types";

export default function PrivacyPage() {
  return <LocalePrivacyPage params={Promise.resolve({ locale: defaultLocale })} />;
}

export async function generateMetadata() {
  return generateLocaleMetadata({ params: Promise.resolve({ locale: defaultLocale }) });
}

