import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

const checkOrderRateLimit = new Map<string, { count: number; resetAt: number }>()
const CHECK_RATE_LIMIT_WINDOW = 60 * 1000
const CHECK_RATE_LIMIT_MAX = 10

function checkOrderRateLimitFn(key: string): boolean {
  const now = Date.now()
  const record = checkOrderRateLimit.get(key)
  if (!record || now > record.resetAt) {
    checkOrderRateLimit.set(key, { count: 1, resetAt: now + CHECK_RATE_LIMIT_WINDOW })
    return true
  }
  if (record.count >= CHECK_RATE_LIMIT_MAX) {
    return false
  }
  record.count++
  return true
}

/** GET: 查询邮箱对某作品的购买状态（purchased、hasLatest、交付链接等）。 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get("email")?.trim().toLowerCase()
  const workId = searchParams.get("workId")

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "请输入有效的邮箱" }, { status: 400 })
  }
  if (!workId) {
    return NextResponse.json({ error: "缺少 workId" }, { status: 400 })
  }

  const rateLimitKey = `${email}:${workId}`
  if (!checkOrderRateLimitFn(rateLimitKey)) {
    return NextResponse.json({ error: "请求过于频繁" }, { status: 429 })
  }

  const work = await prisma.work.findUnique({
    where: { id: workId },
    include: {
      versions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  })
  if (!work || work.status !== "PUBLISHED") {
    return NextResponse.json({ error: "作品不存在" }, { status: 404 })
  }

  const latestVersion = work.versions[0] ?? null
  const currentPrice = latestVersion ? Number(latestVersion.price) : (work.price ? Number(work.price) : 0)
  const currentVersionLabel = work.currentVersion || latestVersion?.version || null

  const latestOrder = await prisma.order.findFirst({
    where: {
      workId,
      buyerEmail: email,
      status: "PAID",
    },
    orderBy: { createdAt: "desc" },
    include: {
      version: true,
    },
  })

  if (!latestOrder) {
    return NextResponse.json({
      purchased: false,
      currentPrice,
      currentVersion: currentVersionLabel,
      isFree: work.isFree,
    })
  }

  const paidVersionId = latestOrder.versionId
  const paidVersionLabel = latestOrder.version?.version || null

  const hasLatest =
    !latestVersion ||
    paidVersionId === latestVersion.id

  if (hasLatest) {
    return NextResponse.json({
      purchased: true,
      hasLatest: true,
      figmaUrl: latestVersion?.figmaUrl || work.figmaUrl || null,
      deliveryUrl: latestVersion?.deliveryUrl || work.deliveryUrl || null,
      paidVersion: paidVersionLabel,
      currentVersion: currentVersionLabel,
    })
  }

  const allPaidOrders = await prisma.order.findMany({
    where: {
      workId,
      buyerEmail: email,
      status: "PAID",
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, amount: true, versionId: true, version: { select: { version: true, figmaUrl: true, deliveryUrl: true } } },
  })
  const totalPaid = allPaidOrders.reduce((sum, o) => sum + Number(o.amount), 0)
  const upgradePrice = Math.max(0, currentPrice - totalPaid)

  const seenVersions = new Set<string>()
  const paidVersions: { version: string; figmaUrl: string | null; deliveryUrl: string | null }[] = []
  for (const o of allPaidOrders) {
    const vLabel = o.version?.version || null
    const key = vLabel || o.versionId || "_no_version"
    if (!seenVersions.has(key)) {
      seenVersions.add(key)
      paidVersions.push({
        version: vLabel || "旧版",
        figmaUrl: o.version?.figmaUrl || null,
        deliveryUrl: o.version?.deliveryUrl || null,
      })
    }
  }

  return NextResponse.json({
    purchased: true,
    hasLatest: false,
    paidVersion: paidVersionLabel,
    paidAmount: totalPaid,
    paidVersions,
    upgradePrice,
    currentPrice,
    currentVersion: currentVersionLabel,
    latestVersionId: latestVersion.id,
    isFree: work.isFree,
  })
}
