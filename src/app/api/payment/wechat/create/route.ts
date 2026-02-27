import { NextRequest, NextResponse } from "next/server"
import QRCode from "qrcode"
import prisma from "@/lib/prisma"
import { getPaymentConfig } from "@/lib/payment-config"
import { createWxPayFromConfig } from "@/lib/wechatpay"

export const dynamic = "force-dynamic"

const VALID_ORDER_TYPES = ["work", "account"] as const
type OrderType = (typeof VALID_ORDER_TYPES)[number]

interface RequestBody {
  orderId?: string
  orderType?: string
}

export async function POST(request: NextRequest) {
  let body: RequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 })
  }

  const { orderId, orderType } = body

  if (!orderId || !orderType) {
    return NextResponse.json({ error: "参数不完整，需要 orderId 和 orderType" }, { status: 400 })
  }

  if (!VALID_ORDER_TYPES.includes(orderType as OrderType)) {
    return NextResponse.json({ error: "无效的订单类型" }, { status: 400 })
  }

  const config = await getPaymentConfig()
  const notifyUrl = config.wechatNotifyUrl?.trim()
  if (!notifyUrl) {
    return NextResponse.json({ error: "未配置支付回调地址" }, { status: 500 })
  }

  const pay = createWxPayFromConfig(config)
  if (!pay) {
    return NextResponse.json(
      { error: "微信支付未配置完整（AppID、商户号、证书、私钥）" },
      { status: 500 },
    )
  }

  let orderNo = ""
  let amount = 0
  let status = ""
  let description = ""

  if (orderType === "work") {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        work: { select: { id: true, title: true } },
        version: { select: { version: true } },
      },
    })

    if (!order) {
      return NextResponse.json({ error: "订单不存在" }, { status: 404 })
    }

    orderNo = order.orderNo
    amount = Number(order.amount)
    status = order.status

    if (order.work?.title) {
      const versionSuffix = order.version ? ` V${order.version.version}` : ""
      description = `${order.work.title}${versionSuffix}`
    } else {
      description = "作品赞助"
    }
  } else if (orderType === "account") {
    const order = await prisma.accountOrder.findUnique({
      where: { id: orderId },
      include: {
        accountProduct: { select: { id: true, title: true } },
      },
    })

    if (!order) {
      return NextResponse.json({ error: "订单不存在" }, { status: 404 })
    }

    orderNo = order.orderNo
    amount = Number(order.amount)
    status = order.status

    if (order.accountProduct?.title) {
      description = order.accountProduct.title
    } else {
      description = "AI服务"
    }
  }

  if (status !== "PENDING") {
    return NextResponse.json({ error: "订单状态不是待支付" }, { status: 400 })
  }

  const amountCents = Math.round(amount * 100)
  if (amountCents <= 0) {
    return NextResponse.json({ error: "订单金额异常" }, { status: 400 })
  }

  const safeDesc = description.slice(0, 127)

  const attach = JSON.stringify({ orderType })

  try {
    const result = await pay.transactions_native({
      description: safeDesc,
      out_trade_no: orderNo,
      notify_url: notifyUrl,
      amount: { total: amountCents, currency: "CNY" },
      attach,
    })
    const output = result as {
      status?: number
      code_url?: string
      data?: { code_url?: string }
      code?: string
      message?: string
    }
    const codeUrl = output.data?.code_url || output.code_url
    if (output.status === 200 && codeUrl) {
      const qrDataUrl = await QRCode.toDataURL(codeUrl, {
        width: 260,
        margin: 1,
        color: { dark: "#0a0a0a", light: "#ffffff" },
      })
      return NextResponse.json({ code_url: codeUrl, qr_data_url: qrDataUrl })
    }
    return NextResponse.json(
      { error: output.message || output.code || "微信下单失败" },
      { status: 502 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : "微信下单异常"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
