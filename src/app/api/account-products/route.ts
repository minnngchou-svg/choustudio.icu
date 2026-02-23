import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { requireAdmin } from "@/lib/require-admin"
import prisma from "@/lib/prisma"
import { normalizeCoverRatio } from "@/lib/cover-ratio"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        const { searchParams } = new URL(request.url)
        const slug = searchParams.get("slug")
        const all = searchParams.get("all") === "1"
        const accountType = searchParams.get("accountType")
        const categoryId = searchParams.get("categoryId")

        const isAdminRole = (session?.user as { role?: string })?.role === "ADMIN"

        if (slug) {
            const product = await prisma.accountProduct.findUnique({
                where: { slug },
                include: { category: true, tags: true },
            })
            if (!product) {
                return NextResponse.json({ error: "Not found" }, { status: 404 })
            }
            if (product.status !== "PUBLISHED" && !isAdminRole) {
                return NextResponse.json({ error: "Not found" }, { status: 404 })
            }
            const row = {
                ...product,
                price: Number(product.price),
                originalPrice: product.originalPrice ? Number(product.originalPrice) : null,
                features: (product.features as string[]) || [],
            }
            return NextResponse.json(row)
        }

        const where: Record<string, unknown> = {
            ...(isAdminRole && all ? {} : { status: "PUBLISHED" }),
            ...(accountType ? { accountType } : {}),
            ...(categoryId ? { categoryId } : {}),
        }

        const list = await prisma.accountProduct.findMany({
            where,
            orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
            include: { category: true, tags: true },
        })

        const rows = list.map((p) => ({
            ...p,
            price: Number(p.price),
            originalPrice: p.originalPrice ? Number(p.originalPrice) : null,
            features: (p.features as string[]) || [],
        }))

        const headers = isAdminRole
            ? undefined
            : { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" }
        return NextResponse.json(rows, { headers })
    } catch (e) {
        const message = e instanceof Error ? e.message : "查询失败"
        return NextResponse.json({ error: "查询失败", detail: message }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    const check = await requireAdmin()
    if (!check.authorized) return check.response

    try {
        const body = await request.json()
        const {
            title, slug, description, content, coverImage, coverRatio,
            accountType, price, originalPrice, stock, validDays,
            features, securityNote, transferGuide, warranty,
            status, categoryId, tagIds,
        } = body

        if (!title || !slug || !accountType) {
            return NextResponse.json(
                { error: "缺少 title、slug 或 accountType" },
                { status: 400 },
            )
        }
        if (!/^[a-z0-9][a-z0-9-]*$/.test(slug.trim())) {
            return NextResponse.json({ error: "slug 格式不正确，仅允许小写字母、数字和连字符" }, { status: 400 })
        }
        if (price != null && (typeof price !== "number" || price < 0)) {
            return NextResponse.json({ error: "价格不能为负数" }, { status: 400 })
        }
        if (stock != null && (typeof stock !== "number" || stock < 0 || !Number.isInteger(stock))) {
            return NextResponse.json({ error: "库存必须为非负整数" }, { status: 400 })
        }
        const existing = await prisma.accountProduct.findUnique({ where: { slug } })
        if (existing) {
            return NextResponse.json({ error: "slug 已存在" }, { status: 400 })
        }

        const product = await prisma.accountProduct.create({
            data: {
                title,
                slug: slug.trim(),
                description: description || null,
                content: content ?? undefined,
                coverImage: coverImage || null,
                coverRatio: normalizeCoverRatio(coverRatio),
                accountType: accountType.trim(),
                price: price ?? 0,
                originalPrice: originalPrice != null ? originalPrice : null,
                stock: stock ?? 0,
                validDays: validDays != null ? validDays : null,
                features: features ?? [],
                securityNote: securityNote || null,
                transferGuide: transferGuide || null,
                warranty: warranty || null,
                status: ["PUBLISHED", "PRIVATE", "SOLD_OUT"].includes(status) ? status : "DRAFT",
                categoryId: categoryId || null,
                ...(tagIds?.length ? { tags: { connect: tagIds.map((id: string) => ({ id })) } } : {}),
            },
        })
        return NextResponse.json(product)
    } catch (e) {
        const message = e instanceof Error ? e.message : "创建失败"
        return NextResponse.json({ error: "创建失败", detail: message }, { status: 500 })
    }
}
