import { NextRequest, NextResponse } from "next/server"
import { getPaymentConfig } from "@/lib/payment-config"
import { createAlipayClient } from "@/lib/alipay"
import prisma from "@/lib/prisma"
import { sendOrderEmail } from "@/lib/email"
import { normalizeSiteName } from "@/lib/page-copy"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const config = await getPaymentConfig()
    const alipay = createAlipayClient(config)

    if (!alipay) {
      return NextResponse.json({ error: "支付宝未配置" }, { status: 400 })
    }

    const formData = await request.formData()
    const params: Record<string, string> = {}
    formData.forEach((value, key) => {
      params[key] = value.toString()
    })

    if (!alipay.verifyCallback(params)) {
      return NextResponse.json({ error: "签名验证失败" }, { status: 400 })
    }

    const tradeStatus = params.trade_status
    const outTradeNo = params.out_trade_no

    if (!outTradeNo) {
      return NextResponse.json({ error: "缺少订单号" }, { status: 400 })
    }

    if (tradeStatus === "TRADE_SUCCESS" || tradeStatus === "TRADE_FINISHED") {
      const order = await prisma.order.findUnique({
        where: { orderNo: outTradeNo },
        include: { work: { select: { title: true } } },
      })

      if (order && order.status === "PENDING") {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: "PAID",
            paidAt: new Date(),
            paymentId: params.trade_no || null,
          },
        })

        const settings = await prisma.settings.findUnique({ where: { id: "settings" } })
        const socialLinks = (settings?.socialLinks as Record<string, string> | null) || {}
        sendOrderEmail({
          to: order.buyerEmail,
          siteName: normalizeSiteName(settings?.siteName),
          workTitle: order.work.title,
          orderNo: order.orderNo,
          isFree: false,
          amount: Number(order.amount),
          wechat: socialLinks.wechat || null,
        }).catch(() => {})
      }
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : "处理失败"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const config = await getPaymentConfig()
    const alipay = createAlipayClient(config)

    if (!alipay) {
      return NextResponse.redirect(new URL("/payment/error?reason=config", request.url))
    }

    const { searchParams } = new URL(request.url)
    const params: Record<string, string> = {}
    searchParams.forEach((value, key) => {
      params[key] = value
    })

    if (!alipay.verifyCallback(params)) {
      return NextResponse.redirect(new URL("/payment/error?reason=sign", request.url))
    }

    const outTradeNo = params.out_trade_no
    if (!outTradeNo) {
      return NextResponse.redirect(new URL("/payment/error?reason=order", request.url))
    }

    return NextResponse.redirect(new URL(`/payment/success?orderNo=${outTradeNo}`, request.url))
  } catch (e) {
    return NextResponse.redirect(new URL("/payment/error", request.url))
  }
}
