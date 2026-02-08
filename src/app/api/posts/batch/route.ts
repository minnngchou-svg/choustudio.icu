import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

/** DELETE: 批量删除文章。body: { ids }，需管理员登录。 */
export async function DELETE(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { ids } = await request.json()
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids required" }, { status: 400 })
  }
  await prisma.post.deleteMany({ where: { id: { in: ids } } })
  return NextResponse.json({ ok: true })
}

/** PATCH: 批量更新文章状态。body: { ids, status }，status 为 PUBLISHED 或 DRAFT。 */
export async function PATCH(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { ids, status } = await request.json()
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids required" }, { status: 400 })
  }
  if (!["PUBLISHED", "DRAFT"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 })
  }
  await prisma.post.updateMany({
    where: { id: { in: ids } },
    data: { status },
  })
  return NextResponse.json({ ok: true })
}
