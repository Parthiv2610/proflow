"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

/**
 * Animates from 0 (or previous value) to the target number.
 * Uses requestAnimationFrame for buttery-smooth counting.
 */
export function AnimatedNumber({
  value,
  duration = 600,
  className,
  suffix,
  prefix,
}: {
  value: number
  duration?: number
  className?: string
  suffix?: string
  prefix?: string
}) {
  const [display, setDisplay] = useState(0)
  const prevRef = useRef(0)
  const rafRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    const from = prevRef.current
    const to = value
    if (from === to) return

    const start = performance.now()

    function tick(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(from + (to - from) * eased)
      setDisplay(current)
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        prevRef.current = to
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [value, duration])

  return (
    <span className={cn("tabular-nums", className)}>
      {prefix}{display}{suffix}
    </span>
  )
}
