// 导入HomePage
// 导入getDictionary, defaultLocale
// 导入类型元数据Metadata

import { HomePage } from "@/components/home/home-page";
import { getDictionary, defaultLocale } from "@/i18n";
import type { Metadata } from "next";

export default function RootPage() {
  // 直接使用默认语言显示首页内容
  // getDictionary(defaultLocale)立刻去拿一份“翻译词典”，语言是 defaultLocale（默认语言，比如 'en' 英文 或 'zh' 中文）获取当前语言的文字
  // dictionary={ ... }把拿到的这本翻译词典作为 props（道具）传给 HomePage 组件让首页能显示正确语言
  return <HomePage dictionary={getDictionary(defaultLocale)} />;
}

// 生成元数据
export const metadata: Metadata = {
  title: "ShipBase - Enable secure sign-in methods for Shipbase",
  description: "Integrate Google and GitHub OAuth plus Magic Link email sign-in through Better Auth. Sessions stay on the server and automatically sync via HTTP-only cookies.",
};
