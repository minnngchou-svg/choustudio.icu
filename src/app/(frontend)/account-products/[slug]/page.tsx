"use client"
/** AI 服务商品详情页：展示商品信息、权益、购买流程。 */
import Link from "next/link"
import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import { toast } from "sonner"
import { FadeContent, GlowBorder } from "@/components/react-bits"
import { CoverImage } from "@/components/frontend/CoverImage"
import { FavoriteButton } from "@/components/frontend/FavoriteButton"
import { HistoryTracker } from "@/components/frontend/HistoryTracker"
import { defaultNav } from "@/lib/nav-config"
import { defaultSiteName } from "@/lib/page-copy"
import { useNavConfig } from "@/hooks/useNavConfig"
import { useAuth } from "@/hooks/useAuth"

type AccountProduct = {
    id: string
    title: string
    slug: string
    description: string | null
    content: string | null
    coverImage: string | null
    showCoverImage: boolean
    accountType: string
    price: number
    originalPrice: number | null
    stock: number
    validDays: number | null
    features: string[]
    securityNote: string | null
    transferGuide: string | null
    warranty: string | null
    category?: { name: string } | null
    tags?: { id: string; name: string }[]
}

export default function AccountProductDetailPage() {
    const { slug } = useParams<{ slug: string }>()
    const { nav, siteName } = useNavConfig()
    const { isLoggedIn, user, isLoading: authLoading } = useAuth()
    const sectionLabel = nav.accountProducts ?? defaultNav.accountProducts ?? "AI 服务"
    const [product, setProduct] = useState<AccountProduct | null>(null)
    const [loading, setLoading] = useState(true)
    const [buying, setBuying] = useState(false)
    const [showBuyForm, setShowBuyForm] = useState(false)
    const [buyerName, setBuyerName] = useState("")
    const [buyerEmail, setBuyerEmail] = useState("")
    const [buyerContact, setBuyerContact] = useState("")
    const [showLoginPrompt, setShowLoginPrompt] = useState(false)

    const loadProduct = useCallback(async () => {
        try {
            const res = await fetch(`/api/account-products?slug=${encodeURIComponent(slug)}`)
            if (res.ok) {
                const data = await res.json()
                setProduct(data)
            }
        } finally {
            setLoading(false)
        }
    }, [slug])

    useEffect(() => { loadProduct() }, [loadProduct])

    useEffect(() => {
        if (isLoggedIn && user) {
            setBuyerName(user.nickname || user.name || "")
            setBuyerEmail(user.email || "")
        }
    }, [isLoggedIn, user])

    useEffect(() => {
        if (product) {
            document.title = `${product.title} | ${sectionLabel} | ${siteName || defaultSiteName}`
        }
    }, [product, sectionLabel, siteName])

    async function handleBuy() {
        if (!buyerName.trim() || !buyerEmail.trim()) {
            toast.error("请填写姓名和邮箱")
            return
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)) {
            toast.error("邮箱格式不正确")
            return
        }
        if (!product) return

        setBuying(true)
        try {
            const res = await fetch("/api/account-orders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    accountProductId: product.id,
                    buyerName: buyerName.trim(),
                    buyerEmail: buyerEmail.trim(),
                    buyerContact: buyerContact.trim() || null,
                }),
            })
            if (res.ok) {
                const data = await res.json()
                toast.success(`下单成功！订单号: ${data.orderNo}`)
                setShowBuyForm(false)
                loadProduct()
            } else {
                const err = await res.json()
                toast.error(err.error || "下单失败")
            }
        } finally {
            setBuying(false)
        }
    }

    function handleBuyClick() {
        if (!isLoggedIn) {
            setShowLoginPrompt(true)
            return
        }
        setShowBuyForm(true)
    }

    if (loading) {
        return (
            <div className="min-h-screen px-6 md:px-12 lg:px-16 py-12 pb-28 lg:pb-16">
                <div className="animate-pulse space-y-6 max-w-3xl">
                    <div className="h-6 w-48 bg-muted rounded" />
                    <div className="h-10 w-2/3 bg-muted rounded" />
                    <div className="aspect-[16/9] bg-muted rounded-xl" />
                    <div className="space-y-3">
                        <div className="h-4 w-full bg-muted rounded" />
                        <div className="h-4 w-3/4 bg-muted rounded" />
                    </div>
                </div>
            </div>
        )
    }

    if (!product) {
        return (
            <div className="min-h-screen px-6 md:px-12 lg:px-16 py-12 pb-28 lg:pb-16 flex items-center justify-center">
                <div className="text-center space-y-4">
                    <i className="ri-error-warning-line text-4xl text-muted-foreground" />
                    <p className="text-muted-foreground">商品不存在或已下架</p>
                    <Link href="/account-products" className="text-primary hover:underline text-sm">
                        ← 返回列表
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen px-6 md:px-12 lg:px-16 py-12 pb-28 lg:pb-16">
            <HistoryTracker
                itemType="ACCOUNT_PRODUCT"
                itemId={product.id}
                title={product.title}
                coverImage={product.coverImage || undefined}
            />

            <FadeContent>
                <nav className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground mb-10">
                    <Link href="/" className="hover:text-foreground transition-colors flex items-center gap-1">
                        <i className="ri-home-4-line" /> <span>{siteName || defaultSiteName}</span>
                    </Link>
                    <i className="ri-arrow-right-s-line text-muted-foreground/60" />
                    <Link href="/account-products" className="hover:text-foreground transition-colors">{sectionLabel}</Link>
                    <i className="ri-arrow-right-s-line text-muted-foreground/60" />
                    <span className="text-foreground">{product.title}</span>
                </nav>
            </FadeContent>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl">
                <div className="lg:col-span-2 space-y-8">
                    <FadeContent delay={0.1}>
                        {product.coverImage && product.showCoverImage && (
                            <div className="rounded-xl overflow-hidden border border-border/50 bg-muted">
                                <CoverImage src={product.coverImage} alt={product.title} fallbackIcon="ri-robot-line" />
                            </div>
                        )}

                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium uppercase">
                                    {product.accountType}
                                </span>
                                {product.category?.name && (
                                    <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                                        {product.category.name}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground tracking-tight">
                                    {product.title}
                                </h1>
                                <FavoriteButton
                                    itemType="ACCOUNT_PRODUCT"
                                    itemId={product.id}
                                    title={product.title}
                                    coverImage={product.coverImage || undefined}
                                />
                            </div>
                            {product.description && (
                                <p className="text-muted-foreground text-lg">{product.description}</p>
                            )}
                        </div>
                    </FadeContent>

                    {product.features && product.features.length > 0 && (
                        <FadeContent delay={0.2}>
                            <GlowBorder className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-6">
                                <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground mb-4">
                                    <i className="ri-star-line text-amber-500" /> 权益内容
                                </h2>
                                <ul className="space-y-2">
                                    {product.features.map((f, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm">
                                            <i className="ri-check-line text-green-500 mt-0.5 shrink-0" />
                                            <span className="text-foreground/90">{f}</span>
                                        </li>
                                    ))}
                                </ul>
                            </GlowBorder>
                        </FadeContent>
                    )}

                    {product.transferGuide && (
                        <FadeContent delay={0.25}>
                            <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-6">
                                <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground mb-3">
                                    <i className="ri-exchange-line text-blue-500" /> 使用/转移流程
                                </h2>
                                <p className="text-sm text-muted-foreground whitespace-pre-line">{product.transferGuide}</p>
                            </div>
                        </FadeContent>
                    )}

                    {product.securityNote && (
                        <FadeContent delay={0.3}>
                            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6">
                                <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground mb-3">
                                    <i className="ri-shield-check-line text-amber-500" /> 安全说明
                                </h2>
                                <p className="text-sm text-muted-foreground whitespace-pre-line">{product.securityNote}</p>
                            </div>
                        </FadeContent>
                    )}

                    {product.warranty && (
                        <FadeContent delay={0.35}>
                            <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-6">
                                <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground mb-3">
                                    <i className="ri-customer-service-2-line text-green-500" /> 售后保障
                                </h2>
                                <p className="text-sm text-muted-foreground whitespace-pre-line">{product.warranty}</p>
                            </div>
                        </FadeContent>
                    )}
                </div>

                <div className="lg:col-span-1">
                    <FadeContent delay={0.15}>
                        <div className="sticky top-8 space-y-4">
                            <GlowBorder className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-6">
                                <div className="flex items-baseline gap-2 mb-4">
                                    <span className="text-3xl font-bold text-foreground">¥{Number(product.price).toFixed(2)}</span>
                                    {product.originalPrice != null && product.originalPrice > product.price && (
                                        <span className="text-sm text-muted-foreground line-through">¥{Number(product.originalPrice).toFixed(2)}</span>
                                    )}
                                </div>

                                <div className="space-y-2 mb-6 text-sm">
                                    {product.validDays && (
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">有效期</span>
                                            <span className="text-foreground">{product.validDays} 天</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">库存</span>
                                        <span className={product.stock <= 3 ? "text-amber-500 font-medium" : "text-foreground"}>
                                            {product.stock > 0 ? `${product.stock} 个` : "已售罄"}
                                        </span>
                                    </div>
                                </div>

                                {product.stock > 0 ? (
                                    showBuyForm ? (
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-xs text-muted-foreground">姓名</label>
                                                <input
                                                    type="text"
                                                    placeholder="您的姓名 *"
                                                    value={buyerName}
                                                    onChange={(e) => setBuyerName(e.target.value)}
                                                    disabled={isLoggedIn}
                                                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-muted-foreground">邮箱</label>
                                                <input
                                                    type="email"
                                                    placeholder="邮箱地址 *"
                                                    value={buyerEmail}
                                                    onChange={(e) => setBuyerEmail(e.target.value)}
                                                    disabled={isLoggedIn}
                                                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                                                />
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="其他联系方式（微信/手机）"
                                                value={buyerContact}
                                                onChange={(e) => setBuyerContact(e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                                            />
                                            {isLoggedIn && (
                                                <p className="text-xs text-muted-foreground">
                                                    <i className="ri-information-line mr-1" />
                                                    已登录用户信息自动填充
                                                </p>
                                            )}
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setShowBuyForm(false)}
                                                    className="flex-1 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition-colors"
                                                >
                                                    取消
                                                </button>
                                                <button
                                                    onClick={handleBuy}
                                                    disabled={buying}
                                                    className="flex-1 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50"
                                                >
                                                    {buying ? "提交中…" : "确认下单"}
                                                </button>
                                            </div>
                                        </div>
                                    ) : showLoginPrompt ? (
                                        <div className="space-y-3 text-center">
                                            <p className="text-sm text-muted-foreground">
                                                请先登录后再购买
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                登录后可追踪订单状态、同步购买记录
                                            </p>
                                            <button
                                                onClick={() => setShowLoginPrompt(false)}
                                                className="w-full py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition-colors"
                                            >
                                                返回
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={handleBuyClick}
                                            className="w-full py-3 rounded-lg bg-foreground text-background font-medium hover:bg-foreground/90 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <i className="ri-shopping-bag-line" /> 立即购买
                                        </button>
                                    )
                                ) : (
                                    <button
                                        disabled
                                        className="w-full py-3 rounded-lg bg-muted text-muted-foreground font-medium cursor-not-allowed"
                                    >
                                        已售罄
                                    </button>
                                )}
                            </GlowBorder>

                            {product.tags && product.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {product.tags.map((tag) => (
                                        <span key={tag.id} className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                                            {tag.name}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </FadeContent>
                </div>
            </div>
        </div>
    )
}
