import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { requireAdmin } from "@/lib/require-admin"
import prisma from "@/lib/prisma"
import { sanitizeWorkForPublic } from "@/lib/sanitize-work"
import { normalizeCoverRatio } from "@/lib/cover-ratio"

export const dynamic = "force-dynamic"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params
    const work = await prisma.work.findUnique({
      where: { id },
      include: { category: true, tags: true },
    })
    if (!work) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    const isAdminRole = (session?.user as { role?: string })?.role === "ADMIN"
    if (work.status !== "PUBLISHED" && !isAdminRole) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    const row = {
      ...work,
      price: work.price ? Number(work.price) : null,
      images: (work.images as string[]) || [],
    }
    if (isAdminRole) return NextResponse.json(row)
    return NextResponse.json({
      ...sanitizeWorkForPublic(row),
      _deliveryRedacted: true,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "查询失败"
    return NextResponse.json({ error: "查询失败", detail: message }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response

  try {
    const { id } = await params
    const body = await request.json()
    const {
      title,
      slug,
      workType,
      description,
      content,
      coverImage,
      coverRatio,
      images,
      price,
      isFree,
      figmaUrl,
      deliveryUrl,
      demoUrl,
      demoQrCode,
      status,
      categoryId,
      sortOrder,
      tagIds,
    } = body

    const normalizeStatus = (s: string | undefined) => {
      if (s === "PUBLISHED") return "PUBLISHED"
      if (s === "PRIVATE") return "PRIVATE"
      return "DRAFT"
    }

    const work = await prisma.work.update({
      where: { id },
      data: {
        ...(title != null && { title }),
        ...(slug != null && { slug: slug.trim() }),
        ...(workType != null && {
          workType: workType === "DEVELOPMENT" ? "DEVELOPMENT" : "DESIGN",
        }),
        ...(description != null && { description }),
        ...(content != null && { content }),
        ...(coverImage != null && { coverImage }),
        ...(coverRatio != null && { coverRatio: normalizeCoverRatio(coverRatio) }),
        ...(images != null && { images }),
        ...(price != null && { price }),
        ...(typeof isFree === "boolean" && { isFree }),
        ...(figmaUrl !== undefined && { figmaUrl: figmaUrl || null }),
        ...(deliveryUrl !== undefined && { deliveryUrl: deliveryUrl || null }),
        ...(demoUrl !== undefined && { demoUrl: demoUrl || null }),
        ...(demoQrCode !== undefined && { demoQrCode: demoQrCode || null }),
        ...(status != null && { status: normalizeStatus(status) }),
        ...(categoryId != null && { categoryId: categoryId || null }),
        ...(sortOrder != null && { sortOrder: parseInt(String(sortOrder), 10) || 0 }),
        ...(tagIds != null && {
          tags: { set: (tagIds as string[]).map((tid: string) => ({ id: tid })) },
        }),
      },
      include: { tags: true },
    })
    return NextResponse.json(work)
  } catch (e) {
    const message = e instanceof Error ? e.message : "更新失败"
    return NextResponse.json({ error: "更新失败", detail: message }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response

  try {
    const { id } = await params

    // 使用事务解决竞态条件：检查订单和删除作品在同一事务中原子执行
    await prisma.$transaction(async (tx) => {
      const orderCount = await tx.order.count({ where: { workId: id } })
      if (orderCount > 0) {
        throw new Error(`has_orders:${orderCount}`)
      }
      await tx.work.delete({ where: { id } })
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : "删除失败"
    // 检查是否是有关联订单的错误
    if (message.startsWith("has_orders:")) {
      const count = message.split(":")[1]
      return NextResponse.json(
        { error: `该作品有 ${count} 笔关联订单，无法删除。请先处理相关订单。` },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: "删除失败", detail: message }, { status: 500 })
  }
}
