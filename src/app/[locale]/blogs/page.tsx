import { notFound } from "next/navigation";
import { BlogsPage } from "@/components/blogs";
import { getDictionary, locales } from "@/i18n";
import Link from "next/link";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { db } from "@/lib/db/client";
import { blogs } from "@/lib/db/schema/blogs";
import { eq, and, desc } from "drizzle-orm";

interface LocaleBlogsPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export default async function LocaleBlogsPage({ params }: LocaleBlogsPageProps) {
  // 处理路由参数
  const resolvedParams = await params;
  const locale = resolvedParams.locale;
  
  // 验证locale是否有效
  const normalizedLocale = locales.find((l) => l === locale);
  
  if (!normalizedLocale) {
    notFound();
  }

  const dictionary = getDictionary(normalizedLocale);
  const hasDb = Boolean(process.env.DATABASE_URL);

  if (!hasDb) {
    const homeLabelByLocale: Partial<Record<(typeof locales)[number], string>> = {
      en: "Home",
      zh: "首页",
      es: "Inicio",
      ar: "الرئيسية",
      id: "Beranda",
      pt: "Início",
      fr: "Accueil",
      ja: "ホーム",
      ru: "Главная",
      de: "Start",
    };
    const homeLabel = homeLabelByLocale[normalizedLocale] ?? "Home";
    const homeHref = normalizedLocale === "en" ? "/" : `/${normalizedLocale}/`;

    return (
      <div className="min-h-screen bg-white dark:bg-neutral-950 px-6 py-16 sm:px-10 lg:px-16">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 flex justify-center sm:justify-start">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href={homeHref}>{homeLabel}</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Blog</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">Blog</h1>
          <p className="mt-3 text-neutral-600 dark:text-neutral-300">
            Blogs are disabled because <code className="font-mono">DATABASE_URL</code> is not configured.
          </p>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            Create a <code className="font-mono">.env.local</code> with <code className="font-mono">DATABASE_URL</code>, then restart the dev server.
          </p>
        </div>
      </div>
    );
  }
  
  // 在服务器端获取博客数据
  const blogPosts = await db
    .select()
    .from(blogs)
    .where(and(
      eq(blogs.status, "published"),
      eq(blogs.visibility, "public")
    ))
    .orderBy(desc(blogs.featured), desc(blogs.publishedAt), desc(blogs.createdAt));
  
  return <BlogsPage dictionary={dictionary} initialBlogs={blogPosts} />;
}

export function generateStaticParams() {
  // 为支持的语言生成静态参数
  return locales.map((locale) => ({ locale }));
}

// 生成元数据
export async function generateMetadata({ params }: LocaleBlogsPageProps) {
  const resolvedParams = await params;
  const locale = resolvedParams.locale;
  const normalizedLocale = locales.find((l) => l === locale);
  
  if (!normalizedLocale) {
    return {
      title: "Blog",
      description: "Explore our latest articles",
    };
  }

  const dictionary = getDictionary(normalizedLocale);
  
  return {
    title: dictionary.pages.blogs.title,
    description: dictionary.pages.blogs.subtitle,
  };
}
