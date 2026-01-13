import LocaleUpgradeSuccessPage, {
  generateMetadata as generateLocaleMetadata,
} from "@/app/[locale]/membership/upgrade-success/page";
import { defaultLocale } from "@/i18n/types";

interface PageProps {
  params: Promise<Record<string, never>>;
}

export default function UpgradeSuccessPage({ params }: PageProps) {
  void params;
  return <LocaleUpgradeSuccessPage params={Promise.resolve({ locale: defaultLocale })} />;
}

export async function generateMetadata() {
  return generateLocaleMetadata({ params: Promise.resolve({ locale: defaultLocale }) });
}

