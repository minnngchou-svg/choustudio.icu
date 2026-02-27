import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import prisma from "@/lib/prisma"
import { normalizeCoverRatio } from "@/lib/cover-ratio"

export const dynamic = "force-dynamic"

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const check = await requireAdmin()
    if (!check.authorized) return check.response
    const { id } = await params
    try {
        const product = await prisma.accountProduct.findUnique({
            where: { id },
            include: { category: true, tags: true },
        })
        if (!product) {
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        }
        return NextResponse.json({
            ...product,
            price: Number(product.price),
            originalPrice: product.originalPrice ? Number(product.originalPrice) : null,
            features: (product.features as string[]) || [],
        })
    } catch (e) {
        const message = e instanceof Error ? e.message : "查询失败"
        return NextResponse.json({ error: "查询失败", detail: message }, { status: 500 })
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const check = await requireAdmin()
    if (!check.authorized) return check.response
    const { id } = await params

    try {
        const body = await request.json()
        const {
            title, slug, description, content, coverImage, coverRatio, showCoverImage,
            accountType, price, originalPrice, stock, validDays,
            features, securityNote, transferGuide, warranty,
            status, categoryId, tagIds,
        } = body

        const existing = await prisma.accountProduct.findUnique({ where: { id } })
        if (!existing) {
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        }

        if (slug && slug !== existing.slug) {
            const slugTaken = await prisma.accountProduct.findUnique({ where: { slug } })
            if (slugTaken) {
                return NextResponse.json({ error: "slug 已存在" }, { status: 400 })
            }
        }

        const product = await prisma.accountProduct.update({
            where: { id },
            data: {
                ...(title !== undefined && { title }),
                ...(slug !== undefined && { slug: slug.trim() }),
                ...(description !== undefined && { description: description || null }),
                ...(content !== undefined && { content }),
                ...(coverImage !== undefined && { coverImage: coverImage || null }),
                ...(coverRatio !== undefined && { coverRatio: normalizeCoverRatio(coverRatio) }),
                ...(showCoverImage !== undefined && { showCoverImage: Boolean(showCoverImage) }),
                ...(accountType !== undefined && { accountType: accountType.trim() }),
                ...(price !== undefined && { price }),
                ...(originalPrice !== undefined && { originalPrice: originalPrice ?? null }),
                ...(stock !== undefined && { stock }),
                ...(validDays !== undefined && { validDays: validDays ?? null }),
                ...(features !== undefined && { features }),
                ...(securityNote !== undefined && { securityNote: securityNote || null }),
                ...(transferGuide !== undefined && { transferGuide: transferGuide || null }),
                ...(warranty !== undefined && { warranty: warranty || null }),
                ...(status !== undefined && {
                    status: ["PUBLISHED", "PRIVATE", "DRAFT", "SOLD_OUT"].includes(status) ? status : existing.status,
                }),
                ...(categoryId !== undefined && { categoryId: categoryId || null }),
                ...(tagIds !== undefined && {
                    tags: { set: tagIds.map((tid: string) => ({ id: tid })) },
                }),
            },
            include: { category: true, tags: true },
        })

        return NextResponse.json({
            ...product,
            price: Number(product.price),
            originalPrice: product.originalPrice ? Number(product.originalPrice) : null,
            features: (product.features as string[]) || [],
        })
    } catch (e) {
        const message = e instanceof Error ? e.message : "更新失败"
        return NextResponse.json({ error: "更新失败", detail: message }, { status: 500 })
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const check = await requireAdmin()
    if (!check.authorized) return check.response
    const { id } = await params

    try {
        await prisma.accountProduct.delete({ where: { id } })
        return NextResponse.json({ success: true })
    } catch (e) {
        const message = e instanceof Error ? e.message : "删除失败"
        return NextResponse.json({ error: "删除失败", detail: message }, { status: 500 })
    }
}
