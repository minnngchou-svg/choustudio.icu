"use client"

import { useState, useCallback, useEffect } from "react"
import { useSession, signIn, signOut } from "next-auth/react"
import { exportData } from "./useGuestProfile"

export interface UserProfile {
  id: string
  email: string
  name?: string | null
  nickname?: string | null
  avatar?: string | null
  role: string
  memberLevel: number
  favorites?: unknown
  preferences?: unknown
  disabled: boolean
  lastLoginAt?: string | null
  createdAt: string
  _count?: {
    orders: number
    accountOrders: number
  }
}

interface RegisterParams {
  email: string
  password: string
  nickname?: string
}

interface UseAuthReturn {
  user: UserProfile | null
  isLoggedIn: boolean
  isLoading: boolean
  isAdmin: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (params: RegisterParams) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  syncLocalData: () => Promise<{ success: boolean; error?: string }>
  refreshProfile: () => Promise<void>
}

export function useAuth(): UseAuthReturn {
  const { data: session, status, update } = useSession()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)

  const isLoading = status === "loading" || profileLoading
  const isLoggedIn = !!session?.user?.id
  const isAdmin = (session?.user as { role?: string })?.role === "ADMIN"

  const refreshProfile = useCallback(async () => {
    if (!session?.user?.id) {
      setUser(null)
      return
    }
    setProfileLoading(true)
    try {
      const res = await fetch("/api/user/profile", {
        credentials: "include",
      })
      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    } finally {
      setProfileLoading(false)
    }
  }, [session?.user?.id])

  useEffect(() => {
    refreshProfile()
  }, [refreshProfile])

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const result = await signIn("credentials", {
          email,
          password,
          redirect: false,
        })
        if (result?.error) {
          return { success: false, error: result.error }
        }
        await refreshProfile()
        return { success: true }
      } catch (e) {
        const error = e instanceof Error ? e.message : "登录失败"
        return { success: false, error }
      }
    },
    [refreshProfile]
  )

  const register = useCallback(async (params: RegisterParams) => {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      })
      const data = await res.json()
      if (!res.ok) {
        return { success: false, error: data.error || "注册失败" }
      }
      return { success: true }
    } catch (e) {
      const error = e instanceof Error ? e.message : "注册失败"
      return { success: false, error }
    }
  }, [])

  const logout = useCallback(async () => {
    await signOut({ redirect: false })
    setUser(null)
  }, [])

  const syncLocalData = useCallback(async () => {
    if (!session?.user?.id) {
      return { success: false, error: "未登录" }
    }
    try {
      const localData = exportData()
      const res = await fetch("/api/user/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          favorites: localData.favorites,
          preferences: localData.preferences,
          history: localData.browsingHistory,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        return { success: false, error: data.error || "同步失败" }
      }
      await refreshProfile()
      return { success: true }
    } catch (e) {
      const error = e instanceof Error ? e.message : "同步失败"
      return { success: false, error }
    }
  }, [session?.user?.id, refreshProfile])

  return {
    user,
    isLoggedIn,
    isLoading,
    isAdmin,
    login,
    register,
    logout,
    syncLocalData,
    refreshProfile,
  }
}
