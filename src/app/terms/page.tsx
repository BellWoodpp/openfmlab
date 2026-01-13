import LocaleTermsPage, { generateMetadata as generateLocaleMetadata } from "@/app/[locale]/terms/page";
import { defaultLocale } from "@/i18n/types";

export default function TermsPage() {
  return <LocaleTermsPage params={Promise.resolve({ locale: defaultLocale })} />;
}

export async function generateMetadata() {
  return generateLocaleMetadata({ params: Promise.resolve({ locale: defaultLocale }) });
}

