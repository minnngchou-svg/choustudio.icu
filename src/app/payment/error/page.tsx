"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { XCircle } from "lucide-react"

export default function PaymentErrorPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const reason = searchParams.get("reason")

  const errorMessages: Record<string, string> = {
    config: "支付配置错误，请联系管理员",
    sign: "支付签名验证失败",
    order: "订单信息错误",
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-red-100 dark:bg-red-900/30 p-4">
            <XCircle className="w-16 h-16 text-red-600 dark:text-red-400" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">支付失败</h1>
          <p className="text-muted-foreground">
            {errorMessages[reason || ""] || "支付过程中发生错误，请稍后重试"}
          </p>
        </div>

        <div className="space-y-3">
          <Button className="w-full" onClick={() => router.push("/payment")}>
            重新支付
          </Button>
          <Button variant="outline" className="w-full" onClick={() => router.push("/")}>
            返回首页
          </Button>
        </div>
      </div>
    </div>
  )
}
