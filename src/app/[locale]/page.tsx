import { notFound } from "next/navigation";
import { HomePage } from "@/components/home/home-page";
import { getDictionary, locales } from "@/i18n";
import { siteConfig } from "@/lib/site-config";
import { defaultLocale } from "@/i18n/types";

interface LocalePageProps {
  params: Promise<{
    locale: string;
  }>;
}

export default async function LocaleHome({ params }: LocalePageProps) {
  // 处理路由参数
  const resolvedParams = await params;
  const locale = resolvedParams.locale;
  
  // 验证locale是否有效
  const normalizedLocale = locales.find((l) => l === locale);
  
  if (!normalizedLocale) {
    notFound();
  }

  return <HomePage dictionary={getDictionary(normalizedLocale)} />;
}

export function generateStaticParams() {
  // 为支持的语言生成静态参数
  return locales.map((locale) => ({ locale }));
}

// 生成元数据
export async function generateMetadata({ params }: LocalePageProps) {
  const resolvedParams = await params;
  const locale = resolvedParams.locale;
  const normalizedLocale = locales.find((l) => l === locale);
  
  if (!normalizedLocale) {
    return {
      title: { absolute: `${siteConfig.brandName} — AI Text to Speech` },
      description: "Generate natural-sounding speech from text in seconds.",
    };
  }

  const dictionary = getDictionary(normalizedLocale);
  const heroTitle = dictionary.home.heroTitle.replace(/\s*\n\s*/g, " ").trim();
  
  return {
    title: { absolute: `${siteConfig.brandName} — ${heroTitle}` },
    description: dictionary.home.heroDescription,
    alternates: {
      canonical: normalizedLocale === defaultLocale ? "/" : `/${normalizedLocale}`,
    },
    openGraph: {
      url: normalizedLocale === defaultLocale ? siteConfig.siteUrl : `${siteConfig.siteUrl}/${normalizedLocale}`,
    },
  };
}
