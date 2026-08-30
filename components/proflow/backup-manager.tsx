"use client"

import { useEffect, useState } from "react"
import {
  hasAnyData,
  loadRollingBackup,
  applyData,
  saveRollingBackup,
} from "@/lib/rolling-backup"
import { useStore } from "@/components/proflow/store"

/**
 * Shows a restore prompt if the app has no data on launch.
 * Also auto-saves a rolling backup every 60 seconds when data changes.
 */
export function BackupManager() {
  const [showRestore, setShowRestore] = useState(false)
  const [backupInfo, setBackupInfo] = useState<{
    savedAt?: string
    keyCount?: number
  }>({})
  const [restored, setRestored] = useState(false)
  const [autoSaved, setAutoSaved] = useState(false)

  // ── Check on mount if data is empty ──
  useEffect(() => {
    // Give the store a moment to initialize
    const t = setTimeout(async () => {
      if (!hasAnyData()) {
        // Data is empty — check for rolling backup
        const backup = await loadRollingBackup()
        if (backup.found && backup.data && Object.keys(backup.data).length > 0) {
          setBackupInfo({
            savedAt: backup.savedAt,
            keyCount: Object.keys(backup.data).length,
          })
          setShowRestore(true)
        }
      }
    }, 500)
    return () => clearTimeout(t)
  }, [])

  // ── Auto-save rolling backup every 60 seconds ──
  useEffect(() => {
    const interval = setInterval(async () => {
      if (hasAnyData()) {
        const ok = await saveRollingBackup()
        if (ok) setAutoSaved(true)
      }
    }, 60_000)

    // Also save on visibility change (user switches away from app)
    const onVisChange = () => {
      if (document.visibilityState === "hidden" && hasAnyData()) {
        saveRollingBackup()
      }
    }
    document.addEventListener("visibilitychange", onVisChange)

    // Save before unload
    const onBeforeUnload = () => {
      if (hasAnyData()) {
        // Use sendBeacon for synchronous-ish save
        // Actually we need to use sync storage here since async won't finish
        // For Electron, the rolling backup is async but let's trigger it
        saveRollingBackup()
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload)

    return () => {
      clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisChange)
      window.removeEventListener("beforeunload", onBeforeUnload)
    }
  }, [])

  // ── Initial save on first load (if data exists) ──
  useEffect(() => {
    const t = setTimeout(() => {
      if (hasAnyData()) {
        saveRollingBackup()
      }
    }, 2000)
    return () => clearTimeout(t)
  }, [])

  const handleRestore = async () => {
    const backup = await loadRollingBackup()
    if (backup.found && backup.data) {
      applyData(backup.data)
      setRestored(true)
      setShowRestore(false)
      // Reload to re-initialize the store with restored data
      window.location.reload()
    }
  }

  const handleStartFresh = () => {
    setShowRestore(false)
    // Save an empty backup as a seed so the rolling backup starts
    saveRollingBackup()
  }

  // ── Auto-save indicator (subtle toast) ──
  useEffect(() => {
    if (!autoSaved) return
    setAutoSaved(false)
  }, [autoSaved])

  if (restored) return null
  if (!showRestore) return null

  const dateStr = backupInfo.savedAt
    ? new Date(backupInfo.savedAt).toLocaleString()
    : "recently"

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="mb-3 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-lg">
            📦
          </span>
          <div>
            <h2 className="text-lg font-bold text-foreground">Restore your data?</h2>
            <p className="text-xs text-muted-foreground">
              A backup was found from {dateStr}
            </p>
          </div>
        </div>

        <div className="mb-4 rounded-xl bg-muted/50 p-3">
          <p className="text-sm text-muted-foreground">
            Your previous data ({backupInfo.keyCount || "multiple"} items) was saved
            automatically. Would you like to restore it?
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleRestore}
            className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Restore backup
          </button>
          <button
            type="button"
            onClick={handleStartFresh}
            className="flex-1 rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-medium text-foreground hover:bg-secondary/80 transition-colors"
          >
            Start fresh
          </button>
        </div>
      </div>
    </div>
  )
}
