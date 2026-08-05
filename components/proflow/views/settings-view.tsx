"use client"

import { useRef, useState } from "react"
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
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useUpdate } from "@/lib/use-update"
import { isCapacitor } from "@/lib/lan-sync"
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
    prefs,
    togglePref,
    weeklyFocusGoal,
    setWeeklyFocusGoal,
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
  // Parsed backup waiting for confirmation — import replaces current data.
  const [pendingImport, setPendingImport] = useState<Record<string, string> | null>(null)
  // Local string state so the user can clear the field while typing without the
  // controlled value snapping back to "0" on every keystroke.
  const [goalHoursInput, setGoalHoursInput] = useState(() => String(weeklyFocusGoal / 60))

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

  const themes = ["Purple", "Blue", "Green", "Amber"]

  // ── Data backup: export / import everything stored under the proflow- prefix ──
  // All app state (tasks, habits, goals, events, notes, focus log, settings,
  // XP, badges) lives in localStorage under "proflow-" keys. Export collects
  // every one of those keys into a single JSON file; import validates the file,
  // writes the keys back, and reloads so the store re-initializes from them.
  const handleExport = async () => {
    try {
      const data: Record<string, string> = {}
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith("proflow-")) {
          const raw = localStorage.getItem(k)
          if (raw !== null) data[k] = raw
        }
      }
      const fileName = `proflow-backup-${new Date().toISOString().slice(0, 10)}.json`
      const content = JSON.stringify(data, null, 2)

      // Android APK: the WebView ignores browser-style anchor downloads, so the
      // native Backup plugin writes the JSON straight to Downloads instead.
      if (isCapacitor()) {
        const backup = (window as any).Capacitor?.Plugins?.Backup
        if (!backup?.saveBackup) throw new Error("Backup plugin not available — update the app")
        await backup.saveBackup({ fileName, content })
        setExported(true)
        setTimeout(() => setExported(false), 2500)
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
      if (!/cancell?ed/i.test(msg)) {
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
        // Only accept proflow-* keys so a foreign JSON can't pollute the app.
        const entries: Record<string, string> = {}
        let count = 0
        Object.entries(parsed).forEach(([key, value]) => {
          if (key.startsWith("proflow-") && typeof value === "string") {
            entries[key] = value
            count++
          }
        })
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
              <p className="mt-1 text-sm text-muted-foreground">Your name shows on the dashboard greeting.</p>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Accent color</h2>
          <p className="mt-1 text-sm text-muted-foreground">Changes the app theme instantly — buttons, sidebar and charts recolor live.</p>
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
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Preferences</h2>
          <p className="mt-1 text-sm text-muted-foreground">Each setting here actually does something — notifications, sound and timer flow.</p>
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

        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Deep work goal</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            How much deep focus you want to hit each week. The Progress page shows your progress toward this goal.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <input
              type="number"
              min={0}
              max={168}
              step={0.5}
              value={goalHoursInput}
              onChange={(e) => {
                setGoalHoursInput(e.target.value)
                const hours = Number(e.target.value)
                if (Number.isFinite(hours)) setWeeklyFocusGoal(Math.max(0, Math.min(168, hours)) * 60)
              }}
              onBlur={() => setGoalHoursInput(String(weeklyFocusGoal / 60))}
              className="w-32 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm font-semibold text-foreground tabular-nums outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
            />
            <span className="text-sm text-muted-foreground">hours per week</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Set to 0 to hide the goal from the Progress page.
          </p>
        </Card>

        {/* Achievement badges — permanent gallery of earned milestones */}
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Badges</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Milestones you&apos;ve crossed — streaks and tasks. They never expire.
              </p>
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
            <p className="mt-1 text-sm text-muted-foreground">
              Export all your tasks, habits, notes, focus history, badges and settings to a JSON file — or
              restore them on this or another device.
            </p>
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
          <p className="mt-3 text-xs text-muted-foreground">
            Export keeps a copy of everything on this device. Importing replaces your current data and restarts
            the app — keep your backup file safe.
          </p>
        )}

        {importError && (
          <p className="mt-3 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
            {importError}
          </p>
        )}
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
              Deletes every task, habit, note, event, goal, and setting stored on this device and
              starts fresh. This cannot be undone.
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
          <p className="mt-2 text-xs text-muted-foreground">
            Installs over the current version — your data stays. No reinstall needed.
          </p>
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
                {isCap
                  ? "Updates in place with the same signature — tasks, habits and notes are kept."
                  : "Installs over the current version — your data is kept."}
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
              <p className="text-xs text-muted-foreground">
                Restart to finish installing — takes a few seconds.
              </p>
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
              <p className="text-xs text-muted-foreground">
                The system installer should now be open — tap Install (over the current version).
                Your tasks, habits and notes are kept.
              </p>
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
