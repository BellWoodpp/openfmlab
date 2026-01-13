import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import clsx from "clsx";
import { siteConfig } from "@/lib/site-config";
import "../../podcast-mvp/globals.css";

const jetBrainsMono = JetBrains_Mono({
  weight: "400",
  subsets: ["latin"],
  preload: true,
});

export const metadata: Metadata = {
  title: "Text to Speech",
  description: siteConfig.defaultDescription,
  authors: [{ name: siteConfig.brandName }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className={clsx("antialiased", jetBrainsMono.className)}>{children}</div>
  );
}

