import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import prisma from "@/lib/prisma"
import bcrypt from "bcryptjs"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response

  try {
    const { searchParams } = new URL(request.url)
    const role = searchParams.get("role")
    const search = searchParams.get("search")?.trim()
    const page = parseInt(searchParams.get("page") || "1", 10)
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10)

    const where: Record<string, unknown> = {}
    if (role && role !== "all") {
      where.role = role
    }
    if (search) {
      where.OR = [
        { email: { contains: search } },
        { name: { contains: search } },
        { nickname: { contains: search } },
      ]
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          email: true,
          name: true,
          nickname: true,
          avatar: true,
          role: true,
          memberLevel: true,
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
      }),
      prisma.user.count({ where }),
    ])

    return NextResponse.json({
      users,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "查询失败"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response

  try {
    const body = await request.json()
    const { email, password, name, nickname, role } = body

    if (!email || !password) {
      return NextResponse.json({ error: "邮箱和密码必填" }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: "邮箱已存在" }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || null,
        nickname: nickname || null,
        role: role || "USER",
      },
      select: {
        id: true,
        email: true,
        name: true,
        nickname: true,
        role: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ user })
  } catch (e) {
    const message = e instanceof Error ? e.message : "创建失败"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
