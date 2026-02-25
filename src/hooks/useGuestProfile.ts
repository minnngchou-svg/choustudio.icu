"use client"

export type ItemType = "POST" | "WORK" | "TUTORIAL" | "ACCOUNT_PRODUCT"

export interface HistoryItem {
  itemType: ItemType
  itemId: string
  title: string
  coverImage?: string
  visitedAt: number
}

export interface FavoriteItem {
  itemType: ItemType
  itemId: string
  title: string
  coverImage?: string
  addedAt: number
}

export interface GuestPreferences {
  fontScale: number
  compactMode: boolean
  autoPlayVideo: boolean
}

export interface GuestProfile {
  nickname: string
  avatar: string
  browsingHistory: HistoryItem[]
  favorites: FavoriteItem[]
  preferences: GuestPreferences
}

const STORAGE_KEY = "guest_profile"
const MAX_HISTORY = 50

const DEFAULT_PREFERENCES: GuestPreferences = {
  fontScale: 1,
  compactMode: false,
  autoPlayVideo: true,
}

const DEFAULT_PROFILE: GuestProfile = {
  nickname: "",
  avatar: "",
  browsingHistory: [],
  favorites: [],
  preferences: DEFAULT_PREFERENCES,
}

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null
  try {
    window.localStorage.setItem("__test__", "1")
    window.localStorage.removeItem("__test__")
    return window.localStorage
  } catch {
    return null
  }
}

export function getProfile(): GuestProfile {
  const storage = getStorage()
  if (!storage) return DEFAULT_PROFILE
  const raw = storage.getItem(STORAGE_KEY)
  if (!raw) return DEFAULT_PROFILE
  const parsed = safeParse<Partial<GuestProfile>>(raw, {})
  return {
    ...DEFAULT_PROFILE,
    ...parsed,
    preferences: { ...DEFAULT_PREFERENCES, ...parsed.preferences },
  }
}

export function saveProfile(profile: GuestProfile): void {
  const storage = getStorage()
  if (!storage) return
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(profile))
  } catch {
    // Storage full or unavailable
  }
}

export function addHistory(item: Omit<HistoryItem, "visitedAt">): void {
  const profile = getProfile()
  const existingIndex = profile.browsingHistory.findIndex(
    (h) => h.itemType === item.itemType && h.itemId === item.itemId
  )
  const newItem: HistoryItem = { ...item, visitedAt: Date.now() }
  let history: HistoryItem[]
  if (existingIndex >= 0) {
    history = [...profile.browsingHistory]
    history[existingIndex] = newItem
  } else {
    history = [newItem, ...profile.browsingHistory]
  }
  if (history.length > MAX_HISTORY) {
    history = history.slice(0, MAX_HISTORY)
  }
  saveProfile({ ...profile, browsingHistory: history })
}

export function toggleFavorite(item: Omit<FavoriteItem, "addedAt">): boolean {
  const profile = getProfile()
  const existingIndex = profile.favorites.findIndex(
    (f) => f.itemType === item.itemType && f.itemId === item.itemId
  )
  let favorites: FavoriteItem[]
  let isNowFavorite: boolean
  if (existingIndex >= 0) {
    favorites = profile.favorites.filter((_, i) => i !== existingIndex)
    isNowFavorite = false
  } else {
    const newItem: FavoriteItem = { ...item, addedAt: Date.now() }
    favorites = [newItem, ...profile.favorites]
    isNowFavorite = true
  }
  saveProfile({ ...profile, favorites })
  return isNowFavorite
}

export function isFavorited(itemType: ItemType, itemId: string): boolean {
  const profile = getProfile()
  return profile.favorites.some(
    (f) => f.itemType === itemType && f.itemId === itemId
  )
}

export function updatePreferences(prefs: Partial<GuestPreferences>): void {
  const profile = getProfile()
  saveProfile({
    ...profile,
    preferences: { ...profile.preferences, ...prefs },
  })
}

export function clearHistory(): void {
  const profile = getProfile()
  saveProfile({ ...profile, browsingHistory: [] })
}

export function clearFavorites(): void {
  const profile = getProfile()
  saveProfile({ ...profile, favorites: [] })
}

export function clearAll(): void {
  const storage = getStorage()
  if (!storage) return
  try {
    storage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore
  }
}

export function exportData(): GuestProfile {
  return getProfile()
}

export function useGuestProfile() {
  return {
    getProfile,
    saveProfile,
    addHistory,
    toggleFavorite,
    isFavorited,
    updatePreferences,
    clearHistory,
    clearFavorites,
    clearAll,
    exportData,
  }
}
