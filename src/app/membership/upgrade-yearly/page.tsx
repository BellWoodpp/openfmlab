import LocaleUpgradeYearlyPage, {
  generateMetadata as generateLocaleMetadata,
} from "@/app/[locale]/membership/upgrade-yearly/page";
import { defaultLocale } from "@/i18n/types";

export default function UpgradeYearlyPage() {
  return <LocaleUpgradeYearlyPage params={Promise.resolve({ locale: defaultLocale })} />;
}

export async function generateMetadata() {
  return generateLocaleMetadata({ params: Promise.resolve({ locale: defaultLocale }) });
}

