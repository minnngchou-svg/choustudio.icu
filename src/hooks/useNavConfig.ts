"use client"

import { useState, useEffect } from "react"
import { defaultNav, type NavConfig } from "@/lib/nav-config"
import { defaultPageCopy, type PageCopy } from "@/lib/page-copy"
import { useFrontendSettingsContext } from "@/contexts/FrontendSettingsContext"

export type FrontendSettings = {
  nav: NavConfig
  pageCopy: PageCopy
  siteName?: string | null
  socialLinks?: import("@/lib/social-links").SocialLinks | null
}

export function useNavConfig(): FrontendSettings {
  const context = useFrontendSettingsContext()
  const [fallback, setFallback] = useState<FrontendSettings>({
    nav: defaultNav,
    pageCopy: defaultPageCopy,
    siteName: null,
    socialLinks: null,
  })

  useEffect(() => {
    if (context) return
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        const n = data.nav
        const copy = data.pageCopy
        const socialLinks =
          data.socialLinks && typeof data.socialLinks === "object"
            ? data.socialLinks
            : null
        setFallback({
          nav: n && typeof n === "object" ? { ...defaultNav, ...n } : defaultNav,
          pageCopy:
            copy && typeof copy === "object"
              ? { ...defaultPageCopy, ...copy }
              : defaultPageCopy,
          siteName: data.siteName ?? null,
          socialLinks,
        })
      })
      .catch(() => {})
  }, [context])

  return context ?? fallback
}
