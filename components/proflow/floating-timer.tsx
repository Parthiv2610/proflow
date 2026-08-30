"use client"

import { useRef, useEffect } from "react"
import { useStore } from "@/components/proflow/store"

const isElectron = typeof window !== "undefined" && !!(window as any).electronAPI?.isElectron

export function FloatingTimer() {
  const { running, secondsLeft, totalSeconds, mode, prefs, startTimer, pauseTimer, skipTimer, togglePref } = useStore()
  const autoBreak = prefs.some((p) => p.id === "autoBreaks" && p.on)
  const api = typeof window !== "undefined" ? (window as any).electronAPI : null
  const wasRunning = useRef(false)

  // On mobile/web: no floating timer
  if (!isElectron) return null

  useEffect(() => {
    if (!api) return

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
    if (!api) return
    const unsubs = [
      api.onTimerToggle(() => { running ? pauseTimer() : startTimer() }),
      api.onTimerSkip(() => { skipTimer() }),
      api.onTimerToggleAutoBreak(() => { togglePref("autoBreaks") }),
    ]
    return () => { unsubs.forEach((u) => { if (typeof u === 'function') u() }) }
  }, [api, running, startTimer, pauseTimer, skipTimer, togglePref])

  // Cleanup: hide native window on unmount
  useEffect(() => {
    return () => {
      if (api) { try { api.timerHide() } catch {} }
    }
  }, [api])

  return null
}
