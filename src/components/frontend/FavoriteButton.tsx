"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/useAuth"
import { useGuestProfile, type ItemType } from "@/hooks/useGuestProfile"

interface FavoriteButtonProps {
  itemType: ItemType
  itemId: string
  title: string
  coverImage?: string
  className?: string
}

export function FavoriteButton({
  itemType,
  itemId,
  title,
  coverImage,
  className,
}: FavoriteButtonProps) {
  const { isLoggedIn, user } = useAuth()
  const { isFavorited, toggleFavorite } = useGuestProfile()
  const [isFavorite, setIsFavorite] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isLoggedIn && user?.favorites) {
      const favorites = user.favorites as Array<{
        itemType: string
        itemId: string
      }>
      setIsFavorite(
        favorites.some((f) => f.itemType === itemType && f.itemId === itemId)
      )
    } else {
      setIsFavorite(isFavorited(itemType, itemId))
    }
  }, [isLoggedIn, user?.favorites, itemType, itemId, isFavorited])

  const handleToggle = useCallback(async () => {
    if (isLoading) return
    setIsLoading(true)

    try {
      if (isLoggedIn) {
        const res = await fetch("/api/user/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            itemType,
            itemId,
            title,
            coverImage,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          setIsFavorite(data.isFavorite)
        }
      } else {
        const newState = toggleFavorite({
          itemType,
          itemId,
          title,
          coverImage,
        })
        setIsFavorite(newState)
      }
    } finally {
      setIsLoading(false)
    }
  }, [isLoggedIn, itemType, itemId, title, coverImage, isLoading, toggleFavorite])

  return (
    <button
      onClick={handleToggle}
      disabled={isLoading}
      className={cn(
        "relative p-2 rounded-full transition-colors",
        "hover:bg-accent/50 active:scale-95",
        className
      )}
      aria-label={isFavorite ? "取消收藏" : "添加收藏"}
    >
      <AnimatePresence mode="wait">
        {isFavorite ? (
          <motion.i
            key="filled"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="ri-heart-fill text-lg text-red-500"
          />
        ) : (
          <motion.i
            key="outline"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="ri-heart-line text-lg text-muted-foreground"
          />
        )}
      </AnimatePresence>
    </button>
  )
}
