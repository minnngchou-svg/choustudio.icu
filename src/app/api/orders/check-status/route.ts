import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

const checkStatusRateLimit = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW = 60 * 1000
const RATE_LIMIT_MAX = 10

function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const record = checkStatusRateLimit.get(key)
  if (!record || now > record.resetAt) {
    checkStatusRateLimit.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return true
  }
  if (record.count >= RATE_LIMIT_MAX) {
    return false
  }
  record.count++
  return true
}

/** GET: 根据 orderNo 查询订单支付状态，前端轮询用。 */
export async function GET(request: NextRequest) {
  const orderNo = new URL(request.url).searchParams.get("orderNo")?.trim()
  if (!orderNo) {
    return NextResponse.json({ error: "缺少 orderNo" }, { status: 400 })
  }

  if (!checkRateLimit(orderNo)) {
    return NextResponse.json({ error: "请求过于频繁" }, { status: 429 })
  }

  const order = await prisma.order.findUnique({
    where: { orderNo },
    select: {
      status: true,
      buyerEmail: true,
      work: { select: { figmaUrl: true, deliveryUrl: true } },
      version: { select: { figmaUrl: true, deliveryUrl: true } },
    },
  })

  if (!order) {
    return NextResponse.json({ error: "订单不存在" }, { status: 404 })
  }

  return NextResponse.json({
    status: order.status,
    emailHint: order.buyerEmail.slice(0, 2) + "***" + order.buyerEmail.split("@")[1],
  })
}
