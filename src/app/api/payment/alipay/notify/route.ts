import { NextRequest, NextResponse } from "next/server"
import { getPaymentConfig } from "@/lib/payment-config"
import { createAlipayClient } from "@/lib/alipay"
import prisma from "@/lib/prisma"
import { sendOrderEmail } from "@/lib/email"
import { normalizeSiteName } from "@/lib/page-copy"

export const dynamic = "force-dynamic"

const SUCCESS_RESPONSE = new NextResponse("success", {
  status: 200,
  headers: { "Content-Type": "text/plain" },
})

const FAIL_RESPONSE = new NextResponse("fail", {
  status: 200,
  headers: { "Content-Type": "text/plain" },
})

interface PassbackData {
  orderType: "work" | "account"
}

function parsePassbackParams(params: string | undefined): PassbackData | null {
  if (!params) return null
  try {
    const decoded = decodeURIComponent(params)
    const parsed = JSON.parse(decoded)
    if (parsed.orderType === "work" || parsed.orderType === "account") {
      return parsed as PassbackData
    }
    return null
  } catch {
    return null
  }
}

async function handleWorkOrder(
  outTradeNo: string,
  totalAmount: string,
  tradeNo: string | undefined,
): Promise<boolean> {
  const order = await prisma.order.findUnique({
    where: { orderNo: outTradeNo },
    include: {
      work: { select: { title: true } },
    },
  })

  if (!order) {
    console.error(`[Alipay Notify] Work order not found: ${outTradeNo}`)
    return false
  }

  if (order.status === "PAID") {
    console.log(`[Alipay Notify] Work order already paid: ${outTradeNo}`)
    return true
  }

  const orderAmount = Number(order.amount)
  const paidAmount = parseFloat(totalAmount)

  if (Math.abs(orderAmount - paidAmount) > 0.01) {
    console.error(
      `[Alipay Notify] Amount mismatch for work order ${outTradeNo}: expected ${orderAmount}, got ${paidAmount}`
    )
    return false
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: "PAID",
      paidAt: new Date(),
      paymentId: tradeNo || null,
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
    amount: orderAmount,
    wechat: socialLinks.wechat || null,
  }).catch((e) => {
    console.error(`[Alipay Notify] Failed to send email for work order ${outTradeNo}:`, e)
  })

  console.log(`[Alipay Notify] Work order paid successfully: ${outTradeNo}`)
  return true
}

async function handleAccountOrder(
  outTradeNo: string,
  totalAmount: string,
  tradeNo: string | undefined,
): Promise<boolean> {
  const order = await prisma.accountOrder.findUnique({
    where: { orderNo: outTradeNo },
    include: {
      accountProduct: { select: { title: true } },
    },
  })

  if (!order) {
    console.error(`[Alipay Notify] Account order not found: ${outTradeNo}`)
    return false
  }

  if (order.status === "PAID") {
    console.log(`[Alipay Notify] Account order already paid: ${outTradeNo}`)
    return true
  }

  const orderAmount = Number(order.amount)
  const paidAmount = parseFloat(totalAmount)

  if (Math.abs(orderAmount - paidAmount) > 0.01) {
    console.error(
      `[Alipay Notify] Amount mismatch for account order ${outTradeNo}: expected ${orderAmount}, got ${paidAmount}`
    )
    return false
  }

  await prisma.accountOrder.update({
    where: { id: order.id },
    data: {
      status: "PAID",
      paidAt: new Date(),
    },
  })

  console.log(`[Alipay Notify] Account order paid successfully: ${outTradeNo}`)
  return true
}

export async function POST(request: NextRequest) {
  try {
    const config = await getPaymentConfig()
    const alipay = createAlipayClient(config)

    if (!alipay) {
      console.error("[Alipay Notify] Alipay client not configured")
      return FAIL_RESPONSE
    }

    const formData = await request.formData()
    const params: Record<string, string> = {}
    formData.forEach((value, key) => {
      params[key] = value.toString()
    })

    if (!alipay.verifyCallback(params)) {
      console.error("[Alipay Notify] Signature verification failed")
      return FAIL_RESPONSE
    }

    const callbackAppId = params.app_id
    if (callbackAppId !== alipay.appId) {
      console.error(
        `[Alipay Notify] App ID mismatch: expected ${alipay.appId}, got ${callbackAppId}`
      )
      return FAIL_RESPONSE
    }

    const tradeStatus = params.trade_status
    const outTradeNo = params.out_trade_no
    const totalAmount = params.total_amount
    const tradeNo = params.trade_no
    const passbackParams = params.passback_params

    if (!outTradeNo || !totalAmount) {
      console.error("[Alipay Notify] Missing required params: out_trade_no or total_amount")
      return FAIL_RESPONSE
    }

    if (tradeStatus !== "TRADE_SUCCESS" && tradeStatus !== "TRADE_FINISHED") {
      console.log(`[Alipay Notify] Ignoring trade_status: ${tradeStatus}`)
      return SUCCESS_RESPONSE
    }

    const passback = parsePassbackParams(passbackParams)
    if (!passback) {
      console.error(`[Alipay Notify] Invalid or missing passback_params: ${passbackParams}`)
      const workOrder = await prisma.order.findUnique({ where: { orderNo: outTradeNo } })
      const accountOrder = await prisma.accountOrder.findUnique({ where: { orderNo: outTradeNo } })

      if (workOrder) {
        const success = await handleWorkOrder(outTradeNo, totalAmount, tradeNo)
        return success ? SUCCESS_RESPONSE : FAIL_RESPONSE
      } else if (accountOrder) {
        const success = await handleAccountOrder(outTradeNo, totalAmount, tradeNo)
        return success ? SUCCESS_RESPONSE : FAIL_RESPONSE
      } else {
        console.error(`[Alipay Notify] Order not found in any table: ${outTradeNo}`)
        return FAIL_RESPONSE
      }
    }

    let success: boolean
    if (passback.orderType === "work") {
      success = await handleWorkOrder(outTradeNo, totalAmount, tradeNo)
    } else {
      success = await handleAccountOrder(outTradeNo, totalAmount, tradeNo)
    }

    return success ? SUCCESS_RESPONSE : FAIL_RESPONSE
  } catch (e) {
    console.error("[Alipay Notify] Unexpected error:", e)
    return FAIL_RESPONSE
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
  } catch {
    return NextResponse.redirect(new URL("/payment/error", request.url))
  }
}
