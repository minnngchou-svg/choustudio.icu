import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 避免 Turbopack/Webpack 打包 Prisma，使用 node_modules 中的 .prisma/client
  serverExternalPackages: ["@prisma/client", "prisma", "wechatpay-node-v3"],
};

export default nextConfig;
