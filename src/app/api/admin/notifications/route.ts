import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response

  try {
    const { searchParams } = new URL(request.url)
    const since = searchParams.get("since")

    const where: Record<string, unknown> = {
      status: "PAID",
    }

    if (since) {
      const sinceDate = new Date(since)
      if (!isNaN(sinceDate.getTime())) {
        where.paidAt = { gt: sinceDate }
      }
    }

    const newOrders = await prisma.order.findMany({
      where,
      orderBy: { paidAt: "desc" },
      take: 10,
      select: {
        id: true,
        orderNo: true,
        amount: true,
        paidAt: true,
        buyerEmail: true,
        work: { select: { title: true } },
      },
    })

    const newAccountOrders = await prisma.accountOrder.findMany({
      where,
      orderBy: { paidAt: "desc" },
      take: 10,
      select: {
        id: true,
        orderNo: true,
        amount: true,
        paidAt: true,
        buyerEmail: true,
        accountProduct: { select: { title: true } },
      },
    })

    const notifications = [
      ...newOrders.map((o) => ({
        id: o.id,
        type: "work",
        orderNo: o.orderNo,
        title: o.work.title,
        amount: Number(o.amount),
        buyerEmail: o.buyerEmail,
        paidAt: o.paidAt?.toISOString() || null,
      })),
      ...newAccountOrders.map((o) => ({
        id: o.id,
        type: "account",
        orderNo: o.orderNo,
        title: o.accountProduct.title,
        amount: Number(o.amount),
        buyerEmail: o.buyerEmail,
        paidAt: o.paidAt?.toISOString() || null,
      })),
    ].sort((a, b) => (b.paidAt || "").localeCompare(a.paidAt || ""))

    return NextResponse.json({
      notifications,
      timestamp: new Date().toISOString(),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "查询失败"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
