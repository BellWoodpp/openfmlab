import LocalePaymentSuccessPage, { generateMetadata as generateLocaleMetadata } from "@/app/[locale]/payment/success/page";
import { defaultLocale } from "@/i18n/types";

interface PaymentSuccessPageProps {
  searchParams: Promise<{
    request_id?: string;
    checkout_id?: string;
    order_id?: string;
    customer_id?: string;
    product_id?: string;
    signature?: string;
  }>;
}

export default function PaymentSuccessPage({ searchParams }: PaymentSuccessPageProps) {
  return (
    <LocalePaymentSuccessPage
      params={Promise.resolve({ locale: defaultLocale })}
      searchParams={searchParams}
    />
  );
}

export async function generateMetadata() {
  return generateLocaleMetadata({
    params: Promise.resolve({ locale: defaultLocale }),
    searchParams: Promise.resolve({}),
  });
}

