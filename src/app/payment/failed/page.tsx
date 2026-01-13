import LocalePaymentFailedPage, { generateMetadata as generateLocaleMetadata } from "@/app/[locale]/payment/failed/page";
import { defaultLocale } from "@/i18n/types";

export default function PaymentFailedPage() {
  return <LocalePaymentFailedPage params={Promise.resolve({ locale: defaultLocale })} />;
}

export async function generateMetadata() {
  return generateLocaleMetadata({ params: Promise.resolve({ locale: defaultLocale }) });
}

