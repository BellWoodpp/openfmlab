// 从 better-auth 包的 next-js 子模块里导入一个工具函数 toNextJsHandler
// 这个函数的作用是：把你创建的 Better Auth 实例（auth）转换成符合 Next.js App Router 规范的 Route Handler
// （即支持 GET、POST、PUT 等方法的 handler）
import { toNextJsHandler } from "better-auth/next-js";

// 导入你在项目中已经配置好的 Better Auth 实例
// 通常在 src/lib/auth/server.ts（或类似路径）里
import { auth } from "@/lib/auth/server";

// 使用 toNextJsHandler(auth) 把上面的 auth 实例转换成 Next.js 需要的格式
// 它会返回一个对象，里面包含 GET、POST（有时候还有 PUT、DELETE 等）这些方法
// 然后通过解构直接导出，放在 app/api/auth/[...better-auth]/route.ts 文件中
export const { GET, POST } = toNextJsHandler(auth);


// 为什么这样写？

// Better Auth 内部已经实现了所有认证逻辑（包括 OAuth 回调、密码登录、邮箱验证、会话管理等），大概有几十个端点
// 如果让你自己一个个写 route handler 会非常麻烦
// 使用 [...better-auth] 捕获所有子路径（如 /api/auth/sign-in、/api/auth/callback/google 等），
// 再交给 toNextJsHandler 统一处理，极其简洁

// 效果
// 部署后，你会自动拥有以下常用路由（无需再手动创建）：

// POST   /api/auth/sign-in/email
// POST   /api/auth/sign-up/email
// POST   /api/auth/sign-out
// GET    /api/auth/session
// GET/POST /api/auth/callback/google （以及其他社交登录）
// …等几十个开箱即用的认证接口

// 总结：这三行代码就是 Better Auth 在 Next.js App Router 下“一键暴露所有认证 API”的官方推荐写法，极其简洁高效。
// 把这文件放对位置后，你整个项目的认证功能就全部就绪了。