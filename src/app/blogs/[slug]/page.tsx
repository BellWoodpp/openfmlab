import LocaleBlogDetailPage, { generateMetadata as generateLocaleMetadata } from "@/app/[locale]/blogs/[slug]/page";
import { defaultLocale } from "@/i18n/types";

interface BlogDetailPageProps {
  params: Promise<{ slug: string }>;
}

export default async function BlogDetailPage({ params }: BlogDetailPageProps) {
  const resolved = await params;
  return <LocaleBlogDetailPage params={Promise.resolve({ locale: defaultLocale, slug: resolved.slug })} />;
}

export async function generateMetadata({ params }: BlogDetailPageProps) {
  const resolved = await params;
  return generateLocaleMetadata({ params: Promise.resolve({ locale: defaultLocale, slug: resolved.slug }) });
}

