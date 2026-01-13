import LocaleDashboardPage, { generateMetadata as generateLocaleMetadata } from "@/app/[locale]/dashboard/page";
import { defaultLocale } from "@/i18n/types";

export default function DashboardPage() {
  return <LocaleDashboardPage params={Promise.resolve({ locale: defaultLocale })} />;
}

export async function generateMetadata() {
  return generateLocaleMetadata({ params: Promise.resolve({ locale: defaultLocale }) });
}

