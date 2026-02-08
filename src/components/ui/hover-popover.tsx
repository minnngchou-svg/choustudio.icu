"use client"
/** 悬浮触发的 Popover：移入显示、移出隐藏，trigger 与 content 间移动保持显示。 */
import * as React from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export function HoverPopover({
  children,
  content,
  side = "top",
  align = "center",
}: {
  children: React.ReactNode
  content: React.ReactNode
  side?: "top" | "bottom" | "left" | "right"
  align?: "start" | "center" | "end"
}) {
  const [open, setOpen] = React.useState(false)
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout>>(null)

  const handleEnter = React.useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setOpen(true)
  }, [])

  const handleLeave = React.useCallback(() => {
    timeoutRef.current = setTimeout(() => setOpen(false), 150)
  }, [])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span onMouseEnter={handleEnter} onMouseLeave={handleLeave} className="inline-flex items-center">
          {children}
        </span>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-3"
        side={side}
        align={align}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >
        {content}
      </PopoverContent>
    </Popover>
  )
}
