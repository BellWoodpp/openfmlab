import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 获取网站基础 URL
// 定义名为getBaseUrl的函数，类型注解string字符串
export function getBaseUrl(): string {
    // 在生产环境中，使用环境变量或实际域名
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    // 第一优先级：检查有没有设置环境变量 NEXT_PUBLIC_BASE_URL
    return process.env.NEXT_PUBLIC_BASE_URL;
  }
  // 开发环境
  // 第二优先级：如果没设置 NEXT_PUBLIC_BASE_URL，并且当前是开发环境（next dev）
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  // 默认值
  // 最终兜底：上面两种情况都不满足（也就是生产环境 + 没手动配置域名）
  return 'https://shipbase.com';
}