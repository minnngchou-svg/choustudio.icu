"use client"
/** 新建文章：先 POST 创建草稿再跳转编辑页。 */
import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export default function NewPostPage() {
  const router = useRouter()
  const creating = useRef(false)

  useEffect(() => {
    if (creating.current) return
    creating.current = true

    fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        title: "无标题文章",
        slug: `draft-${Date.now()}`,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.id) {
          router.replace(`/admin/posts/${data.id}/edit`)
        } else {
          toast.error(data?.error || "创建失败")
          router.replace("/admin/posts")
        }
      })
      .catch(() => {
        toast.error("网络错误")
        router.replace("/admin/posts")
      })
  }, [router])

  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex items-center gap-3 text-muted-foreground">
        <i className="ri-loader-4-line animate-spin text-lg" />
        <span className="text-sm">正在创建文章…</span>
      </div>
    </div>
  )
}
