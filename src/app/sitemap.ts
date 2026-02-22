/** SEO: 动态 sitemap — 包含所有 PUBLISHED 的作品、文章和教程 */
export const dynamic = "force-dynamic"

import type { MetadataRoute } from "next"
import prisma from "@/lib/prisma"

const BASE_URL = "https://choustudio.icu"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    // 静态页面
    const staticPages: MetadataRoute.Sitemap = [
        { url: BASE_URL, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
        { url: `${BASE_URL}/about`, changeFrequency: "monthly", priority: 0.6 },
        { url: `${BASE_URL}/blog`, changeFrequency: "weekly", priority: 0.8 },
        { url: `${BASE_URL}/works/design`, changeFrequency: "weekly", priority: 0.8 },
        { url: `${BASE_URL}/works/development`, changeFrequency: "weekly", priority: 0.8 },
        { url: `${BASE_URL}/tutorials`, changeFrequency: "weekly", priority: 0.7 },
    ]

    // 动态页面：已发布作品
    const works = await prisma.work.findMany({
        where: { status: "PUBLISHED" },
        select: { slug: true, updatedAt: true },
    })
    const workPages: MetadataRoute.Sitemap = works.map((w) => ({
        url: `${BASE_URL}/works/${w.slug}`,
        lastModified: w.updatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.7,
    }))

    // 动态页面：已发布文章
    const posts = await prisma.post.findMany({
        where: { status: "PUBLISHED" },
        select: { slug: true, updatedAt: true },
    })
    const postPages: MetadataRoute.Sitemap = posts.map((p) => ({
        url: `${BASE_URL}/blog/${p.slug}`,
        lastModified: p.updatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.7,
    }))

    // 动态页面：视频教程
    const tutorials = await prisma.videoTutorial.findMany({
        select: { slug: true, updatedAt: true },
    })
    const tutorialPages: MetadataRoute.Sitemap = tutorials.map((t) => ({
        url: `${BASE_URL}/tutorials/${t.slug}`,
        lastModified: t.updatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.6,
    }))

    return [...staticPages, ...workPages, ...postPages, ...tutorialPages]
}
