import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

/** 批量删除分类：先解除关联再删除。 */
export async function DELETE(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 })
  }
  const { ids } = await request.json()
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids 必填" }, { status: 400 })
  }

  const list = await prisma.category.findMany({
    where: { id: { in: ids } },
    select: { id: true, type: true },
  })
  const idSet = new Set(list.map((c) => c.id))

  for (const cat of list) {
    if (cat.type === "POST") {
      await prisma.post.updateMany({
        where: { categoryId: cat.id },
        data: { categoryId: null },
      })
    } else if (cat.type === "TUTORIAL") {
      await prisma.videoTutorial.updateMany({
        where: { categoryId: cat.id },
        data: { categoryId: null },
      })
    } else {
      await prisma.work.updateMany({
        where: { categoryId: cat.id },
        data: { categoryId: null },
      })
    }
  }

  await prisma.category.deleteMany({ where: { id: { in: Array.from(idSet) } } })
  return NextResponse.json({ ok: true })
}
