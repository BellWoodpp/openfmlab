import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { BlogEditor } from "@/components/admin";
import { getDictionary } from "@/i18n";
import { type Locale } from "@/i18n/types";
import { auth } from "@/lib/auth/server";
import { isAdmin } from "@/lib/auth/admin";

interface AdminNewBlogPageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function AdminNewBlogPage({ params }: AdminNewBlogPageProps) {
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
  return <BlogEditor dictionary={dictionary} />;
}

export async function generateMetadata({ params }: AdminNewBlogPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const dictionary = getDictionary(resolvedParams.locale);
  return {
    title: dictionary.pages.adminBlogs.edit.actions.create,
    description: dictionary.pages.adminBlogs.subtitle,
    robots: {
      index: false,
      follow: false,
    },
  };
}
