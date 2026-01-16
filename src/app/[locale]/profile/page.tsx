import { Metadata } from "next";
import { auth } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Calendar, Shield } from "lucide-react";
import { getDictionary } from "@/i18n";
import { type Locale } from "@/i18n/types";
import { UserAvatar } from "@/components/user/user-avatar";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { getHomeHref, getHomeLabel } from "@/lib/breadcrumbs";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const dictionary = getDictionary(resolvedParams.locale);
  
  return {
    title: dictionary.pages.profile.title,
    description: dictionary.pages.profile.description,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function ProfilePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const resolvedParams = await params;
  const session = await auth.api.getSession({
    headers: await import("next/headers").then((mod) => mod.headers()),
  });

  if (!session?.user) {
    redirect(`/${resolvedParams.locale}/login`);
  }

  const user = session.user;
  const dictionary = getDictionary(resolvedParams.locale);
  const homeHref = getHomeHref(resolvedParams.locale);
  const homeLabel = getHomeLabel(resolvedParams.locale);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href={homeHref}>{homeLabel}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{dictionary.header.userMenu.profile}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
            {dictionary.pages.profile.subtitle}
          </h1>
          <p className="mt-2 text-neutral-600 dark:text-neutral-400">
            {dictionary.pages.profile.description}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* 基本信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {dictionary.pages.profile.basicInfo.title}
              </CardTitle>
              <CardDescription>
                {dictionary.pages.profile.basicInfo.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <UserAvatar
                  src={user.image}
                  name={user.name}
                  email={user.email}
                  size={48}
                  className="h-12 w-12"
                />
                <div>
                  <p className="font-medium text-neutral-900 dark:text-neutral-100">
                    {user.name || dictionary.pages.profile.noNameSet}
                  </p>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    {user.email}
                  </p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-neutral-500" />
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">
                    {dictionary.pages.profile.basicInfo.emailLabel}
                  </span>
                </div>
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {user.email}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-neutral-500" />
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                  {dictionary.pages.profile.basicInfo.registrationDate}
                </span>
              </div>
              <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                {user.createdAt ? new Date(user.createdAt).toLocaleDateString(resolvedParams.locale === 'zh' ? 'zh-CN' : resolvedParams.locale === 'ja' ? 'ja-JP' : 'en-US') : dictionary.pages.profile.basicInfo.unknown}
              </p>
            </CardContent>
          </Card>

          {/* 账户状态 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {dictionary.pages.profile.accountStatus.title}
              </CardTitle>
              <CardDescription>
                {dictionary.pages.profile.accountStatus.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                  {dictionary.pages.profile.accountStatus.emailVerification}
                </span>
                <Badge variant={user.emailVerified ? "default" : "secondary"}>
                  {user.emailVerified ? dictionary.pages.profile.accountStatus.verified : dictionary.pages.profile.accountStatus.unverified}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                  {dictionary.pages.profile.accountStatus.accountStatus}
                </span>
                <Badge variant="default">
                  {dictionary.pages.profile.accountStatus.normal}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                  {dictionary.pages.profile.accountStatus.loginMethod}
                </span>
                <Badge variant="outline">
                  {user.image ? dictionary.pages.profile.accountStatus.oauth : dictionary.pages.profile.accountStatus.emailLogin}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
