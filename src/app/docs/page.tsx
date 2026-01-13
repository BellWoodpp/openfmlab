import LocaleDocsPage, { generateMetadata as generateLocaleMetadata } from "@/app/[locale]/docs/page";
import { defaultLocale } from "@/i18n/types";

export default function DocsPage() {
  return <LocaleDocsPage params={Promise.resolve({ locale: defaultLocale })} />;
}

export async function generateMetadata() {
  return generateLocaleMetadata({ params: Promise.resolve({ locale: defaultLocale }) });
}

