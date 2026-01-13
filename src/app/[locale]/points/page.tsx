import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth/server";
import { getDictionary, locales } from "@/i18n";
import type { Locale } from "@/i18n/types";
import { PointsTopupPage } from "@/components/points/points-topup-page";
import { checkUserPaidMembership } from "@/lib/membership";

interface PointsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function PointsPage({ params }: PointsPageProps) {
  const resolvedParams = await params;
  const locale = resolvedParams.locale;
  const normalizedLocale = locales.find((l) => l === locale);

  if (!normalizedLocale) {
    notFound();
  }

  const session = await auth.api.getSession({
    headers: await import("next/headers").then((mod) => mod.headers()),
  });

  if (!session?.user) {
    redirect(`/${normalizedLocale}/login`);
  }

  const dictionary = getDictionary(normalizedLocale as Locale);
  const membership = await checkUserPaidMembership(session.user.id);

  if (!membership.isPaid) {
    const copyByLocale: Partial<Record<Locale, { title: string; desc: string; cta: string }>> = {
      en: {
        title: "Professional required",
        desc: "Credits top-up is available in Professional mode only. Upgrade to Professional first.",
        cta: "View plans",
      },
      zh: {
        title: "需要专业版",
        desc: "积分充值仅在专业版模式下可用，请先升级到专业版。",
        cta: "查看套餐",
      },
      ja: {
        title: "Professional が必要です",
        desc: "クレジットチャージは Professional モードでのみ利用できます。先にアップグレードしてください。",
        cta: "プランを見る",
      },
    };

    const copy = copyByLocale[normalizedLocale as Locale] ?? copyByLocale.en!;
    const pricingHref = normalizedLocale === "en" ? "/pricing" : `/${normalizedLocale}/pricing`;

    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">{copy.title}</h1>
          <p className="mt-3 text-neutral-600 dark:text-neutral-400">{copy.desc}</p>
          <div className="mt-6">
            <a
              href={pricingHref}
              className="inline-flex items-center justify-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              {copy.cta}
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!process.env.DATABASE_URL) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            {dictionary.pages.points.title}
          </h1>
          <p className="mt-3 text-neutral-600 dark:text-neutral-400">{dictionary.pages.points.errors.dbRequired}</p>
        </div>
      </div>
    );
  }

  return <PointsTopupPage locale={normalizedLocale as Locale} dict={dictionary.pages.points} />;
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: PointsPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const locale = resolvedParams.locale;
  const normalizedLocale = locales.find((l) => l === locale);

  if (!normalizedLocale) {
    return {
      title: "Credits Top-up",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const dictionary = getDictionary(normalizedLocale as Locale);
  return {
    title: dictionary.pages.points.title,
    description: dictionary.pages.points.description,
    robots: {
      index: false,
      follow: false,
    },
  };
}
