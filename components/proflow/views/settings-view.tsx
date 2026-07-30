"use client"

import { useRef, useState, useEffect } from "react"
import {
  Camera,
  Trash2,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Loader2,
} from "lucide-react"
import { Card, PageHeader } from "../ui"
import { useLocalStorage } from "@/lib/use-local-storage"
import { useStore } from "../store"

type Toggle = { id: string; label: string; desc: string; on: boolean }

function Switch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        on ? "bg-primary" : "bg-muted"
      }`}
    >
      <span
        className={`absolute top-0.5 size-5 rounded-full bg-background transition-transform ${
          on ? "translate-x-[22px]" : "translate-x-0.5"
        }`}
      />
    </button>
  )
}

const defaultPrefs: Toggle[] = [
  { id: "p1", label: "Desktop notifications", desc: "Get notified about due tasks and events.", on: true },
  { id: "p2", label: "Focus session reminders", desc: "Nudge me when it's time for deep work.", on: true },
  { id: "p3", label: "Habit streak alerts", desc: "Remind me about incomplete habits at 8 PM.", on: false },
  { id: "p4", label: "Weekly review email", desc: "Send a summary of my week every Sunday.", on: true },
  { id: "p5", label: "Auto-start breaks", desc: "Begin break timer automatically after focus.", on: false },
]

export function SettingsView() {
  const { userName, setUserName, avatarUrl, setAvatarUrl } = useStore()
  const [prefs, setPrefs] = useLocalStorage<Toggle[]>("settings-prefs", defaultPrefs)
  const [theme, setTheme] = useLocalStorage<string>("settings-theme", "Purple")
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const toggle = (id: string) =>
    setPrefs((prev) => prev.map((p) => (p.id === id ? { ...p, on: !p.on } : p)))

  const themes = ["Purple", "Blue", "Green", "Amber"]

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
              <p className="mt-1 text-sm text-muted-foreground">Personal plan</p>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Accent color</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {themes.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTheme(t)}
                className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  theme === t
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Preferences</h2>
          <div className="mt-2 divide-y divide-border">
            {prefs.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-4 py-3.5">
                <div>
                  <p className="text-sm font-medium text-foreground">{p.label}</p>
                  <p className="text-sm text-muted-foreground text-pretty">{p.desc}</p>
                </div>
                <Switch on={p.on} onToggle={() => toggle(p.id)} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* About & Updates */}
      <Card className="mt-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          About &amp; Updates
        </h2>
        <UpdateCard />
      </Card>
    </div>
  )
}

function UpdateCard() {
  const [appVersion, setAppVersion] = useState("1.0.0")
  const [updateState, setUpdateState] = useState<
    "idle" | "checking" | "available" | "uptodate" | "error"
  >("idle")
  const [updateInfo, setUpdateInfo] = useState<{
    latestVersion?: string
    downloadUrl?: string
    releaseNotes?: string
  } | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const api = (window as any).electronAPI
        if (api?.getAppVersion) {
          const ver = await api.getAppVersion()
          if (ver) setAppVersion(ver)
        }
      } catch {}
    }
    load()
  }, [])

  const handleCheck = async () => {
    setUpdateState("checking")
    try {
      const api = (window as any).electronAPI
      if (!api?.checkForUpdate) {
        // Running in browser — no Electron API
        setUpdateState("error")
        return
      }
      const result = await api.checkForUpdate()
      if (result.hasUpdate) {
        setUpdateInfo({
          latestVersion: result.latestVersion,
          downloadUrl: result.downloadUrl,
          releaseNotes: result.releaseNotes,
        })
        setUpdateState("available")
      } else {
        setUpdateState("uptodate")
      }
    } catch {
      setUpdateState("error")
    }
  }

  const handleDownload = async () => {
    if (updateInfo?.downloadUrl) {
      const api = (window as any).electronAPI
      if (api?.downloadUpdate) {
        await api.downloadUpdate(updateInfo.downloadUrl)
      } else {
        window.open(updateInfo.downloadUrl, "_blank")
      }
    }
  }

  const isElectron = !!(window as any).electronAPI?.isElectron

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/20 p-3">
        <div>
          <p className="text-sm font-medium text-foreground">
            ProFlow Desktop
          </p>
          <p className="text-xs text-muted-foreground">
            Version {appVersion}
            {!isElectron && (
              <span className="ml-2 rounded bg-warning/20 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                Web
              </span>
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={handleCheck}
          disabled={updateState === "checking"}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
        >
          {updateState === "checking" ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Checking…
            </>
          ) : (
            <>
              <RefreshCw className="size-3.5" />
              Check for Updates
            </>
          )}
        </button>
      </div>

      {/* Update available */}
      {updateState === "available" && updateInfo && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">
                🎉 ProFlow v{updateInfo.latestVersion} Available
              </p>
              {updateInfo.releaseNotes && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {updateInfo.releaseNotes}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleDownload}
              className="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <ExternalLink className="size-3.5" />
              Download
            </button>
          </div>
        </div>
      )}

      {/* Up to date */}
      {updateState === "uptodate" && (
        <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 p-3">
          <CheckCircle2 className="size-4 text-success" />
          <p className="text-sm text-foreground">
            ProFlow is up to date (v{appVersion})
          </p>
        </div>
      )}

      {/* Error / browser mode */}
      {updateState === "error" && !isElectron && (
        <div className="rounded-lg border border-border bg-secondary/20 p-3">
          <p className="text-xs text-muted-foreground">
            Auto-updates are available in the desktop app.{" "}
            <a
              href="https://github.com/parth-kulkarni1/pro-flow/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary/80"
            >
              Download the latest release
            </a>
          </p>
        </div>
      )}

      {updateState === "error" && isElectron && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 p-3">
          <p className="text-xs text-muted-foreground">
            Could not check for updates. Check your internet connection and try again.
          </p>
        </div>
      )}
    </div>
  )
}
