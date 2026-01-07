import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import clsx from "clsx";
import "./globals.css";

const jetBrainsMono = JetBrains_Mono({
  weight: "400",
  subsets: [],
  preload: true,
});

export const metadata: Metadata = {
  metadataBase: new URL('https://www.voiceslab.ai'),
  title: "Voiceslab",
  description: "AI Voice Cloning and Text-to-Speech",
  authors: [{ name: "Voiceslab" }],
  openGraph: {
    title: "Voiceslab",
    description: "AI Voice Cloning and Text-to-Speech",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Voiceslab",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={clsx("antialiased", jetBrainsMono.className)}>
        {children}
      </body>
    </html>
  );
}