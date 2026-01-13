import LocaleOrdersPage, { generateMetadata as generateLocaleMetadata } from "@/app/[locale]/orders/page";
import { defaultLocale } from "@/i18n/types";

export default function OrdersPage() {
  return <LocaleOrdersPage params={Promise.resolve({ locale: defaultLocale })} />;
}

export async function generateMetadata() {
  return generateLocaleMetadata({ params: Promise.resolve({ locale: defaultLocale }) });
}

