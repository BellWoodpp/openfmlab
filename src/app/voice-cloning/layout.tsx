import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import clsx from "clsx";
import "../podcast-mvp/globals.css";

const jetBrainsMono = JetBrains_Mono({
  weight: "400",
  subsets: [],
  preload: true,
});

export const metadata: Metadata = {
  title: "Voice Cloning",
  description: "High quality AI voice cloning.",
};

export default function VoiceCloningLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className={clsx("antialiased", jetBrainsMono.className)}>{children}</div>
  );
}
