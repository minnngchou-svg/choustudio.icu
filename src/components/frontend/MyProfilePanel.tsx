"use client"

import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/useAuth"
import { useGuestProfile, type FavoriteItem, type HistoryItem } from "@/hooks/useGuestProfile"

type Tab = "overview" | "history" | "favorites" | "settings"

interface MyProfilePanelProps {
  isOpen: boolean
  onClose: () => void
}

export function MyProfilePanel({ isOpen, onClose }: MyProfilePanelProps) {
  const { user, isLoggedIn, isLoading, login, register, logout, syncLocalData } = useAuth()
  const { getProfile, clearHistory, clearFavorites } = useGuestProfile()
  const [activeTab, setActiveTab] = useState<Tab>("overview")
  const [isLoginMode, setIsLoginMode] = useState(true)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [nickname, setNickname] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const guestProfile = getProfile()

  const handleSubmit = useCallback(async () => {
    setError("")
    setSubmitting(true)
    try {
      if (isLoginMode) {
        const result = await login(email, password)
        if (!result.success) {
          setError(result.error || "登录失败")
        } else {
          await syncLocalData()
          setEmail("")
          setPassword("")
        }
      } else {
        const result = await register({ email, password, nickname: nickname || undefined })
        if (!result.success) {
          setError(result.error || "注册失败")
        } else {
          const loginResult = await login(email, password)
          if (loginResult.success) {
            await syncLocalData()
            setEmail("")
            setPassword("")
            setNickname("")
          }
        }
      }
    } finally {
      setSubmitting(false)
    }
  }, [isLoginMode, email, password, nickname, login, register, syncLocalData])

  const handleLogout = useCallback(async () => {
    await logout()
    setActiveTab("overview")
  }, [logout])

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "overview", label: "概览", icon: "ri-user-line" },
    { key: "history", label: "历史", icon: "ri-history-line" },
    { key: "favorites", label: "收藏", icon: "ri-heart-line" },
    { key: "settings", label: "设置", icon: "ri-settings-3-line" },
  ]

  const renderUnloggedInContent = () => (
    <div className="flex flex-col h-full">
      <div className="text-center py-6">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-pride-1 to-pride-7 flex items-center justify-center">
          <i className="ri-lock-line text-2xl text-white" />
        </div>
        <h3 className="text-lg font-semibold mb-2">登录以解锁完整体验</h3>
        <p className="text-sm text-muted-foreground">
          登录后可同步收藏、历史记录和偏好设置
        </p>
      </div>

      <div className="px-4 space-y-4">
        <div className="space-y-3">
          <div>
            <Label htmlFor="email" className="text-xs">邮箱</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="password" className="text-xs">密码</Label>
            <Input
              id="password"
              type="password"
              placeholder="至少6位"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1"
            />
          </div>
          {!isLoginMode && (
            <div>
              <Label htmlFor="nickname" className="text-xs">昵称（可选）</Label>
              <Input
                id="nickname"
                type="text"
                placeholder="您的昵称"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="mt-1"
              />
            </div>
          )}
        </div>

        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}

        <Button
          onClick={handleSubmit}
          disabled={submitting || !email || !password || (!isLoginMode && password.length < 6)}
          className="w-full"
        >
          {submitting ? "处理中..." : isLoginMode ? "登录" : "注册"}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          {isLoginMode ? (
            <>
              还没有账号？
              <button
                onClick={() => { setIsLoginMode(false); setError("") }}
                className="text-primary hover:underline ml-1"
              >
                去注册
              </button>
            </>
          ) : (
            <>
              已有账号？
              <button
                onClick={() => { setIsLoginMode(true); setError("") }}
                className="text-primary hover:underline ml-1"
              >
                去登录
              </button>
            </>
          )}
        </p>
      </div>

      <div className="mt-auto px-4 py-6 border-t border-border/50">
        <p className="text-xs text-muted-foreground text-center mb-4">
          ── 或继续以游客身份 ──
        </p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <i className="ri-history-line" />
            <span>浏览历史 ({guestProfile.browsingHistory.length})</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <i className="ri-heart-line" />
            <span>收藏 ({guestProfile.favorites.length})</span>
          </div>
        </div>
      </div>
    </div>
  )

  const renderLoggedInContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pride-1 to-pride-7 flex items-center justify-center text-white font-semibold">
            {user?.nickname?.[0] || user?.email?.[0] || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{user?.nickname || "用户"}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            退出
          </Button>
        </div>
        {user?.memberLevel && user.memberLevel > 0 && (
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <i className="ri-vip-crown-line text-yellow-500" />
            <span>会员等级: Lv.{user.memberLevel}</span>
          </div>
        )}
      </div>

      <div className="flex border-b border-border/50">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex-1 py-3 text-sm font-medium transition-colors relative",
              activeTab === tab.key
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <i className={`${tab.icon} mr-1`} />
            {tab.label}
            {activeTab === tab.key && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary"
              />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {activeTab === "overview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-accent/50">
                <p className="text-2xl font-bold">{user?._count?.orders || 0}</p>
                <p className="text-xs text-muted-foreground">作品订单</p>
              </div>
              <div className="p-3 rounded-lg bg-accent/50">
                <p className="text-2xl font-bold">{user?._count?.accountOrders || 0}</p>
                <p className="text-xs text-muted-foreground">服务订单</p>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-accent/50">
              <p className="text-sm text-muted-foreground mb-1">注册时间</p>
              <p className="text-sm">{new Date(user?.createdAt || "").toLocaleDateString("zh-CN")}</p>
            </div>
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-2">
            {((user?.favorites as FavoriteItem[]) || []).length === 0 && guestProfile.browsingHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">暂无浏览历史</p>
            ) : (
              <>
                {(guestProfile.browsingHistory.slice(0, 10) || []).map((item, i) => (
                  <div key={`${item.itemType}-${item.itemId}-${i}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50">
                    {item.coverImage && (
                      <img src={item.coverImage} alt="" className="w-10 h-10 rounded object-cover" />
                    )}
                    <span className="text-sm truncate flex-1">{item.title}</span>
                  </div>
                ))}
                {guestProfile.browsingHistory.length > 10 && (
                  <p className="text-xs text-muted-foreground text-center">
                    还有 {guestProfile.browsingHistory.length - 10} 条记录
                  </p>
                )}
                <Button variant="outline" size="sm" onClick={clearHistory} className="w-full mt-2">
                  清空历史
                </Button>
              </>
            )}
          </div>
        )}

        {activeTab === "favorites" && (
          <div className="space-y-2">
            {((user?.favorites as FavoriteItem[]) || guestProfile.favorites).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">暂无收藏</p>
            ) : (
              <>
                {((user?.favorites as FavoriteItem[]) || guestProfile.favorites).map((item, i) => (
                  <div key={`${item.itemType}-${item.itemId}-${i}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50">
                    {item.coverImage && (
                      <img src={item.coverImage} alt="" className="w-10 h-10 rounded object-cover" />
                    )}
                    <span className="text-sm truncate flex-1">{item.title}</span>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={clearFavorites} className="w-full mt-2">
                  清空收藏
                </Button>
              </>
            )}
          </div>
        )}

        {activeTab === "settings" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">偏好设置功能开发中...</p>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:w-[400px] bg-background/95 backdrop-blur-xl border-l border-border/50 z-50 shadow-2xl"
          >
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <h2 className="font-semibold">我的</h2>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-accent transition-colors"
              >
                <i className="ri-close-line text-lg" />
              </button>
            </div>
            <div className="h-[calc(100%-60px)] overflow-auto">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <i className="ri-loader-4-line animate-spin text-2xl text-muted-foreground" />
                </div>
              ) : isLoggedIn ? (
                renderLoggedInContent()
              ) : (
                renderUnloggedInContent()
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
