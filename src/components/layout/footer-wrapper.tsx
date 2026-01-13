"use client";

import { Footer } from "./footer";
import { useLocale } from "@/hooks";
import { usePathname } from "next/navigation";

export function FooterWrapper() {
  const pathname = usePathname();
  const { locale, dictionary } = useLocale();

  const segments = (pathname ?? "").split("/").filter(Boolean);
  const lastSegment = segments.at(-1);

  const HIDE_FOOTER_SEGMENTS = new Set(["podcast-mvp", "dashboard", "profile", "membership", "orders", "points"]);

  const isAdminRoute = segments.includes("admin");
  const shouldHideFooter = (lastSegment && HIDE_FOOTER_SEGMENTS.has(lastSegment)) || segments.some((s) => HIDE_FOOTER_SEGMENTS.has(s)) || isAdminRoute;

  if (shouldHideFooter) {
    return null;
  }

  return <Footer dictionary={dictionary.footer} currentLocale={locale} />;
}
