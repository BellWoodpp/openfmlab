// 1. MetadataRoute: 从 Next.js 核心里导入类型 MetadataRoute（专门给 sitemap、robots 这类文件用的） 
// 后面你默认导出的函数必须有这个返回类型：export default function sitemap(): MetadataRoute.Sitemap { ... }
// 这样 TypeScript 才知道你返回的是合法的 sitemap 格式。
// 2. db: 导入你项目里已经封装好的 Drizzle ORM 数据库实例（通常是 PostgreSQL、MySQL、PlanetScale 等）
// 路径 @/lib/db/client 是项目常见约定，意思是：src/lib/db/client.ts 里导出的 db 实例
// 3. blogs: 导入 Drizzle 生成的 blogs 表结构（就是你的博客表）
// 4. eq, and: 导入 Drizzle 的查询构造器：eq(column, value) → 等于 and(...conditions) → 多个条件 AND 组合
// 5. locales, defaultLocale: 导入你的多语言配置 locales 通常是 ['en', 'zh', 'ja'] 这样的数组 defaultLocale 通常是 'en' 或 'zh'

import { MetadataRoute } from 'next';
import { db } from '@/lib/db/client';
import { blogs } from '@/lib/db/schema/blogs';
import { eq, and } from 'drizzle-orm';
import { locales, defaultLocale } from '@/i18n/types';
import { getBaseUrl } from "@/lib/utils";

// 所有静态页面的路径
//   '',            // 首页          → https://rtvox.com/
//   'features',    // 功能特性页    → https://rtvox.com/features
//   'pricing',     // 价格页面      → https://rtvox.com/pricing
//   'docs',        // 文档页面      → https://rtvox.com/docs
//   'integrations',// 集成页面      → https://rtvox.com/integrations
//   'help',        // 帮助中心      → https://rtvox.com/help
//   'contact',     // 联系我们      → https://rtvox.com/contact
//   'status',      // 系统状态页    → https://rtvox.com/status
//   'privacy',     // 隐私政策      → https://rtvox.com/privacy
//   'terms',       // 服务条款      → https://rtvox.com/terms
//   'cookies',     // Cookie 政策   → https://rtvox.com/cookies
//   'blogs',       // 博客列表页    → https://rtvox.com/blogs
//   'podcast-mvp', // 产品主功能页  → https://rtvox.com/podcast-mvp
const staticPages = [
  '',
  'features',
  'pricing',
  'docs',
  'integrations',
  'help',
  'contact',
  'status',
  'privacy',
  'terms',
  'cookies',
  'blogs',
  'podcast-mvp',
];

// 生成语言的 URL（默认语言不带 /{locale} 前缀）
// 输入三个参数：baseUrl：比如 https://rtvox.com; locale：当前语言代码，比如 'en'、'zh'、'ja'; path：页面路径，比如 ''（首页）、'pricing'、'blog/123'
function getLocaleUrl(baseUrl: string, locale: string, path: string): string {

  if (locale === defaultLocale) {
    // 三元运算符
    return path === '' ? `${baseUrl}/` : `${baseUrl}/${path}`;
  }
// 如果是其他语言（比如 zh、ja）：
// 首页 → https://rtvox.com/zh、https://rtvox.com/ja
// 其他页面 → https://rtvox.com/zh/pricing、https://rtvox.com/ja/blog/123
  return path === '' ? `${baseUrl}/${locale}` : `${baseUrl}/${locale}/${path}`;
}

// export default async function sitemap() → 告诉 Next.js：“我这个文件是用来生成 sitemap.xml 的”
// MetadataRouteNext.js 把所有「用来生成元数据的特殊路由文件」统一放在一个命名空间（namespace）里，包括：
// • robots.txt
// • sitemap.xml
// • manifest.json
// • favicon.ico 等
// "."点号表示“命名空间下的子成员”
// Sitemap这个命名空间下面专门给 app/sitemap.ts 文件准备的类型，全名其实是 MetadataRoute.Sitemap
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // const baseUrl = getBaseUrl(); → 自动拿到当前网站完整域名（本地/线上都正确）
  const baseUrl = getBaseUrl();
  //const currentDate = new Date(); → 拿到构建那一刻的时间，给所有静态页面打上“最近更新时间”
  const currentDate = new Date();
  
  // 生成静态页面 sitemap 条目（每个页面只输出 1 条，包含 alternates.languages）
  // staticPageEntries 是一个空数组，用于存放 sitemap 的每一条页面信息（条目）。它的类型是：MetadataRoute.Sitemap
  const staticPageEntries: MetadataRoute.Sitemap = [];

  for (const page of staticPages) {
    const alternates: Record<string, string> = {};
    for (const loc of locales) {
      alternates[loc] = getLocaleUrl(baseUrl, loc, page);
    }

    staticPageEntries.push({
      url: getLocaleUrl(baseUrl, defaultLocale, page),
      lastModified: currentDate,
      changeFrequency: page === '' ? 'daily' : 'weekly',
      priority: page === '' ? 1.0 : 0.8,
      alternates: {
        languages: alternates,
      },
    });
  }

  // If DB isn't configured, skip dynamic blog entries.
  // This keeps `next build` usable without a Postgres connection.
  if (!process.env.DATABASE_URL) {
    return staticPageEntries;
  }
  
  // 获取所有已发布的博客文章
  // 1. 创建一个数组，用来放所有博客 sitemap 项 
  // 从数据库拿到所有已发布的博客 → 生成每种语言的 URL → 把它们加入 sitemap → 提高 SEO。
  const blogEntries: MetadataRoute.Sitemap = [];
  
  try {
    // 从数据库中获取所有“已发布 + 公共”的博客
    const publishedBlogs = await db
    // 取出所有 status="published" 并且 visibility="public" 的博客文章。
// .select() → 选择数据
// .from(blogs) → 表名 blogs
// .where(...) → 条件
// eq() → 等于
// and() → 多条件 AND
      .select()
      .from(blogs)
      .where(
        and(
          eq(blogs.status, 'published'),
          eq(blogs.visibility, 'public')
        )
      );
    
    // 为每个博客文章创建 sitemap 条目
    // 遍历每个返回的博客，生成 sitemap 条目
    for (const blog of publishedBlogs) {
      // 计算博客的发布日期（如果没有 publishedAt，就用 updatedAt）
      const publishedDate = blog.publishedAt 
        ? new Date(blog.publishedAt)
        : blog.updatedAt;
      
      // 为每种语言创建对应的 URL
//       假设：
// baseUrl = https://example.com
// slug = my-first-post
// locales = ["en", "zh", "jp"]
// 结果会是：
// 语言	URL
// en	https://example.com/blogs/my-first-post
// zh	https://example.com/zh/blogs/my-first-post
// jp	https://example.com/jp/blogs/my-first-post
      const blogUrls: Record<string, string> = {};
      for (const locale of locales) {
        blogUrls[locale] = getLocaleUrl(baseUrl, locale, `blogs/${blog.slug}`);
      }
      
      // 生成 sitemap 条目
// lastModified
// 告诉搜索引擎什么时候更新的。
// changeFrequency: 'monthly'
// 告诉搜索引擎：这个页面大概每月更新一次。
// priority: 0.7
// 搜索引擎优先级（0–1）。
// alternates.languages
// 给搜索引擎提供多语言版本，帮助 SEO。
      blogEntries.push({
        url: blogUrls[blog.language] || blogUrls[defaultLocale],
        lastModified: publishedDate,
        changeFrequency: 'monthly',
        priority: 0.7,
        alternates: {
          languages: blogUrls,
        },
      });
    }
  } catch (error) {
    console.error('Error fetching blogs for sitemap:', error);
    // 发生错误时打印,即使获取博客失败，仍然返回静态页面的 sitemap
  }
  
  // 合并所有条目
  return [...staticPageEntries, ...blogEntries];
}
