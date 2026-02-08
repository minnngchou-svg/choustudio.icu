/** 通用工具：cn 合并 class、getBaseUrl 取站点根地址。 */
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 服务端请求 API 时使用的站点根地址 */
export function getBaseUrl(): string {
  if (typeof process.env.NEXTAUTH_URL === "string" && process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL
  }
  if (typeof process.env.VERCEL_URL === "string" && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return "http://localhost:3000"
}
