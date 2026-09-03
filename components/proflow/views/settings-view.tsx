"use client"

import { useEffect, useRef, useState } from "react"
import {
  Camera,
  Trash2,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Loader2,
  Sparkles,
  Download,
  Upload,
  FileJson,
  Moon,
  Sun,
  Wifi,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useUpdate } from "@/lib/use-update"
import { isCapacitor } from "@/lib/lan-sync"
import { showNotification } from "@/lib/notify"
import { getCloudConfig, setCloudConfig, generateUserId, clearCloudConfig, connectCloud, pushToCloud, pullFromCloud, startCloudAutoSync, type CloudSyncInfo } from "@/lib/cloud-sync"
import { Card, PageHeader } from "../ui"
import { useStore, ACCENTS, ACHIEVEMENTS } from "../store"

function Switch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className={cn(
        "relative h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        on ? "bg-primary" : "bg-muted",
      )}
    >
      <span
        className={cn(
          "absolute top-1 left-1 size-5 rounded-full bg-white shadow-md transition-all duration-200",
          on ? "translate-x-5" : "translate-x-0",
        )}
      />
    </button>
  )
}

export function SettingsView() {
  const {
    userName,
    setUserName,
    avatarUrl,
    setAvatarUrl,
    theme,
    setTheme,
    colorMode,
    setColorMode,
    prefs,
    togglePref,
    startTour,
    resetAllData,
    achievements,
    bestStreak,
    totalTasksDone,
  } = useStore()
  const [confirmReset, setConfirmReset] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [exported, setExported] = useState(false)
  const [exportedPath, setExportedPath] = useState<string | null>(null)
  // Parsed backup waiting for confirmation — import replaces current data.
  const [pendingImport, setPendingImport] = useState<Record<string, string> | null>(null)
  // Rolling backup status
  const [lastBackup, setLastBackup] = useState<{ savedAt: string | null; keyCount: number }>({ savedAt: null, keyCount: 0 })

  useEffect(() => {
    const api = (window as any).electronAPI
    if (!api?.rollingLoad) return
    api.rollingLoad().then((res: any) => {
      if (res?.found && res?.data) {
        setLastBackup({ savedAt: res.savedAt || null, keyCount: Object.keys(res.data).length })
      }
    }).catch(() => {})
  }, [])

  // ── Cloud sync ──
  const cloudCfg = getCloudConfig()
  const [cloudUrl, setCloudUrl] = useState(cloudCfg?.url || "")
  const [cloudKey, setCloudKey] = useState(cloudCfg?.anonKey || "")
  const [cloudInfo, setCloudInfo] = useState<CloudSyncInfo>({ status: "idle", error: null, lastSynced: null, connectedDevices: 0 })
  const [cloudAutoSync, setCloudAutoSync] = useState(!!cloudCfg)
  const [showSetupSQL, setShowSetupSQL] = useState(false)
  const [cloudConnected, setCloudConnected] = useState(!!cloudCfg)

  // Auto-sync effect: when connected and enabled, push/pull periodically
  useEffect(() => {
    if (!cloudAutoSync || !cloudConnected) return
    const cleanup = startCloudAutoSync((result) => {
      if (result.status === "error") {
        setCloudInfo(result)
      } else if (result.status === "done") {
        setCloudInfo(result)
      }
    })
    return cleanup
  }, [cloudAutoSync, cloudConnected])
  // Local string state so the user can clear the field while typing without the
  // controlled value snapping back to "0" on every keystroke.

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      if (dataUrl) setAvatarUrl(dataUrl)
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  const themes = ["Purple", "Blue", "Indigo", "Green", "Teal", "Cyan", "Orange", "Amber", "Rose"]      // ── Data backup: export / import everything stored under the proflow- prefix ──
  // All app state (tasks, habits, goals, events, notes, focus log, settings,
  // XP, badges) lives in localStorage under "proflow-" keys. Export collects
  // every one of those keys into a single JSON file; import validates the file,
  // writes the keys back, and reloads so the store re-initializes from them.
  const handleExport = async () => {
    try {
      // Parse each stored value so the backup is a clean, structured JSON
      // (real arrays/objects, e.g. "tasks": [ {…} ]) instead of a bag of
      // escaped JSON strings — easier to read and edit by hand.
      const data: Record<string, unknown> = {}
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith("proflow-")) {
          const raw = localStorage.getItem(k)
          if (raw !== null) {
            try {
              data[k.slice("proflow-".length)] = JSON.parse(raw)
            } catch {
              data[k.slice("proflow-".length)] = raw
            }
          }
        }
      }
      const fileName = `proflow-backup-${new Date().toISOString().slice(0, 10)}.json`
      const content = JSON.stringify(
        { format: "proflow-backup", version: 2, exportedAt: new Date().toISOString(), data },
        null,
        2,
      )

      // Android APK: the WebView ignores browser-style anchor downloads, so the
      // native Backup plugin writes the JSON straight to Downloads instead.
      if (isCapacitor()) {
        const backup = (window as any).Capacitor?.Plugins?.Backup
        if (backup?.saveBackup) {
          const res = await backup.saveBackup({ fileName, content })
          // Show where the file was saved
          const savedPath = res?.path || "Downloads/"
          showNotification("ProFlow", `✅ Backup saved to ${savedPath}`)
          setExportedPath(savedPath)
        } else {
          // Older APKs don't expose the native plugin — fall back to the Web
          // Share API so the share sheet can save the file (Files/Drive/etc).
          const nav = navigator as any
          const file = new File([content], fileName, { type: "application/json" })
          if (!nav.canShare?.({ files: [file] })) {
            throw new Error("This build can't export files — install the latest update or use the desktop app")
          }
          await nav.share({ files: [file], title: "ProFlow backup" })
        }
        setExported(true)
        setTimeout(() => { setExported(false); setExportedPath(null) }, 4000)
        setImportError(null)
        return
      }

      // Desktop: native save dialog — the user picks where the file goes.
      const api = (window as any).electronAPI
      if (api?.saveBackup) {
        const res = await api.saveBackup({ fileName, content })
        if (res?.canceled) return // user closed the dialog — not an error
        if (res?.error) throw new Error(res.error)
        setExported(true)
        setTimeout(() => setExported(false), 2500)
        setImportError(null)
        return
      }

      // Browser/dev fallback: classic anchor download.
      const blob = new Blob([content], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setExported(true)
      setTimeout(() => setExported(false), 2500)
      setImportError(null)
    } catch (err) {
      const msg = (err as any)?.message || ""
      // The Web Share sheet throws AbortError when the user cancels — treat it
      // like the desktop dialog cancel (no error banner), by name or message.
      const isCancel = /cancell?ed/i.test(msg) || (err as any)?.name === "AbortError"
      if (!isCancel) {
        setImportError(`Export failed: ${msg || "your data is safe, try again"}`)
      }
    }
  }

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string)
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          setImportError("That doesn't look like a ProFlow backup file.")
          return
        }
        // Accept both backup shapes; foreign keys still can't pollute the app.
        const entries: Record<string, string> = {}
        let count = 0
        const collect = (key: string, value: unknown) => {
          const stored = typeof value === "string" ? value : JSON.stringify(value)
          if (stored === undefined) return
          entries[key] = stored
          count++
        }
        if (parsed.format === "proflow-backup" && parsed.data && typeof parsed.data === "object" && !Array.isArray(parsed.data)) {
          // v2 structured backup: { format, version, exportedAt, data: { tasks: [...], … } }
          Object.entries(parsed.data as Record<string, unknown>).forEach(([key, value]) => {
            collect(`proflow-${key}`, value)
          })
        } else {
          // v1 raw backup: flat { "proflow-tasks": "[…escaped json…]" } map.
          Object.entries(parsed).forEach(([key, value]) => {
            if (key.startsWith("proflow-") && typeof value === "string") collect(key, value)
          })
        }
        if (count === 0) {
          setImportError("No ProFlow data found in that file.")
          setPendingImport(null)
          return
        }
        setImportError(null)
        // Stage it and ask for confirmation — import replaces current data.
        setPendingImport(entries)
      } catch {
        setImportError("Couldn't read that file. Pick a valid JSON backup exported from ProFlow.")
        setPendingImport(null)
      }
    }
    reader.readAsText(file)
  }

  const confirmImport = () => {
    if (!pendingImport) return
    try {
      // Replace: drop every existing proflow-* key, then write the backup's keys.
      const doomed: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith("proflow-")) doomed.push(k)
      }
      doomed.forEach((k) => localStorage.removeItem(k))
      Object.entries(pendingImport).forEach(([key, value]) => localStorage.setItem(key, value))
      setPendingImport(null)
      // Reload so every hook re-reads its key from localStorage.
      window.location.reload()
    } catch {
      setImportError("Import failed. Your previous backup file is untouched — you can try again.")
      setPendingImport(null)
    }
  }

  // ── Cloud sync handlers ──
  const handleCloudConnect = async () => {
    if (!cloudUrl || !cloudKey) { setCloudInfo({ status: "error", error: "Enter Supabase URL and anon key", lastSynced: null, connectedDevices: 0 }); return }
    const userId = cloudCfg?.userId || generateUserId()
    setCloudInfo({ status: "connecting", error: null, lastSynced: null, connectedDevices: 0 })
    setCloudConfig({ url: cloudUrl, anonKey: cloudKey, userId })
    const result = await connectCloud({ url: cloudUrl.replace(/\/+$/, ""), anonKey: cloudKey, userId })
    setCloudInfo(result)
    if (result.status === "done") {
      setCloudConnected(true)
      showNotification("ProFlow", "✅ Connected to cloud sync")
    }
  }

  const handleCloudDisconnect = () => {
    clearCloudConfig()
    setCloudConnected(false)
    setCloudAutoSync(false)
    setCloudInfo({ status: "idle", error: null, lastSynced: null, connectedDevices: 0 })
    showNotification("ProFlow", "Cloud sync disconnected")
  }

  const handleCloudPush = async () => {
    setCloudInfo({ status: "syncing", error: null, lastSynced: null, connectedDevices: 0 })
    const result = await pushToCloud()
    setCloudInfo(result)
    if (!result.error) showNotification("ProFlow", "✅ Data pushed to cloud")
  }

  const handleCloudPull = async () => {
    setCloudInfo({ status: "syncing", error: null, lastSynced: null, connectedDevices: 0 })
    const result = await pullFromCloud()
    setCloudInfo(result)
    if (!result.error) { showNotification("ProFlow", "✅ Data pulled from cloud"); window.location.reload() }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <PageHeader title="Settings" subtitle="Manage your workspace preferences" />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleUpload}
        className="hidden"
      />

      <div className="mt-6 flex flex-col gap-4">
        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Profile</h2>
          <button
            type="button"
            onClick={startTour}
            className="mt-3 flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Sparkles className="size-3.5" />
            Take the welcome tour
          </button>
          <div className="mt-4 flex items-center gap-4">
            {/* Avatar */}
            <div className="group relative size-14 shrink-0">
              {avatarUrl ? (
                <div className="size-full overflow-hidden rounded-full ring-2 ring-primary/30">
                  <img src={avatarUrl} alt="" className="size-full object-cover" />
                </div>
              ) : (
                <div className="flex size-full items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
                  {userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                </div>
              )}
              {/* Hover overlay for upload */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <Camera className="size-5 text-white" />
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl("")}
                  className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-danger text-danger-foreground shadow-sm opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Trash2 className="size-3" />
                </button>
              )}
            </div>
            <div className="flex-1">
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-1.5 text-sm font-medium text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
              />
              <p className="mt-1 text-sm text-muted-foreground">Shown on the dashboard greeting.</p>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Accent color</h2>
          <p className="mt-1 text-sm text-muted-foreground">Colors the app theme live.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {themes.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTheme(t)}
                aria-pressed={theme === t}
                className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  theme === t
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <span
                  className="size-3 rounded-full border border-white/20"
                  style={{ backgroundColor: ACCENTS[t]?.primary ?? "var(--primary)" }}
                />
                {t}
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Appearance</h2>
          <p className="mt-1 text-sm text-muted-foreground">Dark or light — with your accent.</p>
          <div className="mt-4 flex gap-2">
            {(
              [
                { id: "dark" as const, label: "Dark", icon: Moon },
                { id: "light" as const, label: "Light", icon: Sun },
              ]
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setColorMode(m.id)}
                aria-pressed={colorMode === m.id}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  colorMode === m.id
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <m.icon className="size-4" />
                {m.label}
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Preferences</h2>
          <p className="mt-1 text-sm text-muted-foreground">Notifications, sound and timer behavior.</p>
          <div className="mt-2 divide-y divide-border">
            {prefs.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-4 py-3.5">
                <div>
                  <p className="text-sm font-medium text-foreground">{p.label}</p>
                  <p className="text-sm text-muted-foreground text-pretty">{p.desc}</p>
                </div>
                <Switch on={p.on} onToggle={() => togglePref(p.id)} />
              </div>
            ))}
          </div>
        </Card>

        {/* Achievement badges — permanent gallery of earned milestones */}
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Badges</h2>
              <p className="mt-1 text-sm text-muted-foreground">Streak and task milestones. They never expire.</p>
            </div>
            <span className="shrink-0 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              {Object.keys(achievements).length}/{ACHIEVEMENTS.length} earned
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {ACHIEVEMENTS.map((a) => {
              const earnedDate = achievements[a.id]
              const earned = !!earnedDate
              return (
                <div
                  key={a.id}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all duration-200",
                    earned
                      ? "border-focus/30 bg-focus/5 hover:-translate-y-0.5 hover:shadow-md"
                      : "border-border bg-secondary/20 opacity-60",
                  )}
                >
                  <span className={cn("text-2xl", !earned && "grayscale opacity-50")}>
                    {a.icon}
                  </span>
                  <p className="text-sm font-semibold text-foreground">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{a.desc}</p>
                  <p className={cn("text-[10px] font-medium", earned ? "text-focus" : "text-muted-foreground")}>
                    {earned
                      ? `Earned ${new Date(earnedDate + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                      : "Locked"}
                  </p>
                </div>
              )
            })}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Best streak: <span className="font-medium text-foreground">{bestStreak} days</span> · Tasks completed:{" "}
            <span className="font-medium text-foreground">{totalTasksDone}</span>
          </p>
        </Card>
      </div>

      {/* Data backup — export / import everything */}
      <Card className="mt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Data backup
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Back up everything to a JSON file, or restore it on any device.</p>
          </div>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-info/15 text-info">
            <FileJson className="size-4.5" />
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {exported ? <CheckCircle2 className="size-3.5" /> : <Download className="size-3.5" />}
            {exported ? "Exported!" : "Export data"}
          </button>
          {exported && exportedPath && (
            <span className="rounded-lg bg-success/15 px-3 py-1.5 text-xs font-medium text-success">
              📁 {exportedPath}
            </span>
          )}
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Upload className="size-3.5" />
            Import data
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportFile}
            className="hidden"
          />
        </div>
        {isCapacitor() && !exported && (
          <p className="mt-2 text-xs text-muted-foreground">
            On Android, the file saves to your <span className="font-medium text-foreground">Downloads</span> folder. Look for <span className="font-medium text-foreground">proflow-backup-*.json</span> in your Files app.
          </p>
        )}

        {pendingImport ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-danger/30 bg-danger/5 p-3">
            <p className="flex-1 text-sm text-danger">
              This replaces all current data on this device and restarts the app. Continue?
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={confirmImport}
                className="flex items-center gap-1.5 rounded-lg bg-danger px-3 py-2 text-xs font-semibold text-danger-foreground transition-colors hover:bg-danger/90"
              >
                <Upload className="size-3.5" />
                Yes, import
              </button>
              <button
                type="button"
                onClick={() => setPendingImport(null)}
                className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">Importing replaces current data and restarts the app.</p>
        )}

        {lastBackup.savedAt && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-success/10 border border-success/20 px-3 py-2">
            <span className="size-1.5 rounded-full bg-success animate-pulse" />
            <span className="text-xs text-success font-medium">
              Rolling backup active — {lastBackup.keyCount} items saved {new Date(lastBackup.savedAt).toLocaleTimeString()}
            </span>
          </div>
        )}

        {importError && (
          <p className="mt-3 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
            {importError}
          </p>
        )}
      </Card>

      {/* Cloud Sync */}
      <Card className="mt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Cloud sync
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sync across all your devices — phone, PC, tablet. Works anywhere with internet.
            </p>
            <p className="mt-1 text-[10px] text-success/80">
              ✨ Additive sync — new items are merged, existing data is never deleted.
            </p>
          </div>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Wifi className="size-4.5" />
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {cloudConnected ? (
            <>
              {/* Connected status */}
              <div className="rounded-lg border border-success/30 bg-success/5 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Wifi className="size-3.5 text-success" />
                  <p className="text-xs font-semibold text-success">Connected to cloud</p>
                </div>
                <p className="text-[10px] text-muted-foreground">{cloudUrl}</p>
                {cloudInfo.lastSynced && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Last synced: {new Date(cloudInfo.lastSynced).toLocaleTimeString()}
                  </p>
                )}
              </div>

              {/* Sync actions */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleCloudPush}
                  disabled={cloudInfo.status === "syncing"}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
                >
                  {cloudInfo.status === "syncing" ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                  Push data
                </button>
                <button
                  type="button"
                  onClick={handleCloudPull}
                  disabled={cloudInfo.status === "syncing"}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
                >
                  {cloudInfo.status === "syncing" ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                  Pull data
                </button>
                <button
                  type="button"
                  onClick={handleCloudDisconnect}
                  className="flex items-center gap-1.5 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs font-medium text-danger transition-colors hover:bg-danger/20"
                >
                  Disconnect
                </button>
              </div>

              {/* Auto-sync toggle */}
              <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/20 p-3">
                <div>
                  <p className="text-xs font-medium text-foreground">Auto-sync</p>
                  <p className="text-[10px] text-muted-foreground">
                    {cloudAutoSync
                      ? "Syncing every 30s — changes appear on all devices automatically."
                      : "Manually push/pull to sync."
                    }
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCloudAutoSync(!cloudAutoSync)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${cloudAutoSync ? "bg-primary" : "bg-muted"}`}
                >
                  <span className={`inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white shadow transition-transform ${cloudAutoSync ? "translate-x-4" : "translate-x-0.5"}`} />
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Setup instructions */}
              <div className="rounded-lg border border-border bg-secondary/20 p-3">
                <p className="text-xs font-medium text-foreground mb-2">Quick setup (2 minutes)</p>
                <div className="space-y-1.5 text-[10px] text-muted-foreground">
                  <p>1. Go to <a href="https://supabase.com" target="_blank" rel="noopener" className="text-primary underline">supabase.com</a> → New project (free)</p>
                  <p>2. Go to SQL Editor → paste the setup SQL</p>
                  <p>3. Copy Project URL + anon key from Settings → API</p>
                  <p>4. Paste them below and click Connect</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSetupSQL(!showSetupSQL)}
                  className="mt-2 flex items-center gap-1 text-[10px] text-primary hover:underline"
                >
                  {showSetupSQL ? "Hide" : "Show"} setup SQL
                </button>
                {showSetupSQL && (
                  <pre className="mt-2 rounded-lg bg-background/80 p-2 text-[9px] text-foreground overflow-x-auto max-h-32">
                    {`CREATE TABLE IF NOT EXISTS proflow_sync (
  id TEXT PRIMARY KEY DEFAULT 'default',
  user_id TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE proflow_sync ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for anon" ON proflow_sync
  FOR ALL USING (true) WITH CHECK (true);`}
                  </pre>
                )}
              </div>

              {/* Credentials */}
              <div className="rounded-lg border border-border bg-secondary/20 p-3 space-y-2">
                <p className="text-xs font-medium text-foreground mb-2">Enter your Supabase credentials</p>
                <input
                  type="text"
                  placeholder="Project URL (https://xxx.supabase.co)"
                  value={cloudUrl}
                  onChange={(e) => setCloudUrl(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm font-mono outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <input
                  type="text"
                  placeholder="Anon key (ey...)"
                  value={cloudKey}
                  onChange={(e) => setCloudKey(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm font-mono outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={handleCloudConnect}
                  disabled={!cloudUrl || !cloudKey || cloudInfo.status === "connecting"}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {cloudInfo.status === "connecting" ? <Loader2 className="size-3.5 animate-spin" /> : <Wifi className="size-3.5" />}
                  Connect
                </button>
              </div>
            </>
          )}

          {cloudInfo.error && (
            <div className="rounded-lg border border-danger/30 bg-danger/5 p-3">
              <p className="text-xs font-semibold text-danger mb-1">Error</p>
              <p className="text-xs text-danger/80 break-all">{cloudInfo.error}</p>
            </div>
          )}
          {cloudInfo.status === "done" && !cloudInfo.error && (
            <div className="rounded-lg border border-success/30 bg-success/5 p-3">
              <p className="text-xs font-semibold text-success">✅ Sync complete</p>
            </div>
          )}
        </div>
      </Card>

      {/* About & Updates */}
      <Card className="mt-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          About &amp; Updates
        </h2>
        <UpdateCard />
      </Card>

      {/* Danger zone — clear all local data */}
      <Card className="space-y-3 border-danger/20">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 className="font-semibold">Clear all data</h3>
            <p className="text-xs text-muted-foreground">
              Wipes all data on this device. Cannot be undone.
            </p>
          </div>
          <Trash2 className="size-5 shrink-0 text-danger" />
        </div>
        {!confirmReset ? (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="flex items-center gap-1.5 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs font-medium text-danger transition-colors hover:bg-danger/20"
          >
            <Trash2 className="size-3.5" />
            Clear all data
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-danger">Are you sure? This wipes everything.</p>
            <button
              type="button"
              onClick={() => {
                resetAllData()
                setConfirmReset(false)
              }}
              className="flex items-center gap-1.5 rounded-lg bg-danger px-3 py-2 text-xs font-semibold text-danger-foreground transition-colors hover:bg-danger/90"
            >
              <Trash2 className="size-3.5" />
              Yes, delete everything
            </button>
            <button
              type="button"
              onClick={() => setConfirmReset(false)}
              className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/50"
            >
              Cancel
            </button>
          </div>
        )}
      </Card>
    </div>
  )
}

function UpdateCard() {
  const {
    isElectron,
    isCap,
    appVersion,
    status: updateState,
    info: updateInfo,
    progress,
    errorMsg,
    check: handleCheck,
    download: handleDownload,
    install: handleInstall,
  } = useUpdate()

  const platformLabel = isCap ? "ProFlow Android" : isElectron ? "ProFlow Desktop" : "ProFlow"
  const platformBadge = !isElectron && !isCap ? (
    <span className="ml-2 rounded bg-warning/20 px-1.5 py-0.5 text-[10px] font-medium text-warning">Web</span>
  ) : null

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/20 p-3">
        <div>
          <p className="text-sm font-medium text-foreground">{platformLabel}</p>
          <p className="text-xs text-muted-foreground">
            Version {appVersion}
            {platformBadge}
          </p>
        </div>

        <button
          type="button"
          onClick={handleCheck}
          disabled={updateState === "checking" || updateState === "downloading"}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
        >
          {updateState === "checking" ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Checking…
            </>
          ) : updateState === "downloading" ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Downloading {progress}%
            </>
          ) : (
            <>
              <RefreshCw className="size-3.5" />
              Check for Updates
            </>
          )}
        </button>
      </div>

      {/* In-place download progress bar */}
      {updateState === "downloading" && isElectron && (
        <div className="rounded-lg border border-border bg-secondary/20 p-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Downloading update…</span>
            <span className="font-medium text-foreground">{progress}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Installs over the current version — your data stays.</p>
        </div>
      )}

      {/* Update available */}
      {updateState === "available" && updateInfo && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">
                🎉 ProFlow v{updateInfo.latestVersion} Available
              </p>
              {updateInfo.releaseNotes && (
                <p className="mt-0.5 text-xs text-muted-foreground">{updateInfo.releaseNotes}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {isCap ? "Updates in place — your data stays." : "Installs over the current version — your data stays."}
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownload}
              className="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <ExternalLink className="size-3.5" />
              {isCap ? "Download & Install" : "Download Update"}
            </button>
          </div>
        </div>
      )}

      {/* Ready to install (electron) */}
      {updateState === "downloaded" && isElectron && (
        <div className="rounded-lg border border-success/30 bg-success/5 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">
                Update v{updateInfo?.latestVersion || ""} ready
              </p>
              <p className="text-xs text-muted-foreground">Restart to finish installing.</p>
            </div>
            <button
              type="button"
              onClick={handleInstall}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <RefreshCw className="size-3.5" />
              Restart &amp; Update
            </button>
          </div>
        </div>
      )}

      {/* Android: the system installer has been handed the APK */}
      {updateState === "downloaded" && isCap && (
        <div className="rounded-lg border border-success/30 bg-success/5 p-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Update v{updateInfo?.latestVersion || ""} downloaded
              </p>
              <p className="text-xs text-muted-foreground">The system installer is open — tap Install. Your data stays.</p>
            </div>
          </div>
        </div>
      )}

      {/* Up to date */}
      {updateState === "uptodate" && (
        <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 p-3">
          <CheckCircle2 className="size-4 text-success" />
          <p className="text-sm text-foreground">ProFlow is up to date (v{appVersion})</p>
        </div>
      )}

      {/* Error / browser mode */}
      {updateState === "error" && !isElectron && !isCap && (
        <div className="rounded-lg border border-border bg-secondary/20 p-3">
          <p className="text-xs text-muted-foreground">
            Auto-updates are available in the desktop app.{" "}
            <a
              href="https://github.com/Parthiv2610/proflow/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary/80"
            >
              Download the latest release
            </a>
          </p>
        </div>
      )}

      {(updateState === "error" && (isElectron || isCap)) && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 p-3">
          <p className="text-xs text-muted-foreground">
            {errorMsg || "Could not check for updates. Check your internet connection and try again."}
          </p>
        </div>
      )}
    </div>
  )
}
