import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

export const dynamic = "force-dynamic"

interface FavoriteItem {
  itemType: string
  itemId: string
  title: string
  coverImage?: string
  addedAt: number
}

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

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { favorites: true },
    })

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    const favorites = (user.favorites as unknown as FavoriteItem[]) || []
    const existingIndex = favorites.findIndex(
      (f) => f.itemType === itemType && f.itemId === itemId
    )

    let newFavorites: FavoriteItem[]
    let isFavorite: boolean

    if (existingIndex >= 0) {
      newFavorites = favorites.filter((_, i) => i !== existingIndex)
      isFavorite = false
    } else {
      const newItem: FavoriteItem = {
        itemType,
        itemId,
        title,
        coverImage,
        addedAt: Date.now(),
      }
      newFavorites = [newItem, ...favorites]
      isFavorite = true
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        favorites: newFavorites as unknown as Prisma.InputJsonValue,
      },
    })

    return NextResponse.json({ success: true, isFavorite })
  } catch (e) {
    const message = e instanceof Error ? e.message : "操作失败"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
