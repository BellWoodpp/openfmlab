import LocaleBlogsPage, { generateMetadata as generateLocaleMetadata } from "@/app/[locale]/blogs/page";
import { defaultLocale } from "@/i18n/types";

export default function BlogsPage() {
  return <LocaleBlogsPage params={Promise.resolve({ locale: defaultLocale })} />;
}

export async function generateMetadata() {
  return generateLocaleMetadata({ params: Promise.resolve({ locale: defaultLocale }) });
}

