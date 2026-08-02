"use client"

import { useRef, useState } from "react"
import {
  Camera,
  Trash2,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Loader2,
  Copy,
  Smartphone,
  Sparkles,
  Unlink,
  Wifi,
  WifiOff,
  Download,
  Upload,
  FileJson,
} from "lucide-react"
import { cn, timeAgo } from "@/lib/utils"
import { getStoredLaptopUrl } from "@/lib/lan-sync"
import { useUpdate } from "@/lib/use-update"
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
  const handleExport = () => {
    try {
      const data: Record<string, string> = {}
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith("proflow-")) {
          const raw = localStorage.getItem(k)
          if (raw !== null) data[k] = raw
        }
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `proflow-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setExported(true)
      setTimeout(() => setExported(false), 2500)
      setImportError(null)
    } catch {
      // storage unavailable — nothing to export
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

      {/* LAN Sync — native phone app access */}
      <Card className="mt-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          LAN Sync — phone app access
        </h2>
        <LanSyncCard />
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

// ── LAN Sync ───────────────────────────────────────────
function LanSyncCard() {
  const {
    lanInfo,
    lanAuthed,
    lanOnline,
    lanBusy,
    lanError,
    lastSyncedAt,
    enableLan,
    disableLan,
    regenLanPasscode,
    disconnectPhone,
    connectToLaptop,
    openLanGate,
  } = useStore()
  const [copied, setCopied] = useState(false)
  const [laptopUrl, setLaptopUrl] = useState(getStoredLaptopUrl())
  const [connectState, setConnectState] = useState<"idle" | "busy" | "error">("idle")
  const [connectError, setConnectError] = useState<string | null>(null)
  const [selfTest, setSelfTest] = useState<"idle" | "busy" | "done">("idle")
  const [selfTestResult, setSelfTestResult] = useState<{
    reachable: boolean
    reason?: string
    testedIp?: string | null
  } | null>(null)

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      },
      () => {},
    )
  }

  // ── APK view (Android app linking to a specific laptop over Wi-Fi) ──
  if (lanInfo?.mode === "cap") {
    const connect = async () => {
      const url = laptopUrl.trim()
      if (!url) return
      setConnectState("busy")
      setConnectError(null)
      const result = await connectToLaptop(url)
      setConnectState("idle")
      if (result === "unreachable") {
        setConnectError(
          "Can't reach that laptop. Make sure ProFlow is open on it, both devices are on the same Wi-Fi, and LAN Sync is turned on.",
        )
      }
    }
    return (
      <div className="mt-4 space-y-3">
        <div
          className={cn(
            "flex items-center gap-3 rounded-lg border p-3",
            lanAuthed && lanOnline
              ? "border-success/30 bg-success/5"
              : "border-warning/30 bg-warning/5",
          )}
        >
          {lanAuthed && lanOnline ? (
            <Wifi className="size-5 shrink-0 text-success" />
          ) : (
            <WifiOff className="size-5 shrink-0 text-warning" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">
              {lanAuthed && lanOnline ? "Connected to your laptop" : lanInfo?.url ? "Laptop offline" : "Not connected"}
            </p>
            <p className="text-sm text-muted-foreground">
              {lanAuthed && lanOnline
                ? `Synced ${timeAgo(lastSyncedAt)} · ${lanInfo?.ip || "laptop"}`
                : lanInfo?.url
                  ? "Keep ProFlow open on the laptop and both devices on the same Wi-Fi."
                  : "Enter the address shown on your laptop's Settings → LAN Sync screen."}
            </p>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Laptop address</p>
          <div className="mt-2 flex gap-2">
            <input
              value={laptopUrl}
              onChange={(e) => setLaptopUrl(e.target.value)}
              placeholder="http://192.168.1.5:5174"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              className="min-w-0 flex-1 rounded-lg border border-border bg-secondary/40 px-3 py-2 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
            />
            {lanAuthed ? (
              <button
                type="button"
                onClick={disconnectPhone}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-danger/40 hover:bg-danger/10 hover:text-danger"
              >
                <Unlink className="size-3.5" />
                Disconnect
              </button>
            ) : (
              <button
                type="button"
                onClick={connect}
                disabled={connectState === "busy" || !laptopUrl.trim()}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {connectState === "busy" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Smartphone className="size-3.5" />
                )}
                Connect
              </button>
            )}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            On the laptop, open <span className="font-medium text-foreground">Settings → LAN Sync</span> and
            switch it on — it shows an address like <code className="rounded bg-secondary/40 px-1 font-mono text-xs">http://192.168.1.5:5174</code>.
            Type it here and tap Connect.
          </p>
        </div>

        {connectError && (
          <p className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{connectError}</p>
        )}

        {lanInfo?.url && !lanAuthed && (
          <button
            type="button"
            onClick={openLanGate}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Smartphone className="size-3.5" />
            Enter passcode to sync
          </button>
        )}
      </div>
    )
  }

  // ── Laptop view (desktop app — hosts the server) ──
  const enabled = !!lanInfo?.enabled

  const runSelfTest = async () => {
    const api = (window as any).electronAPI
    if (!api?.lanSelfTest) return
    setSelfTest("busy")
    setSelfTestResult(null)
    const result = await api.lanSelfTest()
    setSelfTestResult(result)
    setSelfTest("done")
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">Allow your phone to use this app</p>
          <p className="text-sm text-muted-foreground">
            No account or internet — both devices just need the same Wi-Fi.
          </p>
        </div>
        <Switch on={enabled} onToggle={() => (enabled ? disableLan() : enableLan())} />
      </div>

      {enabled ? (
        <>
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Open this on your phone
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground">
                    {lanInfo?.url || "starting…"}
                  </code>
                  <button
                    type="button"
                    onClick={() => lanInfo?.url && copy(lanInfo.url)}
                    className="flex shrink-0 items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {copied ? <CheckCircle2 className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  On your phone, open the <span className="font-medium text-foreground">ProFlow app</span> and go to{" "}
                  <span className="font-medium text-foreground">Settings → LAN Sync</span>, then type this address to link
                  it to this laptop. If Windows Firewall asks, click{" "}
                  <span className="font-medium text-foreground">Allow</span>. On networks with several ProFlow
                  laptops, each shows its own address — use the one on this screen.
                </p>
                {(lanInfo?.ips?.length || 0) > 1 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      Other addresses on this computer
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {(lanInfo?.ips || []).map((ip, i) => (
                        <button
                          key={ip}
                          type="button"
                          onClick={() => copy(`http://${ip}:${lanInfo?.port || 5174}`)}
                          title="Copy this address"
                          className="flex items-center gap-1 rounded-md border border-border bg-secondary/40 px-2 py-1 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          {i === 0 ? "Preferred: " : "Alt: "}
                          {ip}
                          <Copy className="size-3" />
                        </button>
                      ))}
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      If your phone can&apos;t reach the first address, try another one — the laptop may have
                      virtual network adapters (Docker, WSL, VMware) that look valid but aren&apos;t on your Wi-Fi.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Connection diagnostic — tells the user whether the server is reachable
              on the laptop's own LAN address, and points at the firewall if not. */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-secondary/20 p-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Having trouble connecting?
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {selfTestResult && !selfTestResult.reachable && selfTestResult.reason === "firewall"
                  ? "The server is running, but your phone couldn't reach it on a LAN address — Windows Firewall is the usual culprit. Try the other IP chips above first (a virtual adapter address would also fail here). If none work, allow ProFlow in the firewall, or restart it and click Allow when prompted."
                  : selfTestResult && !selfTestResult.reachable
                    ? "The server didn't answer on the LAN address. Turn it off and on again, or check that port " +
                      (lanInfo?.port || 5174) +
                      " is free."
                    : "This checks whether your phone can actually reach this laptop over Wi-Fi, and shows a fix if the firewall is in the way."}
              </p>
            </div>
            <button
              type="button"
              onClick={runSelfTest}
              disabled={selfTest === "busy"}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              {selfTest === "busy" ? <Loader2 className="size-3.5 animate-spin" /> : <Wifi className="size-3.5" />}
              Test connection
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-secondary/20 p-3">
            <div>
              <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Sync passcode</p>
              <p className="mt-1 font-mono text-2xl font-bold tracking-[0.4em] text-foreground">
                {lanInfo?.passcode || "······"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Your phone asks for this the first time it connects.
              </p>
            </div>
            <button
              type="button"
              onClick={regenLanPasscode}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <RefreshCw className="size-3.5" />
              New code
            </button>
          </div>

          {lanError && (
            <p className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
              Couldn&apos;t start the server: {lanError}. Check that port 5174 is free and allow ProFlow through Windows Firewall.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Server active{lanBusy ? " — starting…" : ""}. Tasks, habits, goals, events, notes, XP, achievements, streak shields and best streaks all sync both ways.
          </p>
        </>
      ) : (
        <p className="rounded-lg border border-border bg-secondary/20 p-3 text-sm text-muted-foreground">
          Turn this on to browse and edit ProFlow from your phone. Changes sync automatically in both directions —
          even with no internet.
        </p>
      )}
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
