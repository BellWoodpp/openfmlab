// NextRequest = Next.js 专用的请求对象
// NextResponse = Next.js 专用的响应对象
// "next/server" → 用于 服务端（Server Component）和边缘函数

import { NextRequest, NextResponse } from "next/server";

// ✔ export async function POST(request: NextRequest)
// 这是导出一个 处理 POST 请求的方法
// Next.js 会自动调用它
// request 是 Next.js 的请求对象（NextRequest）
export async function POST(request: NextRequest) {
  try {
// ✔ const body = await request.json();
// 这行是：
// 等待( await )解析请求的 JSON body
// 并把结果存入 body
    const body = await request.json();
// ✔ const { email } = body;
// 这一行的意思：
// 从 body 中解构出 email 字段
    const { email } = body;
// if (!email) { ... }
// 表示：
// 如果 email 为空、undefined、null、空字符串，就返回错误
    if (!email) {
// ✔ return NextResponse.json({ ... }, { status: 400 });
// 这行的作用是：
// 返回 JSON 给客户端 + 设置 HTTP 状态码 400（Bad Request）
// success: false → 表示失败
// error: "Email is required" → 错误信息
// status: 400 → 客户端错误（缺少参数）
// 完整含义：
// 请求没有提供 email 参数，因此返回错误响应，HTTP 400。
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 }
      );
    }

    // 获取管理员邮箱列表
// 1. process.env.ADMIN_EMAILS 这是从环境变量里读取一个字符串。
// 例如你在 .env 文件里写：ADMIN_EMAILS=admin1@gmail.com, admin2@gmail.com, boss@company.com
// 那么 process.env.ADMIN_EMAILS 就等于："admin1@gmail.com, admin2@gmail.com, boss@company.com"
// 2. ?.split(",")：?. 是可选链操作符，意思是：如果 ADMIN_EMAILS 有值，就执行 split；如果没有，就不报错，返回 undefined。
// 所以：有值时 → 会按逗号把字符串切成数组没值时 → 返回 undefined
// 3. .map(e => e.trim())
// trim() 会把每个邮箱前后的空格去掉。
// 例如：" admin1@gmail.com" → "admin1@gmail.com"
// 最终得到一个干净的邮箱数组，比如：["admin1@gmail.com", "admin2@gmail.com", "boss@company.com"]
// 4. || []
// 如果前面整个表达式是 undefined（比如 .env 没写 ADMIN_EMAILS），就给一个空数组 []，避免程序报错。
    const adminEmails = process.env.ADMIN_EMAILS?.split(",").map(e => e.trim()) || [];
//  含义：判断是否管理员
// adminEmails 是管理员邮箱列表
// email 是用户传来的邮箱
// includes() 用来判断邮箱是否在管理员列表中
    const isAdmin = adminEmails.includes(email);

    //  返回 JSON 响应给前端
    // 成功时返回：
    // {
    //   "success": true,
    //   "isAdmin": true   // or false
    // }
    return NextResponse.json({
      success: true,
      isAdmin,
    });
// 解释：如果上面任何代码出错（比如 JSON 解析失败）
// 就进入 catch 打印错误 返回 500 状态码给前端（表示服务器端错误）
  } catch (error) {
    console.error("Error checking admin status:", error);
    return NextResponse.json(
      { success: false, error: "Failed to check admin status" },
      { status: 500 }
    );
  }
}

// ❤️ 总结（超级简单版本）
// 代码	意思
// 获取 ADMIN_EMAILS	从环境变量读取管理员邮箱
// split(",")	切成数组
// trim()	去掉空格
// includes()	判断用户邮箱是否在管理员列表里
// 返回 isAdmin	告诉前端是不是管理员

