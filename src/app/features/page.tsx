import LocaleFeaturesPage, { generateMetadata as generateLocaleMetadata } from "@/app/[locale]/features/page";
import { defaultLocale } from "@/i18n/types";

export default function FeaturesPage() {
  return <LocaleFeaturesPage params={Promise.resolve({ locale: defaultLocale })} />;
}

export async function generateMetadata() {
  return generateLocaleMetadata({ params: Promise.resolve({ locale: defaultLocale }) });
}

