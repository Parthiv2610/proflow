"use client"

import { useEffect, useState } from "react"
import { RefreshCw, Wifi, WifiOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { getSyncState, onSyncStateChange } from "@/lib/sync-state"
import { getCloudConfig } from "@/lib/cloud-sync"

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
  const [hasCloudConfig, setHasCloudConfig] = useState(false)
  const [, setTick] = useState(0)

  useEffect(() => {
    const cfg = getCloudConfig()
    setHasCloudConfig(!!cfg)
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

  // Re-render every 30s to update "X ago" text
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  // Only show when cloud sync is configured
  if (!hasCloudConfig) return null

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
        {syncing ? "Syncing…" : lastSynced ? timeAgo(lastSynced) : "Cloud sync"}
      </span>
    </div>
  )
}
