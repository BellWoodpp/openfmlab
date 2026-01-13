import LocalePointsPage, { generateMetadata as generateLocaleMetadata } from "@/app/[locale]/points/page";
import { defaultLocale } from "@/i18n/types";

export default function PointsPage() {
  return <LocalePointsPage params={Promise.resolve({ locale: defaultLocale })} />;
}

export async function generateMetadata() {
  return generateLocaleMetadata({ params: Promise.resolve({ locale: defaultLocale }) });
}

