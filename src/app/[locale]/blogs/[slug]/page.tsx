import { notFound } from "next/navigation";
import { locales } from "@/i18n";
import { BlogDetail } from "@/components/blogs/blog-detail";
import Link from "next/link";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { db } from "@/lib/db/client";
import { blogs } from "@/lib/db/schema/blogs";
import { eq, and } from "drizzle-orm";

interface BlogDetailPageProps {
  params: Promise<{
    locale: string;
    slug: string;
  }>;
}

export default async function BlogDetailPage({ params }: BlogDetailPageProps) {
  const resolvedParams = await params;
  const locale = resolvedParams.locale;
  const slug = resolvedParams.slug;
  
  // 验证locale是否有效
  const normalizedLocale = locales.find((l) => l === locale);
  
  if (!normalizedLocale) {
    notFound();
  }

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
    const blogsHref = normalizedLocale === "en" ? "/blogs" : `/${normalizedLocale}/blogs`;

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
                  <BreadcrumbLink asChild>
                    <Link href={blogsHref}>Blog</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Not available</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">Blog</h1>
          <p className="mt-3 text-neutral-600 dark:text-neutral-300">
            Blog posts are unavailable because <code className="font-mono">DATABASE_URL</code> is not configured.
          </p>
        </div>
      </div>
    );
  }

  // 获取博客数据
  const blogData = await db
    .select()
    .from(blogs)
    .where(and(
      eq(blogs.slug, slug),
      eq(blogs.status, "published"),
      eq(blogs.visibility, "public")
    ))
    .limit(1);

  if (blogData.length === 0) {
    notFound();
  }

  return <BlogDetail blog={blogData[0]} />;
}

export async function generateMetadata({ params }: BlogDetailPageProps) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug;

  if (!process.env.DATABASE_URL) {
    return {
      title: "Blog",
      description: "Blogs are disabled (missing DATABASE_URL).",
    };
  }
  
  // 获取博客数据
  const blogData = await db
    .select()
    .from(blogs)
    .where(and(
      eq(blogs.slug, slug),
      eq(blogs.status, "published"),
      eq(blogs.visibility, "public")
    ))
    .limit(1);

  if (blogData.length === 0) {
    return {
      title: "Blog Not Found",
    };
  }

  return {
    title: blogData[0].title,
    description: blogData[0].description || "",
  };
}
