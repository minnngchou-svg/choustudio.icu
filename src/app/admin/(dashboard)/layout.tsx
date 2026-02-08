/** 后台根布局：鉴权、侧栏、站点名，子路由为各管理页。 */
import { AdminDashboardClient } from "@/components/admin/AdminDashboardClient"
import { AdminThemeWrapper } from "@/components/admin/AdminThemeWrapper"
import { auth } from "@/lib/auth"
import { getSettingsRow } from "@/lib/settings-db"
import { normalizeSiteName } from "@/lib/page-copy"
import { redirect } from "next/navigation"

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session) {
    redirect("/admin/login")
  }

  const settings = await getSettingsRow()
  const siteName = normalizeSiteName(settings?.siteName)

  return (
    <AdminThemeWrapper>
      <div className="min-h-screen bg-background transition-colors duration-300">
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute inset-0 grid-bg opacity-[0.03]" />
        </div>
        <AdminDashboardClient siteName={siteName}>{children}</AdminDashboardClient>
      </div>
    </AdminThemeWrapper>
  )
}
