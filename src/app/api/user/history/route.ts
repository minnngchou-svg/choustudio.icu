import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    const body = await request.json()
    const { itemType, itemId, title, coverImage } = body

    if (!itemType || !itemId || !title) {
      return NextResponse.json({ error: "参数不完整" }, { status: 400 })
    }

    await prisma.browsingHistory.upsert({
      where: {
        userId_itemType_itemId: {
          userId: session.user.id,
          itemType,
          itemId,
        },
      },
      create: {
        userId: session.user.id,
        itemType,
        itemId,
        title,
        coverImage,
      },
      update: {
        title,
        coverImage,
      },
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : "操作失败"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    const history = await prisma.browsingHistory.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    })

    return NextResponse.json({ history })
  } catch (e) {
    const message = e instanceof Error ? e.message : "获取失败"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    await prisma.browsingHistory.deleteMany({
      where: { userId: session.user.id },
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : "删除失败"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
