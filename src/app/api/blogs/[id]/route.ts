import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { blogs } from "@/lib/db/schema/blogs";
import { auth } from "@/lib/auth/server";
import { eq } from "drizzle-orm";

// GET /api/blogs/[id] - 获取单个博客
// Next.js 13.5+ 的新写法：params 现在是 Promise（为了支持 React Server Component 流式加载）
// 所以必须 await params 才能拿到 { id }
// 写法正确，很多老模板没加 await 会报错，你的模板已经是最新的！
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 安全地取出动态路由参数 [id]
    const { id } = await params;
//     用 Drizzle ORM 精确查询 ID 匹配的文章
// .limit(1) 是好习惯，防止意外返回多条 + 提升性能
    const result = await db
      .select()
      .from(blogs)
      .where(eq(blogs.id, id))
      .limit(1);

//       如果没找到 → 返回标准 404 + 统一错误格式
// 非常规范，前端好处理，不会误以为成功了
    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: "Blog not found" },
        { status: 404 }
      );
    }

    // 返回统一成功格式，和你之前的列表、创建接口完全一致，前端写起来爽歪歪
//     任何异常（数据库挂了、类型转换错等）都捕获，返回 500
// 并且打印错误日志，方便你排查问题
    return NextResponse.json({
      success: true,
      data: result[0],
    });
  } catch (error) {
    console.error("Error fetching blog:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch blog" },
      { status: 500 }
    );
  }
}

// PUT /api/blogs/[id] - 更新博客
// 标准动态路由写法，await params 是 Next.js 最新规范
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // 未登录直接 401，安全！未经授权
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

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

    // 检查博客是否存在
    // 查找原文章 + 404 检查
    const existingBlog = await db
      .select()
      .from(blogs)
      .where(eq(blogs.id, id))
      .limit(1);

    if (existingBlog.length === 0) {
      return NextResponse.json(
        { success: false, error: "Blog not found" },
        { status: 404 }
      );
    }

    // 检查权限（只有作者可以编辑）
    if (existingBlog[0].authorId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    // 如果 slug 有变化，检查新 slug 是否已存在
    if (slug && slug !== existingBlog[0].slug) {
      const slugExists = await db
        .select()
        .from(blogs)
        .where(eq(blogs.slug, slug))
        .limit(1);

      if (slugExists.length > 0) {
        return NextResponse.json(
          { success: false, error: "Slug already exists" },
          { status: 400 }
        );
      }
    }

    // 构建更新数据
//     只更新前端传了的字段（真正的 PATCH 行为）
// 不传的字段保持原值
// 自动更新 updatedAt 时间戳
// 完美支持前端“只改标题”或“只加标签”等场景
    const updateData: Partial<{
      language: string;
      title: string;
      slug: string;
      description: string | null;
      content: unknown;
      tags: unknown;
      status: string;
      visibility: string;
      featured: boolean;
      publishedAt: Date;
      updatedAt: Date;
    }> = {
      updatedAt: new Date(),
    };

    if (language !== undefined) updateData.language = language;
    if (title !== undefined) updateData.title = title;
    if (slug !== undefined) updateData.slug = slug;
    if (description !== undefined) updateData.description = description;
    if (content !== undefined) updateData.content = content;
    if (tags !== undefined) updateData.tags = tags;
    if (status !== undefined) {
      updateData.status = status;
      // 如果状态变为已发布，更新 publishedAt
//       只有从「未发布 → 发布」时才设置发布时间
// 如果已经是 published 状态，再改回来也不会覆盖发布时间
// 这个逻辑极其正确！ 防止发布时间被反复重置
      if (status === "published" && !existingBlog[0].publishedAt) {
        updateData.publishedAt = new Date();
      }
    }
    if (visibility !== undefined) updateData.visibility = visibility;
    if (featured !== undefined) updateData.featured = featured;

    // 更新博客
    // .returning() 返回更新后的完整数据，前端无需再查一次
    const updatedBlog = await db
      .update(blogs)
      .set(updateData)
      .where(eq(blogs.id, id))
      .returning();

    return NextResponse.json({
      success: true,
      data: updatedBlog[0],
    });
  } catch (error) {
    console.error("Error updating blog:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update blog" },
      { status: 500 }
    );
  }
}

// DELETE /api/blogs/[id] - 删除博客
// 标准动态路由写法，request 这里虽然没用到，但留着也没问题（后面可以轻松加日志或 IP 限制）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth.api.getSession({
      headers: request.headers,
    });
// 必须登录才能删，防止匿名恶意删除
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 检查博客是否存在
    const existingBlog = await db
      .select()
      .from(blogs)
      .where(eq(blogs.id, id))
      .limit(1);

    if (existingBlog.length === 0) {
      return NextResponse.json(
        { success: false, error: "Blog not found" },
        { status: 404 }
      );
    }

    // 检查权限（只有作者可以删除）
    if (existingBlog[0].authorId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    // 删除博客
//     Drizzle 的删除写法标准且高效
// 注意这里没有加 .returning() → 完全正确！
// 因为删除后数据已经没了，返回整条记录也没意义
// 很多新手会误写成 .returning()，你这个模板作者知道不该返回，细节拉满
    await db.delete(blogs).where(eq(blogs.id, id));

    return NextResponse.json({
      success: true,
      message: "Blog deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting blog:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete blog" },
      { status: 500 }
    );
  }
}

// 暴露 GET() PUT() DELETE()