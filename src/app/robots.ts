// 导入元数据MetadataRoute

import { MetadataRoute } from 'next';
import { getBaseUrl } from "@/lib/utils";

// 暴露默认函数robots
// : MetadataRoute.Robots 是 TypeScript 类型，来自 Next.js 内置类型，意思是“这个函数必须返回一个符合 robots.txt 协议的对象”。
export default function robots(): MetadataRoute.Robots {
  // 调用前面我们解释过的那个私有工具函数 getBaseUrl()（自动判断是 localhost 还是生产域名）。
  // 这样生成的 sitemap 地址永远是正确的（比如 https://shipbase.com/sitemap.xml）
  const baseUrl = getBaseUrl();
  
  // userAgent: '*',        // 对所有爬虫生效（Googlebot、Bingbot、百度蜘蛛等）
  //       allow: '/',            // 允许抓取网站根路径（其实可以不写，默认就是允许）
        
  //       disallow: [            // 明确禁止抓取以下这些私有/敏感路由
  //         '/api/',             // 所有 API 接口不要被收录
  //         '/admin/',           // 后台管理页面
  //         '/dashboard/',       // 用户仪表盘
  //         '/profile/',         // 个人资料页
  //         '/membership/',      // 会员中心
  //         '/orders/',          // 订单页面
  //         '/payment/',         // 支付相关页面
  // sitemap: `${baseUrl}/sitemap.xml`,   // 告诉爬虫：我的站点地图在这里，快去抓！
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/dashboard/',
          '/profile/',
          '/membership/',
          '/orders/',
          '/payment/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

