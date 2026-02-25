import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getPaymentConfig } from "@/lib/payment-config"
import { createAlipayClient } from "@/lib/alipay"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    const body = await request.json()
    const { orderId, orderType } = body

    if (!orderId || !orderType) {
      return NextResponse.json({ error: "参数不完整" }, { status: 400 })
    }

    const config = await getPaymentConfig()
    const alipay = createAlipayClient(config)

    if (!alipay) {
      return NextResponse.json({ error: "支付宝未配置" }, { status: 400 })
    }

    let orderNo = ""
    let amount = 0
    let status = ""
    let productTitle = ""

    if (orderType === "work") {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { id: true, orderNo: true, amount: true, status: true, workId: true },
      })
      if (order) {
        orderNo = order.orderNo
        amount = Number(order.amount)
        status = order.status
        if (order.workId) {
          const work = await prisma.work.findUnique({
            where: { id: order.workId },
            select: { title: true },
          })
          productTitle = work?.title || "作品"
        }
      }
    } else if (orderType === "account") {
      const order = await prisma.accountOrder.findUnique({
        where: { id: orderId },
        select: { id: true, orderNo: true, amount: true, status: true, accountProductId: true },
      })
      if (order) {
        orderNo = order.orderNo
        amount = Number(order.amount)
        status = order.status
        if (order.accountProductId) {
          const product = await prisma.accountProduct.findUnique({
            where: { id: order.accountProductId },
            select: { title: true },
          })
          productTitle = product?.title || "AI服务"
        }
      }
    }

    if (!orderNo) {
      return NextResponse.json({ error: "订单不存在" }, { status: 404 })
    }

    if (status !== "PENDING") {
      return NextResponse.json({ error: "订单状态不允许支付" }, { status: 400 })
    }

    if (amount <= 0) {
      return NextResponse.json({ error: "订单金额无效" }, { status: 400 })
    }

    const result = alipay.createPagePay({
      outTradeNo: orderNo,
      totalAmount: amount,
      subject: productTitle,
      body: `${orderType === "work" ? "作品" : "AI服务"}订单 - ${orderNo}`,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error || "创建支付失败" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      payUrl: result.payUrl,
      orderNo,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "创建支付失败"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
