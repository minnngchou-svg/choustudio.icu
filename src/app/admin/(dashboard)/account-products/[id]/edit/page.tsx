"use client"
/** AI 服务商品编辑页 */
import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { TagCombobox } from "@/components/admin/TagCombobox"

interface AccountProduct {
    id: string
    title: string
    slug: string
    description: string | null
    coverImage: string | null
    coverRatio: string
    accountType: string
    price: number
    originalPrice: number | null
    stock: number
    validDays: number | null
    features: string[]
    securityNote: string | null
    transferGuide: string | null
    warranty: string | null
    status: string
    categoryId: string | null
    tags: { id: string; name: string }[]
}

interface Category { id: string; name: string; type: string }

const ACCOUNT_TYPES = [
    { value: "chatgpt", label: "ChatGPT" },
    { value: "gemini", label: "Gemini" },
    { value: "cursor", label: "Cursor" },
    { value: "claude", label: "Claude" },
    { value: "gmail", label: "Gmail" },
    { value: "other", label: "其他" },
]

export default function EditAccountProductPage() {
    const { id } = useParams<{ id: string }>()
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [categories, setCategories] = useState<Category[]>([])

    const [title, setTitle] = useState("")
    const [slug, setSlug] = useState("")
    const [description, setDescription] = useState("")
    const [accountType, setAccountType] = useState("chatgpt")
    const [price, setPrice] = useState("0")
    const [originalPrice, setOriginalPrice] = useState("")
    const [stock, setStock] = useState("0")
    const [validDays, setValidDays] = useState("")
    const [featuresText, setFeaturesText] = useState("")
    const [securityNote, setSecurityNote] = useState("")
    const [transferGuide, setTransferGuide] = useState("")
    const [warranty, setWarranty] = useState("")
    const [status, setStatus] = useState("DRAFT")
    const [categoryId, setCategoryId] = useState("")
    const [tagIds, setTagIds] = useState<string[]>([])

    const loadData = useCallback(async () => {
        try {
            const [prodRes, catRes] = await Promise.all([
                fetch(`/api/account-products/${id}`, { credentials: "include" }),
                fetch("/api/categories?type=ACCOUNT", { credentials: "include" }),
            ])
            if (!prodRes.ok) { toast.error("加载失败"); return }
            const prod: AccountProduct = await prodRes.json()

            setTitle(prod.title)
            setSlug(prod.slug)
            setDescription(prod.description || "")
            setAccountType(prod.accountType)
            setPrice(String(prod.price))
            setOriginalPrice(prod.originalPrice != null ? String(prod.originalPrice) : "")
            setStock(String(prod.stock))
            setValidDays(prod.validDays != null ? String(prod.validDays) : "")
            setFeaturesText((prod.features || []).join("\n"))
            setSecurityNote(prod.securityNote || "")
            setTransferGuide(prod.transferGuide || "")
            setWarranty(prod.warranty || "")
            setStatus(prod.status)
            setCategoryId(prod.categoryId || "")
            setTagIds(Array.isArray(prod.tags) ? prod.tags.map((t) => t.id) : [])

            if (catRes.ok) setCategories(await catRes.json())
        } finally {
            setLoading(false)
        }
    }, [id])

    useEffect(() => { loadData() }, [loadData])

    async function handleSave() {
        if (!title.trim()) { toast.error("请输入标题"); return }
        if (!slug.trim()) { toast.error("请输入 slug"); return }

        setSaving(true)
        try {
            const features = featuresText.split("\n").map((s) => s.trim()).filter(Boolean)
            const body = {
                title: title.trim(),
                slug: slug.trim(),
                description: description || null,
                accountType,
                price: parseFloat(price) || 0,
                originalPrice: originalPrice ? parseFloat(originalPrice) : null,
                stock: parseInt(stock) || 0,
                validDays: validDays ? parseInt(validDays) : null,
                features,
                securityNote: securityNote || null,
                transferGuide: transferGuide || null,
                warranty: warranty || null,
                status,
                categoryId: categoryId || null,
                tagIds,
            }

            const res = await fetch(`/api/account-products/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(body),
            })
            if (res.ok) {
                toast.success("保存成功")
            } else {
                const err = await res.json()
                toast.error(err.error || "保存失败")
            }
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return <div className="flex items-center justify-center min-h-[40vh]"><p className="text-muted-foreground">加载中…</p></div>
    }

    return (
        <div className="max-w-3xl">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">编辑 AI 服务商品</h1>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => router.push("/admin/account-products")}>
                        <i className="ri-arrow-left-line mr-1" /> 返回列表
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? "保存中…" : "保存"}
                    </Button>
                </div>
            </div>

            <div className="space-y-6">
                {/* 基本信息 */}
                <section className="space-y-4 rounded-lg border p-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <i className="ri-information-line" /> 基本信息
                    </h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <Label>标题 *</Label>
                            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                        </div>
                        <div className="col-span-2">
                            <Label>Slug *</Label>
                            <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
                        </div>
                        <div>
                            <Label>账号类型 *</Label>
                            <Select value={accountType} onValueChange={setAccountType}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {ACCOUNT_TYPES.map((t) => (
                                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>分类</Label>
                            <Select value={categoryId || "none"} onValueChange={(v) => setCategoryId(v === "none" ? "" : v)}>
                                <SelectTrigger><SelectValue placeholder="无分类" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">无分类</SelectItem>
                                    {categories.map((c) => (
                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>状态</Label>
                            <Select value={status} onValueChange={setStatus}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="DRAFT">草稿</SelectItem>
                                    <SelectItem value="PUBLISHED">已上架</SelectItem>
                                    <SelectItem value="PRIVATE">私密</SelectItem>
                                    <SelectItem value="SOLD_OUT">售罄</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>标签</Label>
                            <TagCombobox value={tagIds} onChange={setTagIds} />
                        </div>
                    </div>
                    <div>
                        <Label>简介</Label>
                        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
                    </div>
                </section>

                {/* 价格与库存 */}
                <section className="space-y-4 rounded-lg border p-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <i className="ri-money-cny-circle-line" /> 价格与库存
                    </h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>售价 (¥) *</Label>
                            <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
                        </div>
                        <div>
                            <Label>原价 (¥) — 划线价</Label>
                            <Input type="number" step="0.01" value={originalPrice} onChange={(e) => setOriginalPrice(e.target.value)} placeholder="可不填" />
                        </div>
                        <div>
                            <Label>库存</Label>
                            <Input type="number" value={stock} onChange={(e) => setStock(e.target.value)} />
                        </div>
                        <div>
                            <Label>有效天数</Label>
                            <Input type="number" value={validDays} onChange={(e) => setValidDays(e.target.value)} placeholder="空 = 永久" />
                        </div>
                    </div>
                </section>

                {/* 权益与说明 */}
                <section className="space-y-4 rounded-lg border p-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <i className="ri-shield-check-line" /> 权益与安全
                    </h2>
                    <div>
                        <Label>
                            权益列表
                            <Badge variant="outline" className="ml-2 text-xs">每行一项</Badge>
                        </Label>
                        <Textarea
                            value={featuresText}
                            onChange={(e) => setFeaturesText(e.target.value)}
                            rows={4}
                            placeholder={"GPT-4 访问\n无限用量\n专属客服"}
                        />
                    </div>
                    <div>
                        <Label>账号安全说明</Label>
                        <Textarea value={securityNote} onChange={(e) => setSecurityNote(e.target.value)} rows={3} placeholder="说明账号安全事项…" />
                    </div>
                    <div>
                        <Label>转移/使用流程</Label>
                        <Textarea value={transferGuide} onChange={(e) => setTransferGuide(e.target.value)} rows={3} placeholder="描述如何使用或转移账号…" />
                    </div>
                    <div>
                        <Label>售后保障</Label>
                        <Textarea value={warranty} onChange={(e) => setWarranty(e.target.value)} rows={3} placeholder="描述售后保障政策…" />
                    </div>
                </section>
            </div>
        </div>
    )
}
