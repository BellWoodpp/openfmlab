import type { Metadata } from "next";

import type { Locale } from "@/i18n/types";
import { UpgradeSuccessPanel } from "@/components/membership/upgrade-success-panel";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === "zh" ? "升级成功" : "Upgrade Successful",
    robots: { index: false, follow: false },
  };
}

export default async function UpgradeSuccessPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  return <UpgradeSuccessPanel locale={locale} />;
}

