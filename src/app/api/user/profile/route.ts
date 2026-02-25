import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        nickname: true,
        avatar: true,
        role: true,
        memberLevel: true,
        favorites: true,
        preferences: true,
        disabled: true,
        lastLoginAt: true,
        createdAt: true,
        _count: {
          select: {
            orders: true,
            accountOrders: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    return NextResponse.json({ user })
  } catch (e) {
    const message = e instanceof Error ? e.message : "获取用户信息失败"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    const body = await request.json()
    const nickname = (body.nickname as string)?.trim() || null
    const avatar = (body.avatar as string)?.trim() || null
    const preferences = body.preferences

    const updateData: Prisma.UserUpdateInput = {}

    if (nickname !== undefined) {
      updateData.nickname = nickname || null
    }
    if (avatar !== undefined) {
      updateData.avatar = avatar || null
    }
    if (preferences !== undefined) {
      updateData.preferences = preferences as Prisma.InputJsonValue
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "没有要更新的内容" }, { status: 400 })
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        nickname: true,
        avatar: true,
        role: true,
        memberLevel: true,
        favorites: true,
        preferences: true,
      },
    })

    return NextResponse.json({ success: true, user })
  } catch (e) {
    const message = e instanceof Error ? e.message : "更新失败"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
