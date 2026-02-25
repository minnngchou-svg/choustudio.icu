"use client"
/** AI 服务商品编辑页：基本信息、价格库存、封面、权益说明、详细内容（BlockNote）。 */
import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import type { Block } from "@blocknote/core"
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { TagCombobox } from "@/components/admin/TagCombobox"
import { CoverImageUpload } from "@/components/admin/CoverImageUpload"
import { Editor } from "@/components/admin/DynamicBlockNoteEditor"
import { getInitialContentForEditor } from "@/lib/content-format"
import {
    DEFAULT_COVER_RATIO,
    coverRatioToCss,
    getCoverRatioRecommendText,
    normalizeCoverRatio,
    type CoverRatioId,
} from "@/lib/cover-ratio"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"

type ProductStatus = "DRAFT" | "PUBLISHED" | "PRIVATE" | "SOLD_OUT"

interface AccountProduct {
    id: string
    title: string
    slug: string
    description: string | null
    content: unknown
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
    status: ProductStatus
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

function titleToSlug(title: string): string {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
        .replace(/[\u4e00-\u9fff]+/g, "")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        || `product-${Date.now()}`
}

export default function EditAccountProductPage() {
    const { id } = useParams<{ id: string }>()
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [categories, setCategories] = useState<Category[]>([])
    const [moduleCoverRatio, setModuleCoverRatio] = useState<CoverRatioId>(DEFAULT_COVER_RATIO)
    const fetchedRef = useRef(false)

    const [title, setTitle] = useState("")
    const [slug, setSlug] = useState("")
    const [originalSlug, setOriginalSlug] = useState("")
    const [description, setDescription] = useState("")
    const [content, setContent] = useState<Block[] | null>(null)
    const [coverImage, setCoverImage] = useState("")
    const [coverRatio, setCoverRatio] = useState("3/4")
    const [accountType, setAccountType] = useState("chatgpt")
    const [price, setPrice] = useState("0")
    const [originalPrice, setOriginalPrice] = useState("")
    const [stock, setStock] = useState("0")
    const [validDays, setValidDays] = useState("")
    const [featuresText, setFeaturesText] = useState("")
    const [securityNote, setSecurityNote] = useState("")
    const [transferGuide, setTransferGuide] = useState("")
    const [warranty, setWarranty] = useState("")
    const [status, setStatus] = useState<ProductStatus>("DRAFT")
    const [categoryId, setCategoryId] = useState("")
    const [tagIds, setTagIds] = useState<string[]>([])

    useEffect(() => {
        if (!id || fetchedRef.current) return
        fetchedRef.current = true

        async function loadData() {
            try {
                const [prodRes, catRes] = await Promise.all([
                    fetch(`/api/account-products/${id}`, { credentials: "include" }),
                    fetch("/api/categories?type=ACCOUNT", { credentials: "include" }),
                ])
                if (!prodRes.ok) { toast.error("加载失败"); router.push("/admin/account-products"); return }
                const prod: AccountProduct = await prodRes.json()

                setTitle(prod.title)
                setSlug(prod.slug)
                setOriginalSlug(prod.slug)
                setDescription(prod.description || "")
                setContent(getInitialContentForEditor(prod.content))
                setCoverImage(prod.coverImage || "")
                setCoverRatio(prod.coverRatio || "3/4")
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
        }
        loadData()
    }, [id, router])

    useEffect(() => {
        fetch("/api/settings", { credentials: "include" })
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
                const copy = data?.pageCopy && typeof data.pageCopy === "object"
                    ? (data.pageCopy as Record<string, unknown>)
                    : {}
                setModuleCoverRatio(normalizeCoverRatio(copy.coverRatioAccountProducts))
            })
            .catch(() => {})
    }, [])

    async function handleSave() {
        if (!title.trim()) { toast.error("请输入标题"); return }
        if (!slug.trim()) { toast.error("请输入 slug"); return }
        if (!/^[a-z0-9][a-z0-9-]*$/.test(slug.trim())) {
            toast.error("slug 格式不正确，仅允许小写字母、数字和连字符")
            return
        }

        const priceNum = parseFloat(price)
        if (isNaN(priceNum) || priceNum < 0) {
            toast.error("请输入有效的价格（非负数）")
            return
        }

        const stockNum = parseInt(stock)
        if (isNaN(stockNum) || stockNum < 0 || !Number.isInteger(stockNum)) {
            toast.error("请输入有效的库存（非负整数）")
            return
        }

        setSaving(true)
        try {
            const features = featuresText.split("\n").map((s) => s.trim()).filter(Boolean)
            const body = {
                title: title.trim(),
                slug: slug.trim(),
                description: description || null,
                content: content || null,
                coverImage: coverImage || null,
                coverRatio,
                accountType,
                price: priceNum,
                originalPrice: originalPrice ? parseFloat(originalPrice) : null,
                stock: stockNum,
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
                setOriginalSlug(slug.trim())
            } else {
                const err = await res.json()
                toast.error(err.error || "保存失败")
            }
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete() {
        setDeleting(true)
        try {
            const res = await fetch(`/api/account-products/${id}`, {
                method: "DELETE",
                credentials: "include",
            })
            if (res.ok) {
                toast.success("删除成功")
                router.push("/admin/account-products")
            } else {
                const err = await res.json()
                toast.error(err.error || "删除失败")
            }
        } finally {
            setDeleting(false)
            setDeleteDialogOpen(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
                加载中…
            </div>
        )
    }

    return (
        <div className="space-y-0">
            <div className="sticky top-0 z-10 -mx-6 md:-mx-8 lg:-mx-12 -mt-8 px-6 md:px-8 lg:px-12 bg-background/95 backdrop-blur-sm border-b border-border/40">
                <div className="flex items-center justify-between py-3">
                    <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">
                        编辑 AI 服务商品
                    </h1>
                    <div className="flex items-center gap-2">
                        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="destructive" size="sm">
                                    <i className="ri-delete-bin-line mr-1" /> 删除
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>确认删除</DialogTitle>
                                    <DialogDescription>
                                        此操作不可撤销，确定要删除「{title}」吗？
                                    </DialogDescription>
                                </DialogHeader>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                                        取消
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        onClick={handleDelete}
                                        disabled={deleting}
                                    >
                                        {deleting ? "删除中…" : "确认删除"}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                        <Button variant="outline" onClick={() => router.push("/admin/account-products")}>
                            <i className="ri-arrow-left-line mr-1" /> 返回列表
                        </Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? "保存中…" : "保存"}
                        </Button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card className="rounded-2xl border-border/50 bg-card/50 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <i className="ri-information-line" /> 基本信息
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>标题 *</Label>
                                <Input
                                    value={title}
                                    onChange={(e) => {
                                        const newTitle = e.target.value
                                        setTitle(newTitle)
                                        if (/^product-\d+$/.test(slug) && newTitle.trim()) {
                                            setSlug(titleToSlug(newTitle))
                                        }
                                    }}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Slug *</Label>
                                <Input
                                    value={slug}
                                    onChange={(e) => {
                                        const filtered = e.target.value
                                            .toLowerCase()
                                            .replace(/[^a-z0-9-]+/g, "-")
                                            .replace(/-+/g, "-")
                                            .replace(/^-/, "")
                                        setSlug(filtered)
                                    }}
                                />
                                <p className="text-xs text-muted-foreground">
                                    仅支持小写英文、数字和短横线
                                    {slug && (
                                        <> · 前台地址：<span className="font-mono text-foreground/70">/account-products/{slug}</span></>
                                    )}
                                </p>
                                {(status === "PUBLISHED" || status === "PRIVATE") && slug !== originalSlug && (
                                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20">
                                        <i className="ri-alert-line text-amber-500 shrink-0" />
                                        <p className="text-xs text-amber-600 dark:text-amber-400">
                                            修改已发布商品的 URL 别名会导致旧链接失效，请谨慎操作。
                                        </p>
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
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
                                <div className="space-y-2">
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
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>状态</Label>
                                    <Select value={status} onValueChange={(v) => setStatus(v as ProductStatus)}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="DRAFT">草稿</SelectItem>
                                            <SelectItem value="PUBLISHED">已上架</SelectItem>
                                            <SelectItem value="PRIVATE">私密</SelectItem>
                                            <SelectItem value="SOLD_OUT">售罄</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>标签</Label>
                                    <TagCombobox value={tagIds} onChange={setTagIds} />
                                </div>
                            </div>
                            <Separator />
                            <div className="space-y-2">
                                <Label>简介</Label>
                                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl border-border/50 bg-card/50 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <i className="ri-article-line" /> 详细内容
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Editor
                                value={content}
                                onChange={setContent}
                                placeholder="可填写商品详细介绍、使用说明、常见问题等…"
                                minHeight="300px"
                                entityType="ACCOUNT_PRODUCT"
                                entityId={id}
                            />
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl border-border/50 bg-card/50 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <i className="ri-shield-check-line" /> 权益与安全
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
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
                            <div className="space-y-2">
                                <Label>账号安全说明</Label>
                                <Textarea value={securityNote} onChange={(e) => setSecurityNote(e.target.value)} rows={3} placeholder="说明账号安全事项…" />
                            </div>
                            <div className="space-y-2">
                                <Label>转移/使用流程</Label>
                                <Textarea value={transferGuide} onChange={(e) => setTransferGuide(e.target.value)} rows={3} placeholder="描述如何使用或转移账号…" />
                            </div>
                            <div className="space-y-2">
                                <Label>售后保障</Label>
                                <Textarea value={warranty} onChange={(e) => setWarranty(e.target.value)} rows={3} placeholder="描述售后保障政策…" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card className="rounded-2xl border-border/50 bg-card/50 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <i className="ri-image-line" /> 封面图
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>封面比例</Label>
                                <Select value={coverRatio} onValueChange={setCoverRatio}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="3/4">3:4 竖版</SelectItem>
                                        <SelectItem value="1/1">1:1 正方形</SelectItem>
                                        <SelectItem value="4/3">4:3 横版</SelectItem>
                                        <SelectItem value="16/9">16:9 宽屏</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <CoverImageUpload
                                value={coverImage}
                                onChange={setCoverImage}
                                entityType="ACCOUNT_PRODUCT"
                                entityId={id}
                                aspectRatio={coverRatioToCss(coverRatio as CoverRatioId)}
                                recommendText={getCoverRatioRecommendText(moduleCoverRatio)}
                            />
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl border-border/50 bg-card/50 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <i className="ri-money-cny-circle-line" /> 价格与库存
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>售价 (¥) *</Label>
                                <Input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>原价 (¥) — 划线价</Label>
                                <Input type="number" step="0.01" min="0" value={originalPrice} onChange={(e) => setOriginalPrice(e.target.value)} placeholder="可不填" />
                            </div>
                            <div className="space-y-2">
                                <Label>库存</Label>
                                <Input type="number" min="0" step="1" value={stock} onChange={(e) => setStock(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>有效天数</Label>
                                <Input type="number" min="1" step="1" value={validDays} onChange={(e) => setValidDays(e.target.value)} placeholder="空 = 永久" />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
