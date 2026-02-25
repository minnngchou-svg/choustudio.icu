import crypto from "crypto"
import type { PaymentConfig } from "./payment-config"

export interface AlipayOrderParams {
  outTradeNo: string
  totalAmount: number
  subject: string
  body?: string
}

export interface AlipayCreateResult {
  success: boolean
  payUrl?: string
  error?: string
}

function sign(params: Record<string, string>, privateKey: string): string {
  const sortedParams = Object.keys(params)
    .filter((k) => params[k] !== "" && params[k] !== undefined)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&")

  const sign = crypto.createSign("RSA-SHA256")
  sign.update(sortedParams)
  return sign.sign(privateKey, "base64")
}

function verifySign(params: Record<string, string>, publicKey: string, signStr: string): boolean {
  const sortedParams = Object.keys(params)
    .filter((k) => k !== "sign" && k !== "sign_type" && params[k] !== "")
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&")

  const verify = crypto.createVerify("RSA-SHA256")
  verify.update(sortedParams)
  return verify.verify(publicKey, signStr, "base64")
}

export function createAlipayClient(config: PaymentConfig) {
  const { alipayAppId, alipayPrivateKey, alipayPublicKey, alipayNotifyUrl, alipayReturnUrl } = config

  if (!alipayAppId || !alipayPrivateKey || !alipayPublicKey) {
    return null
  }

  const isProduction = process.env.NODE_ENV === "production"
  const gatewayUrl = isProduction
    ? "https://openapi.alipay.com/gateway.do"
    : "https://openapi.alipaydev.com/gateway.do"

  return {
    createPagePay(params: AlipayOrderParams): AlipayCreateResult {
      try {
        const bizContent = {
          out_trade_no: params.outTradeNo,
          total_amount: params.totalAmount.toFixed(2),
          subject: params.subject,
          product_code: "FAST_INSTANT_TRADE_PAY",
          ...(params.body && { body: params.body }),
        }

        const requestParams: Record<string, string> = {
          app_id: alipayAppId,
          method: "alipay.trade.page.pay",
          format: "JSON",
          return_url: alipayReturnUrl || "",
          charset: "utf-8",
          sign_type: "RSA2",
          timestamp: new Date().toLocaleString("zh-CN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          }).replace(/\//g, "-"),
          version: "1.0",
          notify_url: alipayNotifyUrl || "",
          biz_content: JSON.stringify(bizContent),
        }

        const signStr = sign(requestParams, alipayPrivateKey)
        requestParams.sign = signStr

        const queryString = Object.keys(requestParams)
          .map((k) => `${k}=${encodeURIComponent(requestParams[k])}`)
          .join("&")

        return {
          success: true,
          payUrl: `${gatewayUrl}?${queryString}`,
        }
      } catch (e) {
        return {
          success: false,
          error: e instanceof Error ? e.message : "创建支付失败",
        }
      }
    },

    verifyCallback(params: Record<string, string>): boolean {
      const signStr = params.sign
      if (!signStr) return false
      return verifySign(params, alipayPublicKey, signStr)
    },

    queryOrder(outTradeNo: string): Promise<{ success: boolean; status?: string; error?: string }> {
      return new Promise((resolve) => {
        try {
          const bizContent = { out_trade_no: outTradeNo }

          const requestParams: Record<string, string> = {
            app_id: alipayAppId,
            method: "alipay.trade.query",
            format: "JSON",
            charset: "utf-8",
            sign_type: "RSA2",
            timestamp: new Date().toLocaleString("zh-CN", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: false,
            }).replace(/\//g, "-"),
            version: "1.0",
            biz_content: JSON.stringify(bizContent),
          }

          const signStr = sign(requestParams, alipayPrivateKey)
          requestParams.sign = signStr

          const queryString = Object.keys(requestParams)
            .map((k) => `${k}=${encodeURIComponent(requestParams[k])}`)
            .join("&")

          fetch(`${gatewayUrl}?${queryString}`)
            .then((res) => res.json())
            .then((data) => {
              const response = data.alipay_trade_query_response
              if (response && response.code === "10000") {
                resolve({
                  success: true,
                  status: response.trade_status,
                })
              } else {
                resolve({
                  success: false,
                  error: response?.msg || "查询失败",
                })
              }
            })
            .catch((e) => {
              resolve({
                success: false,
                error: e instanceof Error ? e.message : "查询失败",
              })
            })
        } catch (e) {
          resolve({
            success: false,
            error: e instanceof Error ? e.message : "查询失败",
          })
        }
      })
    },
  }
}

export type AlipayClient = ReturnType<typeof createAlipayClient>
