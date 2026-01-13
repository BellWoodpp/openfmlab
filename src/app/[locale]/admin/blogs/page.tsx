import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { BlogsList } from "@/components/admin";
import { getDictionary } from "@/i18n";
import { type Locale } from "@/i18n/types";
import { auth } from "@/lib/auth/server";
import { isAdmin } from "@/lib/auth/admin";

interface AdminBlogsPageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function AdminBlogsPage({ params }: AdminBlogsPageProps) {
  const resolvedParams = await params;
  const locale = resolvedParams.locale;
  const homeHref = locale === "en" ? "/" : `/${locale}/`;
  const loginHref = locale === "en" ? "/login" : `/${locale}/login`;

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect(loginHref);
  }

  if (!isAdmin(session.user.email)) {
    redirect(homeHref);
  }

  const dictionary = getDictionary(locale);
  return <BlogsList dictionary={dictionary} />;
}

export async function generateMetadata({ params }: AdminBlogsPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const dictionary = getDictionary(resolvedParams.locale);
  return {
    title: dictionary.pages.adminBlogs.title,
    description: dictionary.pages.adminBlogs.description,
    robots: {
      index: false,
      follow: false,
    },
  };
}
