import LocaleStatusPage, { generateMetadata as generateLocaleMetadata } from "@/app/[locale]/status/page";
import { defaultLocale } from "@/i18n/types";

export default function StatusPage() {
  return <LocaleStatusPage params={Promise.resolve({ locale: defaultLocale })} />;
}

export async function generateMetadata() {
  return generateLocaleMetadata({ params: Promise.resolve({ locale: defaultLocale }) });
}

