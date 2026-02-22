/** SEO: 生成 robots.txt — 允许前台抓取，禁止 admin 和 api */
import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: "*",
            allow: "/",
            disallow: ["/admin", "/api/"],
        },
        sitemap: "https://choustudio.icu/sitemap.xml",
    }
}
