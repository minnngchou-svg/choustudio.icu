import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

/** DELETE: 批量删除文章。body: { ids }，需管理员登录。 */
export async function DELETE(request: NextRequest) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response

  try {
    const { ids } = await request.json()
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids required" }, { status: 400 })
    }
    await prisma.post.deleteMany({ where: { id: { in: ids } } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : "批量删除失败"
    return NextResponse.json({ error: "批量删除失败", detail: message }, { status: 500 })
  }
}

/** PATCH: 批量更新文章状态。body: { ids, status }，status 为 PUBLISHED、DRAFT 或 PRIVATE。 */
export async function PATCH(request: NextRequest) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response

  try {
    const { ids, status } = await request.json()
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids required" }, { status: 400 })
    }
    if (!["PUBLISHED", "DRAFT", "PRIVATE"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }
    await prisma.post.updateMany({
      where: { id: { in: ids } },
      data: { status },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : "批量更新失败"
    return NextResponse.json({ error: "批量更新失败", detail: message }, { status: 500 })
  }
}
