import LocaleSignupPage, { generateMetadata as generateLocaleMetadata } from "@/app/[locale]/signup/page";
import { defaultLocale } from "@/i18n/types";

export default function SignupPage() {
  return <LocaleSignupPage params={Promise.resolve({ locale: defaultLocale })} />;
}

export async function generateMetadata() {
  return generateLocaleMetadata({ params: Promise.resolve({ locale: defaultLocale }) });
}

