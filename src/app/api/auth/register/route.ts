import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 6

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = (body.email as string)?.trim()
    const password = (body.password as string)?.trim()
    const nickname = (body.nickname as string)?.trim() || null

    if (!email) {
      return NextResponse.json({ error: "请输入邮箱地址" }, { status: 400 })
    }
    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: "邮箱格式不正确" }, { status: 400 })
    }
    if (!password) {
      return NextResponse.json({ error: "请输入密码" }, { status: 400 })
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json({ error: `密码长度至少${MIN_PASSWORD_LENGTH}位` }, { status: 400 })
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    })
    if (existingUser) {
      return NextResponse.json({ error: "该邮箱已被注册" }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        nickname,
        role: "USER",
      },
      select: {
        id: true,
        email: true,
        nickname: true,
        role: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      success: true,
      user,
      message: "建议使用可用邮箱，以便接收订单通知和重要消息",
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "注册失败"
    console.error("[register] 注册失败:", e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
