// 导入元数据
// 导入Geist, Geist_Mono字体
// 导入全局css
// 导入Header,FooterWrapper

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header, FooterWrapper } from "@/components/layout";
import { siteConfig } from "@/lib/site-config";
import { defaultLocale } from "@/i18n/types";
import Script from "next/script";
import { assetUrl } from "@/lib/asset-url";

// 声明常量geistSans
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// 声明常量geistMono
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 暴露常量metadata
export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.siteUrl),
  title: {
    default: `${siteConfig.brandName} — AI Text-to-Speech`,
    template: `%s — ${siteConfig.brandName}`,
  },
  description: siteConfig.defaultDescription,
  icons: {
    icon: [
      { url: assetUrl("/photo/text-to-speech.ico"), type: "image/x-icon" },
    ],
    apple: [
      { url: assetUrl("/photo/text-to-speech.png"), type: "image/png" },
    ],
    shortcut: [
      { url: assetUrl("/photo/text-to-speech.ico"), type: "image/x-icon" },
    ],
  },
  openGraph: {
    type: "website",
    url: siteConfig.siteUrl,
    siteName: siteConfig.brandName,
    title: siteConfig.brandName,
    description: siteConfig.defaultDescription,
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: `${siteConfig.brandName} — ${siteConfig.defaultDescription}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.brandName,
    description: siteConfig.defaultDescription,
    images: ["/api/og"],
  },
};

// 暴露默认函数RootLayout
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning：抑制水和警告
    <html lang={defaultLocale} suppressHydrationWarning>
      <head>
        {/* 1. dangerouslySetInnerHTML：危险，设置内部HTML：加了它，脚本才能在 React 水和之前抢先执行 → 从第一帧开始就是正确的黑/白 → 丝滑无闪！
            2. const theme = localStorage.getItem('theme'); 先去 localStorage 看看你上次选的是啥主题
            3. 默认走 dark：只有当你明确选择 light 时才变白。
            4. 如果你选择 system，则跟随系统主题。
            6. catch (e) {} 万一 localStorage 被禁用（有些人开无痕模式），直接忽略错误}
            */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('theme');
                document.documentElement.classList.remove('light', 'dark');
                if (theme === 'light') {
                  // Default :root is light; keep no .dark class
                } else if (theme === 'system') {
                  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  document.documentElement.classList.add(systemTheme);
                } else {
                  // Default to dark unless explicitly set to light
                  document.documentElement.classList.add('dark');
                }
              } catch (e) {}
            `,
          }}
        />
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-7N4LVQSRPM" strategy="afterInteractive" />
        <Script id="google-tag" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', 'G-7N4LVQSRPM');
          `}
        </Script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="flex min-h-screen flex-col">
          <Header />
          {/* flex-1 = “我是一个弹性盒子里的孩子，请把父容器里除掉兄弟们固定高度后，剩下的所有空间都给我！” */}
          <main className="flex-1">
            {children}
          </main>
          <FooterWrapper />
        </div>
      </body>
    </html>
  );
}
