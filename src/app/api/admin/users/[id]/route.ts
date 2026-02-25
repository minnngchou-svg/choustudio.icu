import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response

  try {
    const { id } = await params

    const user = await prisma.user.findUnique({
      where: { id },
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
        updatedAt: true,
        _count: {
          select: {
            orders: true,
            accountOrders: true,
            history: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    return NextResponse.json({ user })
  } catch (e) {
    const message = e instanceof Error ? e.message : "查询失败"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response

  try {
    const { id } = await params
    const body = await request.json()
    const { disabled, role, nickname, memberLevel } = body

    const updateData: Record<string, unknown> = {}
    if (typeof disabled === "boolean") updateData.disabled = disabled
    if (role) updateData.role = role
    if (nickname !== undefined) updateData.nickname = nickname || null
    if (memberLevel !== undefined) updateData.memberLevel = memberLevel

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "没有要更新的内容" }, { status: 400 })
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        nickname: true,
        role: true,
        disabled: true,
        memberLevel: true,
      },
    })

    return NextResponse.json({ user })
  } catch (e) {
    const message = e instanceof Error ? e.message : "更新失败"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response

  try {
    const { id } = await params

    const user = await prisma.user.findUnique({
      where: { id },
      select: { role: true },
    })

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    if (user.role === "ADMIN") {
      return NextResponse.json({ error: "不能删除管理员账户" }, { status: 400 })
    }

    await prisma.user.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : "删除失败"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
