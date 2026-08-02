"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Minimize2, Smartphone } from "lucide-react"
import { cn } from "@/lib/utils"
import { CaptureDialog } from "@/components/proflow/capture-dialog"
import { CommandPalette } from "@/components/proflow/command-palette"
import { CalendarView } from "@/components/proflow/views/calendar-view"
import { Dashboard } from "@/components/proflow/views/dashboard"
import { FocusView } from "@/components/proflow/views/focus-view"
import { ProgressView } from "@/components/proflow/views/progress-view"
import { HabitsView } from "@/components/proflow/views/habits-view"
import { NotesView } from "@/components/proflow/views/notes-view"
import { NotificationsView } from "@/components/proflow/views/notifications-view"
import { SettingsView } from "@/components/proflow/views/settings-view"
import { TasksView } from "@/components/proflow/views/tasks-view"
import { ProFlowProvider, useStore, SIDEBAR_DRAWER_MAX } from "@/components/proflow/store"
import { Sidebar } from "@/components/proflow/sidebar"
import { Topbar } from "@/components/proflow/topbar"
import { BottomTabs } from "@/components/proflow/bottom-tabs"
import { WelcomeTour } from "@/components/proflow/welcome-tour"
import { UpdateBanner } from "@/components/proflow/update-banner"
import { MilestonePopup } from "@/components/proflow/milestone-popup"

function Workspace() {
  const { view, focusMode, toggleFocusMode, sidebarOpen, closeSidebar } = useStore()
  const [captureOpen, setCaptureOpen] = useState(false)
  const [captureProject, setCaptureProject] = useState<string | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)

  // Plain "Add task" opens the dialog fresh; "New project" pre-fills the
  // project name (from the tasks search box) so filling a project is faster.
  const handleCapture = useCallback(() => {
    setCaptureProject(null)
    setCaptureOpen(true)
  }, [])
  const handleNewProject = useCallback((name: string) => {
    setCaptureProject(name)
    setCaptureOpen(true)
  }, [])
  const closePalette = useCallback(() => setPaletteOpen(false), [])

  // ⌘P / Ctrl+P global toggle
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "p") {
        e.preventDefault()
        setPaletteOpen((prev) => !prev)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // Close the sidebar drawer when navigating — but only in drawer mode (small windows).
  // On desktop the inline sidebar stays open so clicking a nav item doesn't collapse it.
  useEffect(() => {
    if (typeof window === "undefined" || window.innerWidth >= SIDEBAR_DRAWER_MAX) return
    closeSidebar()
  }, [view, closeSidebar])

  return (
    <div className="flex h-svh overflow-hidden bg-background text-foreground">
      {/* Desktop sidebar — inline and collapsible. Hidden below lg (drawer takes over),
          collapsed by default on smaller laptop windows, and slides out in focus mode. */}
      <div
        className="hidden overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out lg:block"
        style={{
          width: focusMode || !sidebarOpen ? 0 : 256,
          opacity: focusMode ? 0 : 1,
        }}
      >
        <div className="w-64 shrink-0">
          <Sidebar />
        </div>
      </div>

      {/* Mobile sidebar drawer — slides in from the left over a backdrop */}
      {sidebarOpen && !focusMode && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={closeSidebar}
          />
          <div className="absolute inset-y-0 left-0 animate-in slide-in-from-left-2 duration-300">
            <Sidebar />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Animated topbar — slides up when focus mode is active */}
        <div
          className="overflow-hidden transition-all duration-300 ease-in-out"
          style={{
            maxHeight: focusMode ? 0 : 80,
            opacity: focusMode ? 0 : 1,
          }}
        >
          <Topbar onCapture={handleCapture} />
        </div>

        <main className="relative flex-1 overflow-y-auto">
          <AnimatedView key={view}>
            {view === "dashboard" && <Dashboard />}
            {view === "tasks" && <TasksView onCapture={handleCapture} onNewProject={handleNewProject} />}
            {view === "calendar" && <CalendarView />}
            {view === "notes" && <NotesView />}
            {view === "habits" && <HabitsView />}
            {view === "focus" && <FocusView />}
            {view === "progress" && <ProgressView />}
            {view === "notifications" && <NotificationsView />}
            {view === "settings" && <SettingsView />}
          </AnimatedView>

          {/* Exit Focus Mode badge (only shows when focusMode is true) */}
          <FocusModeExit />

          {/* One-click update prompt — appears on any view when a newer build exists */}
          {!focusMode && <UpdateBanner />}
        </main>

        {/* Phone bottom tab bar — fast navigation on the APK; hidden on desktop & focus mode */}
        <div className={cn("shrink-0 lg:hidden", focusMode && "hidden")}>
          <BottomTabs />
        </div>
      </div>

      <CaptureDialog
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
        initialProject={captureProject ?? undefined}
      />
      <CommandPalette open={paletteOpen} onClose={closePalette} onCapture={handleCapture} />
      <WelcomeTour />
      <LanPasscodeGate />
      {/* Confetti + badge popup when an achievement milestone is crossed */}
      <MilestonePopup />
    </div>
  )
}

/**
 * First-time phone connect: the Android APK is linked to the laptop over
 * Wi-Fi. Ask for the 6-digit passcode shown on the laptop before syncing.
 */
function LanPasscodeGate() {
  const { lanInfo, lanAuthed, lanGateOpen, closeLanGate, submitLanPasscode } = useStore()
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (lanInfo?.mode !== "cap" || lanAuthed || !lanGateOpen) return null

  const submit = async () => {
    setBusy(true)
    const result = await submitLanPasscode(code)
    setBusy(false)
    setError(
      result === "wrong-code"
        ? "That code didn't work — check the laptop's screen and try again."
        : result === "unreachable"
          ? "Can't reach the laptop right now. Make sure ProFlow is open on it and both devices are on the same Wi-Fi."
          : null,
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-md">
      <div className="animate-in fade-in zoom-in-95 duration-200 w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Smartphone className="size-5" />
        </div>
        <h2 className="mt-3 text-lg font-semibold text-foreground">Connect to your laptop</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This app is linked to your ProFlow laptop on the same Wi-Fi. Enter the 6-digit code shown under{" "}
          <span className="font-medium text-foreground">Settings → LAN Sync</span> on the laptop.
        </p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="••••••"
          inputMode="numeric"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && code.length === 6) submit()
          }}
          className="mt-4 w-full rounded-lg border border-border bg-secondary/40 px-3 py-2.5 text-center font-mono text-2xl tracking-[0.5em] text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
        />
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={busy || code.length !== 6}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            Connect
          </button>
          <button
            type="button"
            onClick={closeLanGate}
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}

/** Animated wrapper — fades in + slides up each time the view changes */
function AnimatedView({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      {children}
    </div>
  )
}

/** Subtle floating badge at the bottom of the screen when focus mode is active */
function FocusModeExit() {
  const { toggleFocusMode, focusMode } = useStore()

  if (!focusMode) return null

  return (
    <div className="pointer-events-none sticky bottom-0 z-40 flex justify-center pb-4">
      <button
        type="button"
        onClick={toggleFocusMode}
        className={cn(
          "pointer-events-auto flex items-center gap-2 rounded-full",
          "border border-border/40 bg-background/70 px-4 py-2 text-xs font-medium",
          "text-muted-foreground backdrop-blur-lg",
          "transition-all duration-200",
          "hover:border-border/60 hover:bg-background/90 hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        )}
      >
        <Minimize2 className="size-3" />
        <span>Exit Focus Mode</span>
        <kbd className="ml-1 rounded border border-border/40 bg-muted/50 px-1 py-0.5 text-[9px] font-medium">
          ⌘P
        </kbd>
      </button>
    </div>
  )
}

export default function Page() {
  return (
    <ProFlowProvider>
      <Workspace />
    </ProFlowProvider>
  )
}
