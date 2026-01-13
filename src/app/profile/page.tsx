import LocaleProfilePage, { generateMetadata as generateLocaleMetadata } from "@/app/[locale]/profile/page";
import { defaultLocale } from "@/i18n/types";

export default function ProfilePage() {
  return <LocaleProfilePage params={Promise.resolve({ locale: defaultLocale })} />;
}

export async function generateMetadata() {
  return generateLocaleMetadata({ params: Promise.resolve({ locale: defaultLocale }) });
}

