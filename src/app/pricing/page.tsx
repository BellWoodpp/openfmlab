import LocalePricingPage, { generateMetadata as generateLocaleMetadata } from "@/app/[locale]/pricing/page";
import { defaultLocale } from "@/i18n/types";

export default function PricingPage() {
  return <LocalePricingPage params={Promise.resolve({ locale: defaultLocale })} />;
}

export async function generateMetadata() {
  return generateLocaleMetadata({ params: Promise.resolve({ locale: defaultLocale }) });
}

