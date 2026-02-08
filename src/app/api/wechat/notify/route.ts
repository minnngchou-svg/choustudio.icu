import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { sendOrderEmail } from "@/lib/email"
import { getPaymentConfig } from "@/lib/payment-config"
import { getNotifyConfig } from "@/lib/wechatpay"
import { normalizeSiteName } from "@/lib/page-copy"

export const dynamic = "force-dynamic"

/** POST: 微信支付成功回调。验签、解密、更新订单、发邮件，返回 200 { code, message }。 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  if (!rawBody) {
    return NextResponse.json({ code: "FAIL", message: "空报文" }, { status: 400 })
  }

  const timestamp = request.headers.get("wechatpay-timestamp") ?? ""
  const nonce = request.headers.get("wechatpay-nonce") ?? ""
  const signature = request.headers.get("wechatpay-signature") ?? ""
  const serial = request.headers.get("wechatpay-serial") ?? ""
  if (!timestamp || !nonce || !signature || !serial) {
    return NextResponse.json({ code: "FAIL", message: "缺少签名头" }, { status: 400 })
  }

  const config = await getPaymentConfig()
  const notifyConfig = getNotifyConfig(config)
  if (!notifyConfig) {
    return NextResponse.json({ code: "FAIL", message: "商户未配置" }, { status: 500 })
  }

  const { key, pay } = notifyConfig
  let verified: boolean
  try {
    verified = await pay.verifySign({
      timestamp,
      nonce,
      body: rawBody,
      serial,
      signature,
      apiSecret: key,
    })
  } catch {
    return NextResponse.json({ code: "FAIL", message: "验签异常" }, { status: 401 })
  }
  if (!verified) {
    return NextResponse.json({ code: "FAIL", message: "验签失败" }, { status: 401 })
  }

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

  let decrypted: { out_trade_no?: string; transaction_id?: string; trade_state?: string }
  try {
    decrypted = pay.decipher_gcm<typeof decrypted>(
      resource.ciphertext,
      resource.associated_data,
      resource.nonce,
      key,
    )
  } catch {
    return NextResponse.json({ code: "FAIL", message: "解密失败" }, { status: 400 })
  }

  const outTradeNo = decrypted.out_trade_no?.trim()
  const tradeState = decrypted.trade_state
  if (!outTradeNo) {
    return NextResponse.json({ code: "FAIL", message: "缺少商户订单号" }, { status: 400 })
  }
  if (tradeState !== "SUCCESS") {
    return NextResponse.json({ code: "SUCCESS", message: "成功" })
  }

  const order = await prisma.order.findUnique({
    where: { orderNo: outTradeNo },
    include: {
      work: { select: { title: true, figmaUrl: true, deliveryUrl: true, currentVersion: true } },
      version: { select: { version: true, figmaUrl: true, deliveryUrl: true } },
    },
  })
  if (!order) {
    return NextResponse.json({ code: "FAIL", message: "订单不存在" }, { status: 404 })
  }
  if (order.status === "PAID") {
    return NextResponse.json({ code: "SUCCESS", message: "成功" })
  }
  if (order.status !== "PENDING") {
    return NextResponse.json({ code: "SUCCESS", message: "成功" })
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: "PAID",
      paidAt: new Date(),
      paymentId: decrypted.transaction_id ?? null,
    },
  })

  const figmaUrl = order.version?.figmaUrl ?? order.work?.figmaUrl ?? null
  const deliveryUrl = order.version?.deliveryUrl ?? order.work?.deliveryUrl ?? null
  const settings = await prisma.settings.findUnique({ where: { id: "settings" } })
  const socialLinks = (settings?.socialLinks as Record<string, string> | null) || {}
  sendOrderEmail({
    to: order.buyerEmail,
    siteName: normalizeSiteName(settings?.siteName),
    workTitle: order.work?.title ?? "作品",
    orderNo: order.orderNo,
    isFree: false,
    amount: Number(order.amount),
    figmaUrl,
    deliveryUrl,
    currentVersion: order.version?.version ?? order.work?.currentVersion ?? null,
    wechat: socialLinks.wechat ?? null,
  }).catch(() => {})

  return NextResponse.json({ code: "SUCCESS", message: "成功" })
}
