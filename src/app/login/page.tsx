import LocaleLoginPage, { generateMetadata as generateLocaleMetadata } from "@/app/[locale]/login/page";
import { defaultLocale } from "@/i18n/types";

export default function LoginPage() {
  return <LocaleLoginPage params={Promise.resolve({ locale: defaultLocale })} />;
}

export async function generateMetadata() {
  return generateLocaleMetadata({ params: Promise.resolve({ locale: defaultLocale }) });
}

