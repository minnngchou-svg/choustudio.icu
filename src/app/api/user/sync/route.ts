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

interface HistoryItem {
  itemType: string
  itemId: string
  title: string
  coverImage?: string
  visitedAt: number
}

interface SyncData {
  favorites?: FavoriteItem[]
  preferences?: Record<string, unknown>
  history?: HistoryItem[]
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    const body: SyncData = await request.json()
    const { favorites, preferences, history } = body

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        favorites: true,
        preferences: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    const updateData: Prisma.UserUpdateInput = {}

    if (favorites && Array.isArray(favorites)) {
      const existingFavorites = (user.favorites as unknown as FavoriteItem[]) || []
      const existingKeys = new Set(
        existingFavorites.map((f) => `${f.itemType}:${f.itemId}`)
      )
      const mergedFavorites = [...existingFavorites]
      for (const item of favorites) {
        const key = `${item.itemType}:${item.itemId}`
        if (!existingKeys.has(key)) {
          mergedFavorites.push(item)
        }
      }
      updateData.favorites = mergedFavorites as unknown as Prisma.InputJsonValue
    }

    if (preferences && typeof preferences === "object") {
      const existingPrefs = (user.preferences as unknown as Record<string, unknown>) || {}
      updateData.preferences = { ...preferences, ...existingPrefs } as Prisma.InputJsonValue
    }

    if (history && Array.isArray(history)) {
      const historyRecords = history.slice(0, 50)
      for (const item of historyRecords) {
        try {
          await prisma.browsingHistory.upsert({
            where: {
              userId_itemType_itemId: {
                userId: session.user.id,
                itemType: item.itemType,
                itemId: item.itemId,
              },
            },
            create: {
              userId: session.user.id,
              itemType: item.itemType,
              itemId: item.itemId,
              title: item.title,
              coverImage: item.coverImage,
            },
            update: {
              title: item.title,
              coverImage: item.coverImage,
            },
          })
        } catch {
          // Ignore individual history sync errors
        }
      }
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: updateData,
      })
    }

    const updatedUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        favorites: true,
        preferences: true,
      },
    })

    return NextResponse.json({
      success: true,
      message: "数据同步成功",
      data: updatedUser,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "同步失败"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
