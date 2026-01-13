import LocaleIntegrationsPage, { generateMetadata as generateLocaleMetadata } from "@/app/[locale]/integrations/page";
import { defaultLocale } from "@/i18n/types";

export default function IntegrationsPage() {
  return <LocaleIntegrationsPage params={Promise.resolve({ locale: defaultLocale })} />;
}

export async function generateMetadata() {
  return generateLocaleMetadata({ params: Promise.resolve({ locale: defaultLocale }) });
}

