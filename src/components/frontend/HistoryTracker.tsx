"use client"

import { useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useGuestProfile, type ItemType } from "@/hooks/useGuestProfile"

interface HistoryTrackerProps {
  itemType: ItemType
  itemId: string
  title: string
  coverImage?: string
}

export function HistoryTracker({
  itemType,
  itemId,
  title,
  coverImage,
}: HistoryTrackerProps) {
  const { isLoggedIn } = useAuth()
  const { addHistory } = useGuestProfile()

  useEffect(() => {
    if (isLoggedIn) {
      fetch("/api/user/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          itemType,
          itemId,
          title,
          coverImage,
        }),
      }).catch(() => {})
    } else {
      addHistory({
        itemType,
        itemId,
        title,
        coverImage,
      })
    }
  }, [itemType, itemId, title, coverImage, isLoggedIn, addHistory])

  return null
}
