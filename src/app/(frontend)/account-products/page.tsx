"use client"
/** AI 服务商品列表页：卡片网格展示，文案来自设置。 */
import Link from "next/link"
import { useState, useEffect } from "react"
import { FadeContent, GlowBorder } from "@/components/react-bits"
import { CoverImage } from "@/components/frontend/CoverImage"
import { defaultNav } from "@/lib/nav-config"
import { defaultPageCopy, defaultSiteName } from "@/lib/page-copy"
import { useNavConfig } from "@/hooks/useNavConfig"
import { coverRatioToCss } from "@/lib/cover-ratio"

type AccountProduct = {
    id: string
    title: string
    slug: string
    description: string | null
    coverImage: string | null
    accountType: string
    price: number
    originalPrice: number | null
    stock: number
    features: string[]
    category?: { name: string } | null
    tags?: { id: string; name: string }[]
}

export default function AccountProductsPage() {
    const { nav, pageCopy, siteName } = useNavConfig()
    const sectionLabel = nav.accountProducts ?? defaultNav.accountProducts ?? "AI 服务"
    const sectionDesc = pageCopy.accountProductsDesc ?? defaultPageCopy.accountProductsDesc ?? ""
    const moduleCoverRatio = pageCopy.coverRatioAccountProducts
    const [list, setList] = useState<AccountProduct[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch("/api/account-products")
            .then((r) => (r.ok ? r.json() : []))
            .then((data) => setList(Array.isArray(data) ? data : []))
            .catch(() => setList([]))
            .finally(() => setLoading(false))
    }, [])

    return (
        <div className="min-h-screen px-6 md:px-12 lg:px-16 py-12 pb-28 lg:pb-16">
            <FadeContent>
                <nav className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground mb-10">
                    <Link href="/" className="hover:text-foreground transition-colors flex items-center gap-1 min-w-0 max-w-[40vw] sm:max-w-none truncate">
                        <i className="ri-home-4-line shrink-0" /> <span className="truncate">{siteName || defaultSiteName}</span>
                    </Link>
                    <i className="ri-arrow-right-s-line text-muted-foreground/60 shrink-0" />
                    <span className="text-foreground shrink-0">{sectionLabel}</span>
                </nav>
            </FadeContent>

            <FadeContent delay={0.1}>
                <div className="mb-12">
                    <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground tracking-tight mb-3">
                        {sectionLabel}
                    </h1>
                    <p className="text-muted-foreground text-lg">
                        {sectionDesc}
                    </p>
                </div>
            </FadeContent>

            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 animate-pulse">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
                            <div className="aspect-[4/3] bg-muted relative">
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-12 h-12 rounded-full bg-muted-foreground/10" />
                                </div>
                            </div>
                            <div className="p-4 space-y-2.5">
                                <div className="h-4 w-3/4 bg-muted rounded" />
                                <div className="h-3 w-full bg-muted rounded" />
                                <div className="h-6 w-20 bg-muted rounded" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : list.length === 0 ? (
                <div className="text-muted-foreground py-12">暂无{sectionLabel}</div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                    {list.map((item, index) => (
                        <FadeContent key={item.id} delay={0.1 + index * 0.05}>
                            <Link
                                href={`/account-products/${item.slug}`}
                                className="block transition-transform duration-300 hover:scale-[1.03]"
                            >
                                <GlowBorder className="group rounded-xl overflow-hidden border border-border/50 bg-card/50 backdrop-blur-sm flex flex-col h-full">
                                    <div
                                        className="overflow-hidden bg-muted relative shrink-0"
                                        style={{ aspectRatio: coverRatioToCss(moduleCoverRatio) || "4/3" }}
                                    >
                                        <CoverImage src={item.coverImage} alt={item.title} fallbackIcon="ri-robot-line" />
                                        {/* 类型徽章 */}
                                        <div className="absolute top-2 right-2">
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/60 text-white font-medium uppercase">
                                                {item.accountType}
                                            </span>
                                        </div>
                                        {/* 库存提示 */}
                                        {item.stock <= 3 && item.stock > 0 && (
                                            <div className="absolute bottom-2 left-2">
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/90 text-white font-medium">
                                                    仅剩 {item.stock} 个
                                                </span>
                                            </div>
                                        )}
                                        {item.stock === 0 && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                                <span className="text-white font-bold text-lg">已售罄</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-4 flex flex-col flex-grow">
                                        <h3 className="text-base font-medium text-foreground line-clamp-2 group-hover:text-foreground/80 transition-colors">
                                            {item.title}
                                        </h3>
                                        {item.description && (
                                            <p className="text-xs text-muted-foreground line-clamp-2 mt-1.5">{item.description}</p>
                                        )}
                                        {/* 权益预览 */}
                                        {item.features && item.features.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {item.features.slice(0, 3).map((f, i) => (
                                                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/5 text-primary/70">
                                                        {f}
                                                    </span>
                                                ))}
                                                {item.features.length > 3 && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">+{item.features.length - 3}</span>
                                                )}
                                            </div>
                                        )}
                                        {/* 价格 */}
                                        <div className="mt-auto pt-3 flex items-baseline gap-2">
                                            <span className="text-lg font-bold text-foreground">¥{item.price}</span>
                                            {item.originalPrice != null && item.originalPrice > item.price && (
                                                <span className="text-xs text-muted-foreground line-through">¥{item.originalPrice}</span>
                                            )}
                                        </div>
                                        {/* 分类/标签 */}
                                        {(item.category?.name || (item.tags && item.tags.length > 0)) && (
                                            <div className="flex flex-nowrap items-center gap-1.5 mt-2 overflow-hidden">
                                                {item.category?.name && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/5 text-primary/70 font-medium shrink-0 max-w-[3.5rem] truncate" title={item.category.name}>{item.category.name}</span>
                                                )}
                                                {(item.tags ?? []).slice(0, 2).map((tag) => (
                                                    <span key={tag.id} className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0 max-w-[3.5rem] truncate" title={tag.name}>{tag.name}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </GlowBorder>
                            </Link>
                        </FadeContent>
                    ))}
                </div>
            )}
        </div>
    )
}
