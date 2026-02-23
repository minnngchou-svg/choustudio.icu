/** 后台首页：统计卡片、快捷入口、最近订单、收入图表。仅 ADMIN 可访问。 */
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
    totalAccountProducts,
    totalOrders,
    monthlyRevenueAgg,
    prevMonthRevenueAgg,
    monthPosts,
    monthDesignWorks,
    monthDevWorks,
    monthTutorials,
    monthAccountProducts,
    monthOrders,
    recentOrdersRaw,
    chartOrdersLast30Days,
  ] = await Promise.all([
    prisma.post.count(),
    prisma.work.count({ where: { workType: "DESIGN" } }),
    prisma.work.count({ where: { workType: "DEVELOPMENT" } }),
    prisma.videoTutorial.count(),
    prisma.accountProduct.count(),
    prisma.order.count(),
    prisma.order.aggregate({
      where: { status: "PAID", paidAt: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
    prisma.order.aggregate({
      where: { status: "PAID", paidAt: { gte: startOfPrevMonth, lt: startOfMonth } },
      _sum: { amount: true },
    }),
    prisma.post.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.work.count({ where: { workType: "DESIGN", createdAt: { gte: startOfMonth } } }),
    prisma.work.count({ where: { workType: "DEVELOPMENT", createdAt: { gte: startOfMonth } } }),
    prisma.videoTutorial.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.accountProduct.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.order.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.order.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { work: { select: { title: true } } },
    }),
    prisma.order.findMany({
      where: {
        status: { in: ["PAID", "PENDING"] },
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { status: true, createdAt: true, paidAt: true, amount: true },
      orderBy: { createdAt: "asc" },
    }),
  ])

  const monthlyRevenue = Number(monthlyRevenueAgg._sum?.amount ?? 0)
  const prevMonthRevenue = Number(prevMonthRevenueAgg._sum?.amount ?? 0)

  const stats: DashboardStats = {
    totalPosts,
    totalDesignWorks,
    totalDevWorks,
    totalTutorials,
    totalAccountProducts,
    totalOrders,
    monthlyRevenue,
    prevMonthRevenue,
    monthPosts,
    monthDesignWorks,
    monthDevWorks,
    monthTutorials,
    monthAccountProducts,
    monthOrders,
  }

  const recentOrders: RecentOrder[] = (recentOrdersRaw as { id: string; orderNo: string; status: string; amount: unknown; createdAt: Date; work: { title: string } }[]).map((o) => ({
    id: o.id,
    orderNo: o.orderNo,
    status: o.status,
    amount: Number(o.amount),
    createdAt: o.createdAt.toISOString(),
    workTitle: o.work.title,
  }))

  const dailyMap = new Map<string, { paid: number; pending: number }>()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
    const key = `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`
    dailyMap.set(key, { paid: 0, pending: 0 })
  }
  for (const order of chartOrdersLast30Days as { status: string; createdAt: Date; paidAt: Date | null; amount: unknown }[]) {
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
      orderBlockForbidden={false}
    />
  )
}
