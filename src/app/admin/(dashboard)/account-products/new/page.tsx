"use client"
/** AI 服务商品 — 新建页面（快速草稿然后跳转到编辑页） */
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export default function NewAccountProductPage() {
    const router = useRouter()

    useEffect(() => {
        async function createDraft() {
            const ts = Date.now().toString(36)
            const res = await fetch("/api/account-products", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: `新 AI 服务商品 ${ts}`,
                    slug: `ai-service-${ts}`,
                    accountType: "chatgpt",
                    price: 0,
                }),
            })
            if (res.ok) {
                const data = await res.json()
                router.replace(`/admin/account-products/${data.id}/edit`)
            } else {
                toast.error("创建失败")
                router.push("/admin/account-products")
            }
        }
        createDraft()
    }, [router])

    return (
        <div className="flex items-center justify-center min-h-[40vh]">
            <p className="text-muted-foreground">正在创建…</p>
        </div>
    )
}
