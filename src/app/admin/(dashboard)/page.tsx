/** 后台首页：统计卡片、快捷入口、最近订单、收入图表。 */
import prisma from "@/lib/prisma"
import DashboardContent from "@/components/admin/DashboardContent"
import type {
  DashboardStats,
  RecentOrder,
  DailyRevenue,
} from "@/components/admin/DashboardContent"

export default async function AdminDashboardPage() {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [
    totalPosts,
    totalDesignWorks,
    totalDevWorks,
    totalTutorials,
    totalOrders,
    monthlyRevenueAgg,
    prevMonthRevenueAgg,
    monthPosts,
    monthDesignWorks,
    monthDevWorks,
    monthTutorials,
    monthOrders,
    recentOrdersRaw,
    chartOrdersLast30Days,
  ] = await Promise.all([
    prisma.post.count(),
    prisma.work.count({ where: { workType: "DESIGN" } }),
    prisma.work.count({ where: { workType: "DEVELOPMENT" } }),
    prisma.videoTutorial.count(),
    prisma.order.count(),
    // 本月收入
    prisma.order.aggregate({
      where: { status: "PAID", paidAt: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
    // 上月收入
    prisma.order.aggregate({
      where: { status: "PAID", paidAt: { gte: startOfPrevMonth, lt: startOfMonth } },
      _sum: { amount: true },
    }),
    prisma.post.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.work.count({ where: { workType: "DESIGN", createdAt: { gte: startOfMonth } } }),
    prisma.work.count({ where: { workType: "DEVELOPMENT", createdAt: { gte: startOfMonth } } }),
    prisma.videoTutorial.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.order.count({ where: { createdAt: { gte: startOfMonth } } }),
    // 最近 5 笔订单
    prisma.order.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { work: { select: { title: true } } },
    }),
    // 近 30 天订单 (已支付 + 待支付，用于图表双线)
    prisma.order.findMany({
      where: {
        status: { in: ["PAID", "PENDING"] },
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { status: true, createdAt: true, paidAt: true, amount: true },
      orderBy: { createdAt: "asc" },
    }),
  ])

  // ---- 构建 stats ----
  const stats: DashboardStats = {
    totalPosts,
    totalDesignWorks,
    totalDevWorks,
    totalTutorials,
    totalOrders,
    monthlyRevenue: Number(monthlyRevenueAgg._sum.amount ?? 0),
    prevMonthRevenue: Number(prevMonthRevenueAgg._sum.amount ?? 0),
    monthPosts,
    monthDesignWorks,
    monthDevWorks,
    monthTutorials,
    monthOrders,
  }

  // ---- 构建最近订单 ----
  const recentOrders: RecentOrder[] = recentOrdersRaw.map((o) => ({
    id: o.id,
    orderNo: o.orderNo,
    status: o.status,
    amount: Number(o.amount),
    createdAt: o.createdAt.toISOString(),
    workTitle: o.work.title,
  }))

  // ---- 构建近 30 天每日收入（已支付 / 未支付） ----
  const dailyMap = new Map<string, { paid: number; pending: number }>()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
    const key = `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`
    dailyMap.set(key, { paid: 0, pending: 0 })
  }
  for (const order of chartOrdersLast30Days) {
    // 已支付订单按 paidAt 计入，未支付按 createdAt 计入
    const refDate = order.status === "PAID" && order.paidAt ? order.paidAt : order.createdAt
    const d = new Date(refDate)
    const key = `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`
    const entry = dailyMap.get(key)
    if (entry) {
      const amt = Number(order.amount)
      if (order.status === "PAID") {
        entry.paid += amt
      } else {
        entry.pending += amt
      }
    }
  }
  const dailyRevenue: DailyRevenue[] = Array.from(dailyMap.entries()).map(([date, data]) => ({
    date,
    paid: data.paid,
    pending: data.pending,
  }))

  return (
    <DashboardContent
      stats={stats}
      recentOrders={recentOrders}
      dailyRevenue={dailyRevenue}
    />
  )
}
