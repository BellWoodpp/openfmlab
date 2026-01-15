// 导入HomePage
// 导入getDictionary, defaultLocale
// 导入类型元数据Metadata

import type { Metadata } from "next";

import { HomePage } from "@/components/home/home-page";
import { getDictionary, defaultLocale } from "@/i18n";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
  openGraph: {
    url: siteConfig.siteUrl,
  },
};


export default function RootPage() {
  // 直接使用默认语言显示首页内容
  // getDictionary(defaultLocale)立刻去拿一份“翻译词典”，语言是 defaultLocale（默认语言，比如 'en' 英文 或 'zh' 中文）获取当前语言的文字
  // dictionary={ ... }把拿到的这本翻译词典作为 props（道具）传给 HomePage 组件让首页能显示正确语言
  return <HomePage dictionary={getDictionary(defaultLocale)} />;
}
