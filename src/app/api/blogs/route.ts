// import { NextRequest, NextResponse } from "next/server"; 从 Next.js 内置的 server 模块导入 App Router 专用的请求和响应对象。
// NextRequest 是扩展过的 Request，带有一些 Next.js 特有的便利方法（如 nextUrl、geo、ip、cookies() 等）。
// NextResponse 是扩展过的 Response，用于更方便地返回 JSON、重定向、设置 cookie 等。
import { NextRequest, NextResponse } from "next/server";
// 导入你项目中封装好的 Drizzle ORM 数据库实例。
import { db } from "@/lib/db/client";
// 导入 Drizzle 中定义的 blogs 表结构（通常是用 pgTable 定义的）。
import { blogs } from "@/lib/db/schema/blogs";
// 导入前面你用 Better Auth（或其他认证库如 Lucia、NextAuth v5 等）创建的服务器端 auth 实例。
// 通常会提供一个 auth() 或 getSession() 方法来获取当前登录用户。
import { auth } from "@/lib/auth/server";
// Drizzle ORM 提供的查询构建器函数：
// eq(column, value) → WHERE column = value
// desc(column) → ORDER BY column DESC
// and(...conditions) → 把多个条件用 AND 连接
import { eq, desc, and } from "drizzle-orm";
// 引入 nanoid 库，用来生成短小、安全、URL 友好的随机 ID（长度默认 21 位）。
// 很多项目用它替代数据库自增 ID，因为：
// 避免暴露文章数量
// 更适合分布式系统
// 生成速度快、无需等待数据库
import { nanoid } from "nanoid";

// GET /api/blogs - 获取博客列表
// 定义一个异步的 GET 请求处理函数（App Router 规范）
// 参数 request: NextRequest 是 Next.js 提供的增强版 Request 对象
export async function GET(request: NextRequest) {
  try {
//     分别读取 URL 中的四个查询参数，全部是字符串或 null：
// status：可能的值如 "published"、"draft"、"archived" 等，用于过滤状态
// visibility：如 "public"、"private"、"unlisted"，控制可见性
// language：如 "en"、"zh-CN"，按语言过滤
// featured：如 "true"、"1"，是否只返回加精/推荐内容
// // 如果 URL 中没有对应参数，值会是 null（而不是 undefined）。
// 这两行实现分页功能（或叫 cursor-less 的 offset 分页）：
// limit：每页返回多少条数据，默认 10 条
// offset：跳过前面多少条数据，默认 0（第一页）
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const visibility = searchParams.get("visibility");
    const language = searchParams.get("language");
    const featured = searchParams.get("featured");
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = parseInt(searchParams.get("offset") || "0");

//      构建查询条件
//     创建一个空数组，用于收集多个 eq() 条件。
// Drizzle ORM 支持把多个条件放进数组，然后在 .where(and(...conditions)) 或 .where(or(...conditions)) 中使用，这里用 and 隐式连接。
    const conditions = [];
    
//     // 前台访问时，只显示已发布且公开的文章
//     前端可能传 ?status=published、?status=draft 或 ?status=all（后台管理面板常用）。
// 如果传了 status 且不是 "all" → 严格按照指定状态过滤。
// 如果根本没传 status（最常见的公众访问场景）→ 默认只显示 published（已发布）的文章，防止泄露草稿。
// 只有当明确传 status=all 时（通常是管理员后台），才会不过滤状态。
// 安全设计点：普通用户无法通过不传参数看到草稿，必须显式传 all 才行（后端还应配合权限判断）。
    if (status) {
      if (status !== "all") {
        conditions.push(eq(blogs.status, status));
      }
    } else {
      // 如果没有指定状态，默认只显示已发布的
      conditions.push(eq(blogs.status, "published"));
    }
//     作用完全类似 status：
// 可能的值："public"、"private"、"unlisted" 等。
// 普通前台访问（不传 visibility）→ 只显示公开文章。
// 传了 visibility=private → 只看私有文章（通常要登录+权限）。
// 传 visibility=all → 管理后台看全部。
// 实现了“默认安全公开”的原则。
    if (visibility) {
      if (visibility !== "all") {
        conditions.push(eq(blogs.visibility, visibility));
      }
    } else {
      // 默认只显示公开的
      conditions.push(eq(blogs.visibility, "public"));
    }
    
//     比较简单：如果传了语言（如 en、zh-CN），就精确匹配。
// 没传就不加条件 → 显示所有语言。
// 多语言博客站点常用。
    if (language) {
      conditions.push(eq(blogs.language, language));
    }
//     featured 来自 URL 参数，本来是字符串 "true" / "false" 或未传（null）。
// 只有明确传了 featured=true 或 featured=false 才会加这个条件。
// featured === "true" → 转成布尔值 true，查询加精文章。
// featured=false → 查询非加精文章。
// 不传 → 不过滤这个字段（首页可能想混合显示）。
    if (featured !== null) {
      conditions.push(eq(blogs.featured, featured === "true"));
    }

    // 查询博客列表
//     .where(conditions.length > 0 ? and(...conditions) : undefined)
// 非常聪明的写法！
// 如果前面构建了任何过滤条件（conditions 数组有内容）→ 用 and(...conditions) 拼接所有条件。
// 如果 conditions 为空数组（比如管理员传了 status=all&visibility=all）→ 传入 undefined，Drizzle 会自动忽略 where 子句，相当于 查全表。
// 避免了写两套查询，代码简洁又安全。
// .orderBy(desc(blogs.featured), desc(blogs.publishedAt), desc(blogs.createdAt))
// 多级排序逻辑（非常实用！）：
// featured 降序 → 加精/推荐文章永远排在最前面（featured = true 的在上面）
// publishedAt 降序 → 同一级别下，按发布时间排序（最新发布的在前）
// createdAt 降序 → 兜底排序，保证结果稳定
// 这是博客、新闻站点的黄金排序规则，强烈推荐！
// .limit(limit).offset(offset)
// 经典 offset 分页，实现 ?limit=10&offset=20 这种分页方式。
    const result = await db
      .select()
      .from(blogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(blogs.featured), desc(blogs.publishedAt), desc(blogs.createdAt))
      .limit(limit)
      .offset(offset);

    // 获取总数
    // AI说有问题，之后再查看
    const countResult = await db
      .select({ count: blogs.id })
      .from(blogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

//       标准的前后端约定格式：
// success: true → 前端判断是否成功
// data → 当前页的数据数组
// pagination → 给前端分页组件计算总页数、是否有下一页等
    return NextResponse.json({
      success: true,
      data: result,
      pagination: {
        total: countResult.length,
        limit,
        offset,
      },
    });
  } 
//   捕获所有异常（数据库断开、查询语法错等）
// 打印错误日志方便排查
// 返回标准错误格式 + 500 状态码
  catch (error) {
    console.error("Error fetching blogs:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch blogs" },
      { status: 500 }
    );
  }
}

// POST /api/blogs - 创建新博客
// export async function POST(request: NextRequest) {
// Next.js 13+ App Router 的标准 Route Handler 写法
// 只处理 POST 请求，用于创建资源（RESTful 风格）
export async function POST(request: NextRequest) {
  try {
//     使用 Lucia / NextAuth / 自定义 auth 系统从 cookie 中读取当前登录用户
// 没有登录 → 直接 401，未登录不能发文章
// 安全设计优秀：所有创建操作必须登录
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    
//     接收前端传的 JSON 数据
// 支持的字段非常完整：
// title / slug：标题和 URL 友好地址
// description：SEO 描述
// content：Markdown 或富文本内容
// tags：标签数组
// status：draft / published
// visibility：public / private / unlisted
// featured：是否加精
// language：多语言支持
    const body = await request.json();
    const {
      language,
      title,
      slug,
      description,
      content,
      tags,
      status,
      visibility,
      featured,
    } = body;

    // 验证必填字段
//     标题和 slug 是必须的（slug 用于生成永久链接）
// 缺少就 400，避免创建无效数据
    if (!title || !slug) {
      return NextResponse.json(
        { success: false, error: "Title and slug are required" },
        { status: 400 }
      );
    }

    // 检查 slug 是否已存在
//     防止 URL 冲突：同一个 slug 只能有一篇文章
// 很多人忽略这一步，导致后期文章覆盖或 404
// 你的模板做了这步，非常专业！
    const existingBlog = await db
      .select()
      .from(blogs)
      .where(eq(blogs.slug, slug))
      .limit(1);

    if (existingBlog.length > 0) {
      return NextResponse.json(
        { success: false, error: "Slug already exists" },
        { status: 400 }
      );
    }

    // 创建新博客
    // status"draft"不传就是草稿，防止误发布
    // visibility"public"默认公开
    // featuredfalse默认不加精
    // publishedAt只有 published 才填时间完美设计！草稿没有发布时间
    // id: nanoid()自动生成短 ID比自增 ID 更适合分布式，URL 更美观
    const newBlog = await db
      .insert(blogs)
      .values({
        id: nanoid(),
        authorId: session.user.id,
        language: language || "en",
        title,
        slug,
        description,
        content,
        tags: tags || [],
        status: status || "draft",
        visibility: visibility || "public",
        featured: featured || false,
        publishedAt: status === "published" ? new Date() : null,
      })
      .returning();
    // 返回结果和错误处理
    return NextResponse.json({
      success: true,
      data: newBlog[0],
    });
  } catch (error) {
    console.error("Error creating blog:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create blog" },
      { status: 500 }
    );
  }
}

// 一共暴露2个函数 GET () POST()
// 负责：列表 + 创建新博客