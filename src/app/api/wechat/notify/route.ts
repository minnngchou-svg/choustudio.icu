import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { sendOrderEmail } from "@/lib/email"
import { getPaymentConfig } from "@/lib/payment-config"
import { getNotifyConfig } from "@/lib/wechatpay"
import { normalizeSiteName } from "@/lib/page-copy"

export const dynamic = "force-dynamic"

interface AttachData {
  orderType: "work" | "account"
}

interface DecryptedData {
  out_trade_no?: string
  transaction_id?: string
  trade_state?: string
  attach?: string
  amount?: {
    total?: number
    currency?: string
  }
}

function parseAttach(attach: string | undefined): AttachData | null {
  if (!attach) return null
  try {
    const parsed = JSON.parse(attach)
    if (parsed.orderType === "work" || parsed.orderType === "account") {
      return parsed as AttachData
    }
    return null
  } catch {
    return null
  }
}

async function handleWorkOrder(
  outTradeNo: string,
  transactionId: string | undefined,
  paidAmountCents: number | undefined
): Promise<{ success: boolean; message: string }> {
  const order = await prisma.order.findUnique({
    where: { orderNo: outTradeNo },
    include: {
      work: { select: { title: true } },
    },
  })

  if (!order) {
    console.error(`[Wechat Notify] Work order not found: ${outTradeNo}`)
    return { success: false, message: "订单不存在" }
  }

  if (order.status === "PAID") {
    console.log(`[Wechat Notify] Work order already paid: ${outTradeNo}`)
    return { success: true, message: "成功" }
  }

  if (order.status !== "PENDING") {
    console.log(`[Wechat Notify] Work order status invalid: ${outTradeNo}, status: ${order.status}`)
    return { success: true, message: "成功" }
  }

  const orderAmountCents = Math.round(Number(order.amount) * 100)
  if (paidAmountCents !== undefined && Math.abs(orderAmountCents - paidAmountCents) > 0) {
    console.error(
      `[Wechat Notify] Amount mismatch for work order ${outTradeNo}: expected ${orderAmountCents} cents, got ${paidAmountCents} cents`
    )
    return { success: false, message: "金额不匹配" }
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: "PAID",
      paidAt: new Date(),
      paymentId: transactionId ?? null,
    },
  })

  const settings = await prisma.settings.findUnique({ where: { id: "settings" } })
  const socialLinks = (settings?.socialLinks as Record<string, string> | null) || {}

  sendOrderEmail({
    to: order.buyerEmail,
    siteName: normalizeSiteName(settings?.siteName),
    workTitle: order.work?.title ?? "作品",
    orderNo: order.orderNo,
    isFree: false,
    amount: Number(order.amount),
    wechat: socialLinks.wechat || null,
  }).catch((e) => {
    console.error(`[Wechat Notify] Failed to send email for work order ${outTradeNo}:`, e)
  })

  console.log(`[Wechat Notify] Work order paid successfully: ${outTradeNo}`)
  return { success: true, message: "成功" }
}

async function handleAccountOrder(
  outTradeNo: string,
  transactionId: string | undefined,
  paidAmountCents: number | undefined
): Promise<{ success: boolean; message: string }> {
  const order = await prisma.accountOrder.findUnique({
    where: { orderNo: outTradeNo },
    include: {
      accountProduct: { select: { title: true } },
    },
  })

  if (!order) {
    console.error(`[Wechat Notify] Account order not found: ${outTradeNo}`)
    return { success: false, message: "订单不存在" }
  }

  if (order.status === "PAID") {
    console.log(`[Wechat Notify] Account order already paid: ${outTradeNo}`)
    return { success: true, message: "成功" }
  }

  if (order.status !== "PENDING") {
    console.log(`[Wechat Notify] Account order status invalid: ${outTradeNo}, status: ${order.status}`)
    return { success: true, message: "成功" }
  }

  const orderAmountCents = Math.round(Number(order.amount) * 100)
  if (paidAmountCents !== undefined && Math.abs(orderAmountCents - paidAmountCents) > 0) {
    console.error(
      `[Wechat Notify] Amount mismatch for account order ${outTradeNo}: expected ${orderAmountCents} cents, got ${paidAmountCents} cents`
    )
    return { success: false, message: "金额不匹配" }
  }

  await prisma.accountOrder.update({
    where: { id: order.id },
    data: {
      status: "PAID",
      paidAt: new Date(),
    },
  })

  console.log(`[Wechat Notify] Account order paid successfully: ${outTradeNo}`)
  return { success: true, message: "成功" }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  if (!rawBody) {
    return NextResponse.json({ code: "FAIL", message: "空报文" }, { status: 400 })
  }

  const config = await getPaymentConfig()
  const notifyConfig = getNotifyConfig(config)
  if (!notifyConfig) {
    return NextResponse.json({ code: "FAIL", message: "商户未配置" }, { status: 500 })
  }

  const { key, pay } = notifyConfig

  let eventBody: { event_type?: string; resource?: { ciphertext: string; associated_data: string; nonce: string } }
  try {
    eventBody = JSON.parse(rawBody) as typeof eventBody
  } catch {
    return NextResponse.json({ code: "FAIL", message: "JSON 解析失败" }, { status: 400 })
  }

  const resource = eventBody?.resource
  if (!resource?.ciphertext || !resource.associated_data || !resource.nonce) {
    return NextResponse.json({ code: "FAIL", message: "缺少 resource" }, { status: 400 })
  }

  let decrypted: DecryptedData
  try {
    decrypted = pay.decipher_gcm<DecryptedData>(
      resource.ciphertext,
      resource.associated_data,
      resource.nonce,
      key
    )
  } catch {
    console.error("[Wechat Notify] AEAD decryption failed, invalid ciphertext or key")
    return NextResponse.json({ code: "FAIL", message: "解密失败，报文不可信" }, { status: 401 })
  }

  const outTradeNo = decrypted.out_trade_no?.trim()
  const tradeState = decrypted.trade_state
  const transactionId = decrypted.transaction_id
  const attach = decrypted.attach
  const paidAmountCents = decrypted.amount?.total

  if (!outTradeNo) {
    return NextResponse.json({ code: "FAIL", message: "缺少商户订单号" }, { status: 400 })
  }

  if (tradeState !== "SUCCESS") {
    console.log(`[Wechat Notify] Ignoring trade_state: ${tradeState}`)
    return NextResponse.json({ code: "SUCCESS", message: "成功" })
  }

  const attachData = parseAttach(attach)
  if (!attachData) {
    console.error(`[Wechat Notify] Invalid or missing attach: ${attach}`)
    const workOrder = await prisma.order.findUnique({ where: { orderNo: outTradeNo } })
    const accountOrder = await prisma.accountOrder.findUnique({ where: { orderNo: outTradeNo } })

    if (workOrder) {
      const result = await handleWorkOrder(outTradeNo, transactionId, paidAmountCents)
      return NextResponse.json(
        { code: result.success ? "SUCCESS" : "FAIL", message: result.message },
        { status: result.success ? 200 : 400 }
      )
    } else if (accountOrder) {
      const result = await handleAccountOrder(outTradeNo, transactionId, paidAmountCents)
      return NextResponse.json(
        { code: result.success ? "SUCCESS" : "FAIL", message: result.message },
        { status: result.success ? 200 : 400 }
      )
    } else {
      console.error(`[Wechat Notify] Order not found in any table: ${outTradeNo}`)
      return NextResponse.json({ code: "FAIL", message: "订单不存在" }, { status: 404 })
    }
  }

  let result: { success: boolean; message: string }
  if (attachData.orderType === "work") {
    result = await handleWorkOrder(outTradeNo, transactionId, paidAmountCents)
  } else {
    result = await handleAccountOrder(outTradeNo, transactionId, paidAmountCents)
  }

  return NextResponse.json(
    { code: result.success ? "SUCCESS" : "FAIL", message: result.message },
    { status: result.success ? 200 : 400 }
  )
}
