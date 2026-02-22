import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 避免 Turbopack/Webpack 打包 Prisma，使用 node_modules 中的 .prisma/client
  serverExternalPackages: ["@prisma/client", "prisma", "wechatpay-node-v3"],

  // 允许加载外部图片（如阿里云 OSS、站点域名）
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.aliyuncs.com" },
      { protocol: "https", hostname: "**.choustudio.icu" },
    ],
  },

  // 安全响应头
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ]
  },
};

export default nextConfig;
