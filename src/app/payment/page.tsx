"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

export default function PaymentPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const orderId = searchParams.get("orderId")
  const orderType = searchParams.get("type") || "work"
  const [loading, setLoading] = useState(false)
  const [order, setOrder] = useState<{
    orderNo: string
    amount: number
    title: string
  } | null>(null)

  useEffect(() => {
    if (orderId) {
      fetchOrder()
    }
  }, [orderId, orderType])

  async function fetchOrder() {
    try {
      const endpoint = orderType === "work" ? `/api/orders/${orderId}` : `/api/account-orders?orderId=${orderId}`
      const res = await fetch(endpoint, { credentials: "include" })
      if (res.ok) {
        const data = await res.json()
        setOrder({
          orderNo: data.orderNo,
          amount: Number(data.amount),
          title: data.work?.title || data.accountProduct?.title || "商品",
        })
      }
    } catch {
      toast.error("获取订单信息失败")
    }
  }

  async function handleWechatPay() {
    setLoading(true)
    try {
      const res = await fetch("/api/payment/wechat/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orderId, orderType }),
      })
      const data = await res.json()
      if (res.ok && data.qrUrl) {
        window.location.href = data.qrUrl
      } else {
        toast.error(data.error || "创建微信支付失败")
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleAlipay() {
    setLoading(true)
    try {
      const res = await fetch("/api/payment/alipay/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orderId, orderType }),
      })
      const data = await res.json()
      if (res.ok && data.payUrl) {
        window.location.href = data.payUrl
      } else {
        toast.error(data.error || "创建支付宝支付失败")
      }
    } finally {
      setLoading(false)
    }
  }

  if (!orderId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <i className="ri-error-warning-line text-4xl text-muted-foreground" />
          <p className="text-muted-foreground">订单信息缺失</p>
          <Button variant="outline" onClick={() => router.push("/")}>
            返回首页
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">选择支付方式</h1>
          {order && (
            <div className="space-y-1">
              <p className="text-muted-foreground">{order.title}</p>
              <p className="text-sm text-muted-foreground">订单号: {order.orderNo}</p>
              <p className="text-3xl font-bold text-foreground">
                ¥{order.amount.toFixed(2)}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <Button
            onClick={handleWechatPay}
            disabled={loading}
            className="w-full h-14 text-lg flex items-center justify-center gap-3 bg-green-600 hover:bg-green-700"
          >
            <i className="ri-wechat-pay-line text-2xl" />
            微信支付
          </Button>

          <Button
            onClick={handleAlipay}
            disabled={loading}
            className="w-full h-14 text-lg flex items-center justify-center gap-3 bg-blue-500 hover:bg-blue-600"
          >
            <i className="ri-alipay-line text-2xl" />
            支付宝
          </Button>
        </div>

        <div className="text-center">
          <Button variant="ghost" onClick={() => router.back()}>
            返回
          </Button>
        </div>
      </div>
    </div>
  )
}
