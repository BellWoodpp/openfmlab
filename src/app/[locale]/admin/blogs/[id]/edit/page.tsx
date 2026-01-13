import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { BlogEditor } from "@/components/admin";
import { getDictionary } from "@/i18n";
import { type Locale } from "@/i18n/types";
import { auth } from "@/lib/auth/server";
import { isAdmin } from "@/lib/auth/admin";

interface AdminEditBlogPageProps {
  params: Promise<{ locale: Locale; id: string }>;
}

export default async function AdminEditBlogPage({ params }: AdminEditBlogPageProps) {
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
  return <BlogEditor dictionary={dictionary} blogId={resolvedParams.id} />;
}

export async function generateMetadata({ params }: AdminEditBlogPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const dictionary = getDictionary(resolvedParams.locale);
  return {
    title: dictionary.pages.adminBlogs.edit.title,
    description: dictionary.pages.adminBlogs.edit.subtitle,
    robots: {
      index: false,
      follow: false,
    },
  };
}
