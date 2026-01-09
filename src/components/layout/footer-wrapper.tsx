"use client";

import { Footer } from "./footer";
import { useLocale } from "@/hooks";
import { usePathname } from "next/navigation";

export function FooterWrapper() {
  const pathname = usePathname();
  const { locale, dictionary } = useLocale();

  const lastSegment = pathname.split("/").filter(Boolean).at(-1);
  if (lastSegment === "podcast-mvp") {
    return null;
  }

  return <Footer dictionary={dictionary.footer} currentLocale={locale} />;
}
