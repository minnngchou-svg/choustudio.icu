"use client"

import { useState, useEffect, useCallback, useRef } from "react"

type Notification = {
  id: string
  type: "work" | "account"
  orderNo: string
  title: string
  amount: number
  buyerEmail: string
  paidAt: string | null
}

type NotificationsResponse = {
  notifications: Notification[]
  timestamp: string
}

export function useAdminNotifications(options?: {
  enabled?: boolean
  interval?: number
}) {
  const { enabled = true, interval = 30000 } = options || {}
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [newCount, setNewCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const lastTimestamp = useRef<string | null>(null)
  const lastSeenIds = useRef<Set<string>>(new Set())

  const fetchNotifications = useCallback(async () => {
    if (!enabled) return

    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (lastTimestamp.current) {
        params.set("since", lastTimestamp.current)
      }

      const res = await fetch(`/api/admin/notifications?${params}`, {
        credentials: "include",
      })

      if (res.ok) {
        const data: NotificationsResponse = await res.json()
        lastTimestamp.current = data.timestamp

        const newNotifications = data.notifications.filter(
          (n) => !lastSeenIds.current.has(n.id)
        )

        if (newNotifications.length > 0) {
          setNotifications((prev) => [...newNotifications, ...prev].slice(0, 20))
          setNewCount((prev) => prev + newNotifications.length)
          newNotifications.forEach((n) => lastSeenIds.current.add(n.id))
        }
      }
    } finally {
      setLoading(false)
    }
  }, [enabled])

  const markAsRead = useCallback(() => {
    setNewCount(0)
  }, [])

  const clearNotifications = useCallback(() => {
    setNotifications([])
    setNewCount(0)
    lastSeenIds.current = new Set()
  }, [])

  useEffect(() => {
    if (!enabled) return

    fetchNotifications()

    const timer = setInterval(fetchNotifications, interval)
    return () => clearInterval(timer)
  }, [enabled, interval, fetchNotifications])

  return {
    notifications,
    newCount,
    loading,
    markAsRead,
    clearNotifications,
    refresh: fetchNotifications,
  }
}
