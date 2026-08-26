"use client"

import { useEffect } from "react"
import { X } from "lucide-react"
import { useStore } from "./store"
import { celebrate } from "./confetti"

/**
 * Milestone celebration — appears the moment an achievement badge is earned
 * (3/7/14-day streaks, 10/50/100 tasks). Fires a big confetti burst, shows the
 * badge, and auto-closes after a few seconds so it never blocks the app.
 */
export function MilestonePopup() {
  const { pendingBadges, dismissBadge } = useStore()
  const badge = pendingBadges[0]

  // Confetti + auto-dismiss whenever a badge appears; locks page scroll so the
  // celebration feels focused (matches the shared Modal's behavior).
  useEffect(() => {
    if (!badge) return
    celebrate({ big: true })
    document.body.style.overflow = "hidden"
    const t = setTimeout(dismissBadge, 6000)
    return () => {
      clearTimeout(t)
      document.body.style.overflow = ""
    }
  }, [badge, dismissBadge])

  if (!badge) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 animate-in fade-in duration-300 bg-black/60 backdrop-blur-sm"
        onClick={dismissBadge}
        aria-hidden="true"
      />
      {/* Badge card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Achievement unlocked: ${badge.name}`}
        className="animate-in zoom-in-95 fade-in slide-in-from-bottom-4 duration-300 relative w-full max-w-sm overflow-hidden rounded-3xl border border-focus/30 bg-card p-8 text-center shadow-2xl"
      >
        {/* Soft glow */}
        <div className="pointer-events-none absolute -top-24 left-1/2 size-48 -translate-x-1/2 rounded-full bg-focus/20 blur-3xl" />

        <button
          type="button"
          onClick={dismissBadge}
          aria-label="Close"
          className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>

        <p className="text-[11px] font-bold tracking-[0.25em] text-focus uppercase">Achievement unlocked</p>

        {/* Inline gradient (the codebase avoids Tailwind's bg-gradient-* classes) */}
        <div
          className="mx-auto mt-5 flex size-20 items-center justify-center rounded-3xl text-4xl ring-2 ring-focus/40"
          style={{ background: "linear-gradient(135deg, color-mix(in oklab, var(--focus) 25%, transparent), color-mix(in oklab, var(--primary) 25%, transparent), color-mix(in oklab, var(--success) 25%, transparent))" }}
        >
          {badge.icon}
        </div>

        <h2 className="mt-4 text-2xl font-bold tracking-tight">{badge.name}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">{badge.desc}</p>

        <button
          type="button"
          onClick={dismissBadge}
          className="mt-6 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-all duration-200 hover:bg-primary/90 hover:shadow-lg active:scale-[0.98]"
        >
          Keep going! 🔥
        </button>
      </div>
    </div>
  )
}
