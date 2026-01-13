import LocaleContactPage, { generateMetadata as generateLocaleMetadata } from "@/app/[locale]/contact/page";
import { defaultLocale } from "@/i18n/types";

export default function ContactPage() {
  return <LocaleContactPage params={Promise.resolve({ locale: defaultLocale })} />;
}

export async function generateMetadata() {
  return generateLocaleMetadata({ params: Promise.resolve({ locale: defaultLocale }) });
}

