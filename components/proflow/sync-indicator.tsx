"use client"

import { useEffect, useState } from "react"
import { MonitorSmartphone, RefreshCw, Users, Wifi, WifiOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { getSyncState, onSyncStateChange } from "@/lib/sync-state"
import { getLanConfig } from "@/lib/lan-sync"

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 10) return "just now"
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function SyncIndicator() {
  const [syncing, setSyncingState] = useState(false)
  const [lastSynced, setLastSynced] = useState<Date | null>(null)
  const [hasLanConfig, setHasLanConfig] = useState(false)
  const [deviceCount, setDeviceCount] = useState(0)
  const [serverRunning, setServerRunning] = useState(false)
  const [, setTick] = useState(0)

  useEffect(() => {
    const cfg = getLanConfig()
    setHasLanConfig(cfg.autoSync && !!cfg.lastUrl)
    const s = getSyncState()
    setSyncingState(s.syncing)
    setLastSynced(s.lastSyncedAt)
  }, [])

  useEffect(() => {
    return onSyncStateChange(() => {
      const s = getSyncState()
      setSyncingState(s.syncing)
      setLastSynced(s.lastSyncedAt)
    })
  }, [])

  // Listen for connected device count (desktop only)
  useEffect(() => {
    const api = (window as any).electronAPI
    if (!api?.onLanDeviceCount) return
    // Get initial count
    api.lanDeviceCount?.().then((c: number) => {
      setDeviceCount(c)
      setServerRunning(c >= 0)
    }).catch(() => {})
    // Listen for updates
    const unsub = api.onLanDeviceCount((count: number) => {
      setDeviceCount(count)
      setServerRunning(true)
    })
    return () => { if (typeof unsub === "function") unsub() }
  }, [])

  // Re-render every 30s to update "X ago" text
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  // Server mode: show device count (desktop only — has electronAPI)
  const isDesktop = typeof window !== "undefined" && !!(window as any).electronAPI?.isElectron
  if (isDesktop && serverRunning) {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors",
          deviceCount > 0
            ? "bg-success/10 text-success"
            : "bg-muted text-muted-foreground",
        )}
        title={`${deviceCount} device${deviceCount !== 1 ? "s" : ""} connected`}
      >
        {deviceCount > 0 ? (
          <Users className="size-3" />
        ) : (
          <MonitorSmartphone className="size-3" />
        )}
        <span className="hidden sm:inline">
          {deviceCount > 0
            ? `${deviceCount} device${deviceCount !== 1 ? "s" : ""}`
            : "No devices"
          }
        </span>
      </div>
    )
  }

  // Client mode: show sync status
  if (!hasLanConfig) return null

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors",
        syncing
          ? "bg-primary/10 text-primary"
          : lastSynced
            ? "bg-success/10 text-success"
            : "bg-muted text-muted-foreground",
      )}
      title={lastSynced ? `Last synced ${timeAgo(lastSynced)}` : "Not yet synced"}
    >
      {syncing ? (
        <RefreshCw className="size-3 animate-spin" />
      ) : lastSynced ? (
        <Wifi className="size-3" />
      ) : (
        <WifiOff className="size-3" />
      )}
      <span className="hidden sm:inline">
        {syncing ? "Syncing…" : lastSynced ? timeAgo(lastSynced) : "Off"}
      </span>
    </div>
  )
}
