import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import clsx from "clsx";
import { siteConfig } from "@/lib/site-config";
import "../podcast-mvp/globals.css";

const jetBrainsMono = JetBrains_Mono({
  weight: "400",
  subsets: [],
  preload: true,
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.siteUrl),
  title: `${siteConfig.brandName} — Voice Cloning`,
  description: "High quality AI voice cloning.",
};

export default function VoiceCloningLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={clsx("antialiased", jetBrainsMono.className)}>{children}</body>
    </html>
  );
}
