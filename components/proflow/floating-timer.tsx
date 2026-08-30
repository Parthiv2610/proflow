"use client"

import { useState, useRef, useEffect } from "react"
import { Play, Pause, SkipForward } from "lucide-react"
import { useStore } from "@/components/proflow/store"
import { cn } from "@/lib/utils"

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, "0")}`
}

const isElectron = typeof window !== "undefined" && !!(window as any).electronAPI?.isElectron

function useNativeTimer() {
  const { running, secondsLeft, totalSeconds, mode, prefs } = useStore()
  const autoBreak = prefs.some((p) => p.id === "autoBreaks" && p.on)
  const api = typeof window !== "undefined" ? (window as any).electronAPI : null
  const wasRunning = useRef(false)

  useEffect(() => {
    if (!api || !isElectron) return

    if (running) {
      // Show the native timer window when timer starts
      if (!wasRunning.current) {
        api.timerShow()
        wasRunning.current = true
      }
      // Send update every second
      api.timerUpdate({ secondsLeft, totalSeconds, mode, running, autoBreak })
    } else if (wasRunning.current) {
      // Timer stopped — send final update and hide after 2s
      api.timerUpdate({ secondsLeft: totalSeconds, totalSeconds, mode, running: false, autoBreak })
      wasRunning.current = false
      const t = setTimeout(() => { try { api.timerHide() } catch {} }, 2000)
      return () => clearTimeout(t)
    }
  }, [running, secondsLeft, totalSeconds, mode, autoBreak, api])

  // Listen for controls from the native window
  useEffect(() => {
    if (!api || !isElectron) return
    const { startTimer, pauseTimer, skipTimer, togglePref } = useStore.getState()
    api.onTimerToggle(() => { running ? pauseTimer() : startTimer() })
    api.onTimerSkip(() => { skipTimer() })
    api.onTimerToggleAutoBreak(() => { togglePref("autoBreaks") })
  }, [api])

  // Cleanup: hide native window on unmount
  useEffect(() => {
    return () => {
      if (api && isElectron) { try { api.timerHide() } catch {} }
    }
  }, [api])
}

/** In-app floating widget (used on mobile / web) */
function InAppFloatingTimer() {
  const { running, secondsLeft, totalSeconds, mode, startTimer, pauseTimer, skipTimer, view, prefs, togglePref } = useStore()
  const [position, setPosition] = useState({ x: 16, y: 80 })
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)
  const autoBreak = prefs.some((p) => p.id === "autoBreaks" && p.on)

  if (!running || view === "focus") return null

  const progress = ((totalSeconds - secondsLeft) / totalSeconds) * 100

  const handlePointerDown = (e: React.PointerEvent) => {
    setDragging(true)
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: position.x, origY: position.y }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging || !dragRef.current) return
    setPosition({
      x: Math.max(0, Math.min(window.innerWidth - 200, dragRef.current.origX + (e.clientX - dragRef.current.startX))),
      y: Math.max(0, Math.min(window.innerHeight - 100, dragRef.current.origY + (e.clientY - dragRef.current.startY))),
    })
  }
  const handlePointerUp = () => { setDragging(false); dragRef.current = null }

  return (
    <div
      className={cn(
        "fixed z-[90] flex flex-col rounded-xl border border-border bg-background/95 shadow-2xl backdrop-blur-md select-none",
        dragging ? "cursor-grabbing" : "cursor-grab",
      )}
      style={{ left: position.x, top: position.y, width: 180 }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div className="absolute inset-0 rounded-xl overflow-hidden">
        <div
          className={cn("absolute inset-y-0 left-0 transition-all duration-500", mode === "focus" ? "bg-primary/10" : "bg-info/10")}
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="relative flex items-center gap-2 px-3 py-2 w-full">
        <div className={cn("flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold", mode === "focus" ? "bg-primary/20 text-primary" : "bg-info/20 text-info")}>
          {mode === "focus" ? "F" : "B"}
        </div>
        <span className="font-mono text-sm font-bold tabular-nums text-foreground">{formatTime(secondsLeft)}</span>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={(e) => { e.stopPropagation(); running ? pauseTimer() : startTimer() }}
            className="size-6 flex items-center justify-center rounded-md hover:bg-accent transition-colors">
            {running ? <Pause className="size-3" /> : <Play className="size-3" />}
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); skipTimer() }}
            className="size-6 flex items-center justify-center rounded-md hover:bg-accent transition-colors">
            <SkipForward className="size-3" />
          </button>
        </div>
      </div>
      <div className="relative flex items-center justify-between px-3 py-1.5 border-t border-border/50" onPointerDown={(e) => e.stopPropagation()}>
        <span className="text-[10px] text-muted-foreground">Auto-break</span>
        <button type="button" onClick={(e) => { e.stopPropagation(); togglePref("autoBreaks") }}
          className={cn("relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full transition-colors", autoBreak ? "bg-primary" : "bg-muted")}>
          <span className={cn("inline-block h-3 w-3 translate-y-0.5 rounded-full bg-white shadow transition-transform", autoBreak ? "translate-x-3.5" : "translate-x-0.5")} />
        </button>
      </div>
    </div>
  )
}

export function FloatingTimer() {
  // On desktop: use native always-on-top window
  useNativeTimer()
  // On mobile/web: use in-app floating widget
  if (isElectron) return null
  return <InAppFloatingTimer />
}
