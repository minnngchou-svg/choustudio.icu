import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { requireAdmin } from "@/lib/require-admin"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { sendOrderEmail } from "@/lib/email"
import { normalizeSiteName } from "@/lib/page-copy"

export const dynamic = "force-dynamic"

// NOTE (M1): 内存级限流器在多实例部署时各实例独立计数，生产环境建议迁移至 Redis
const orderRateLimit = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW = 60 * 1000
const RATE_LIMIT_MAX = 5

// 定期清理过期记录，防止内存泄漏 (M2)
if (typeof setInterval !== "undefined") {
    setInterval(() => {
        const now = Date.now()
        for (const [key, val] of orderRateLimit) {
            if (now > val.resetAt) orderRateLimit.delete(key)
        }
    }, 5 * 60 * 1000)
}

function checkRateLimit(key: string): boolean {
    const now = Date.now()
    const record = orderRateLimit.get(key)
    if (!record || now > record.resetAt) {
        orderRateLimit.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
        return true
    }
    if (record.count >= RATE_LIMIT_MAX) return false
    record.count++
    return true
}

function generateOrderNo(): string {
    const now = new Date()
    const ts = now.toISOString().replace(/[-:T.Z]/g, "").slice(0, 14)
    const rand = randomBytes(3).toString("hex")
    return `AO${ts}${rand}`
}

/** POST: 创建账号商品订单 */
export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        const userId = session?.user?.id || null

        const body = await request.json()
        const { accountProductId, buyerEmail, buyerName, buyerContact } = body

        if (!accountProductId || typeof accountProductId !== "string") {
            return NextResponse.json({ error: "缺少 accountProductId" }, { status: 400 })
        }
        if (!buyerEmail || typeof buyerEmail !== "string" || !buyerEmail.includes("@")) {
            return NextResponse.json({ error: "请输入有效的邮箱地址" }, { status: 400 })
        }

        const normalizedEmail = buyerEmail.trim().toLowerCase()
        if (!checkRateLimit(normalizedEmail)) {
            return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 })
        }

        const product = await prisma.accountProduct.findUnique({
            where: { id: accountProductId },
        })
        if (!product || product.status !== "PUBLISHED") {
            return NextResponse.json({ error: "商品不存在或未上架" }, { status: 404 })
        }
        if (product.stock <= 0) {
            return NextResponse.json({ error: "商品已售罄" }, { status: 400 })
        }

        const amount = Number(product.price)
        const orderNo = generateOrderNo()

        // 乐观锁：仅当 stock > 0 时扣减，防止并发超卖
        const order = await prisma.$transaction(async (tx) => {
            const updated = await tx.accountProduct.updateMany({
                where: { id: accountProductId, stock: { gt: 0 } },
                data: { stock: { decrement: 1 } },
            })
            if (updated.count === 0) {
                throw new Error("SOLD_OUT")
            }
            return tx.accountOrder.create({
                data: {
                    orderNo,
                    accountProductId,
                    amount,
                    status: "PENDING",
                    buyerEmail: normalizedEmail,
                    buyerName: buyerName?.trim() || null,
                    ...(buyerContact ? { deliveryInfo: { buyerContact: buyerContact.trim() } } : {}),
                    ...(userId ? { userId } : {}),
                },
            })
        })

        // 发送订单邮件（异步）
        const settings = await prisma.settings.findUnique({ where: { id: "settings" } })
        sendOrderEmail({
            to: order.buyerEmail,
            siteName: normalizeSiteName(settings?.siteName),
            workTitle: product.title,
            orderNo: order.orderNo,
            isFree: false,
            figmaUrl: null,
            deliveryUrl: null,
            currentVersion: null,
            wechat: ((settings?.socialLinks as Record<string, string> | null) || {}).wechat || null,
        }).catch(() => { })

        return NextResponse.json({
            id: order.id,
            orderNo: order.orderNo,
            status: order.status,
            amount,
        })
    } catch (e) {
        if (e instanceof Error && e.message === "SOLD_OUT") {
            return NextResponse.json({ error: "商品已售罄" }, { status: 400 })
        }
        const message = e instanceof Error ? e.message : "创建订单失败"
        return NextResponse.json({ error: "创建订单失败", detail: message }, { status: 500 })
    }
}

/** GET: 管理员查询账号商品订单 */
export async function GET(request: NextRequest) {
    const check = await requireAdmin()
    if (!check.authorized) return check.response

    try {
        const { searchParams } = new URL(request.url)
        const statusFilter = searchParams.get("status")
        const search = searchParams.get("search")?.trim()
        const orderId = searchParams.get("orderId")

        if (orderId) {
            const order = await prisma.accountOrder.findUnique({
                where: { id: orderId },
                include: {
                    accountProduct: { select: { id: true, title: true, accountType: true } },
                },
            })
            if (!order) {
                return NextResponse.json({ error: "订单不存在" }, { status: 404 })
            }
            return NextResponse.json({
                ...order,
                amount: Number(order.amount),
                accountProduct: order.accountProduct,
            })
        }

        const where: Record<string, unknown> = {}
        if (statusFilter && statusFilter !== "all") {
            where.status = statusFilter
        }
        if (search) {
            where.OR = [
                { orderNo: { contains: search } },
                { buyerEmail: { contains: search } },
            ]
        }

        const orders = await prisma.accountOrder.findMany({
            where,
            orderBy: { createdAt: "desc" },
            include: {
                accountProduct: { select: { id: true, title: true, accountType: true } },
            },
            take: 100,
        })

        return NextResponse.json(
            orders.map((o) => ({
                id: o.id,
                orderNo: o.orderNo,
                productTitle: o.accountProduct.title,
                accountType: o.accountProduct.accountType,
                productId: o.accountProduct.id,
                buyerEmail: o.buyerEmail,
                buyerName: o.buyerName,
                amount: Number(o.amount),
                status: o.status,
                paidAt: o.paidAt,
                deliveredAt: o.deliveredAt,
                createdAt: o.createdAt,
            })),
        )
    } catch (e) {
        const message = e instanceof Error ? e.message : "查询失败"
        return NextResponse.json({ error: "查询失败", detail: message }, { status: 500 })
    }
}
