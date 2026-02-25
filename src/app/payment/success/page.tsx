"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { CheckCircle } from "lucide-react"

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const orderNo = searchParams.get("orderNo")
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          router.push("/")
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-4">
            <CheckCircle className="w-16 h-16 text-green-600 dark:text-green-400" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">支付成功</h1>
          {orderNo && (
            <p className="text-sm text-muted-foreground">订单号: {orderNo}</p>
          )}
          <p className="text-muted-foreground">
            感谢您的购买，订单详情已发送至您的邮箱
          </p>
        </div>

        <div className="space-y-3">
          <Button className="w-full" onClick={() => router.push("/")}>
            返回首页
          </Button>
          <p className="text-xs text-muted-foreground">
            {countdown} 秒后自动跳转
          </p>
        </div>
      </div>
    </div>
  )
}
