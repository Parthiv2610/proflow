"use client"

import { useCallback, useEffect, useState } from "react"
import { Minimize2 } from "lucide-react"
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
import { ChecklistsView } from "@/components/proflow/views/checklists-view"
import { ProFlowProvider, useStore, SIDEBAR_DRAWER_MAX } from "@/components/proflow/store"

import { Sidebar } from "@/components/proflow/sidebar"
import { Topbar } from "@/components/proflow/topbar"
import { BottomTabs } from "@/components/proflow/bottom-tabs"
import { WelcomeTour } from "@/components/proflow/welcome-tour"
import { UpdateBanner } from "@/components/proflow/update-banner"
import { MilestonePopup } from "@/components/proflow/milestone-popup"
import { ErrorBoundary } from "@/components/proflow/error-boundary"
import { FloatingTimer } from "@/components/proflow/floating-timer"
import { startAutoSync, pullFromLan, getLanConfig } from "@/lib/lan-sync"
import { BackupManager } from "@/components/proflow/backup-manager"

function Workspace() {
  const { view, focusMode, sidebarOpen, closeSidebar } = useStore()
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

  // Request notification permission on mount (Android 13+ and desktop).
  useEffect(() => {
    import("@/lib/notify").then(({ requestNotificationPermission }) => requestNotificationPermission())
  }, [])

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

  // Global LAN auto-sync — runs across all views (not just Settings)
  useEffect(() => {
    const cfg = getLanConfig()
    if (!cfg.autoSync || !cfg.lastUrl) return
    const cleanup = startAutoSync(cfg.lastUrl, () => {})
    return cleanup
  }, [])

  // LAN sync: listen for pushed data from the server (desktop receives data from phone)
  useEffect(() => {
    const api = (window as any).electronAPI
    if (!api?.onLanPushed) return
    const unsubPushed = api.onLanPushed((data: Record<string, unknown>) => {
      if (!data || typeof data !== "object") return
      // Additive merge into localStorage — never deletes
      for (const [key, incoming] of Object.entries(data)) {
        const k = "proflow-" + key
        try {
          const raw = localStorage.getItem(k)
          if (raw) {
            const existing = JSON.parse(raw)
            // Array of objects with id — merge additively
            if (Array.isArray(incoming) && incoming.length > 0 && typeof incoming[0] === "object" && incoming[0]?.id) {
              const map = new Map(existing.map((it: any) => [it.id, it]))
              for (const item of incoming) {
                if (!map.has(item.id)) map.set(item.id, item)
                else map.set(item.id, { ...map.get(item.id), ...item })
              }
              localStorage.setItem(k, JSON.stringify(Array.from(map.values())))
            } else if (typeof incoming === "number" && typeof existing === "number") {
              localStorage.setItem(k, String(Math.max(existing, incoming)))
            } else {
              localStorage.setItem(k, JSON.stringify(incoming))
            }
          } else {
            localStorage.setItem(k, JSON.stringify(incoming))
          }
        } catch {}
      }
      window.location.reload()
    })
    return () => { if (typeof unsubPushed === "function") unsubPushed() }
  }, [])

  // LAN sync: server asks for fresh data — respond with current localStorage
  useEffect(() => {
    const api = (window as any).electronAPI
    if (!api?.lanSetDataHandler) return
    const unsubWant = api.lanSetDataHandler(() => {
      // Collect all proflow-* keys from localStorage
      const fresh: Record<string, unknown> = {}
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith("proflow-")) {
          const raw = localStorage.getItem(k)
          if (raw !== null) {
            try { fresh[k.slice("proflow-".length)] = JSON.parse(raw) } catch { fresh[k.slice("proflow-".length)] = raw }
          }
        }
      }
      api.lanGetData?.(fresh)
    })
    return () => { if (typeof unsubWant === "function") unsubWant() }
  }, [])

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
          className="overflow-hidden transition-all duration-200 ease-in-out"
          style={{
            maxHeight: focusMode ? 0 : 64,
            opacity: focusMode ? 0 : 1,
          }}
        >
          <Topbar onCapture={handleCapture} />
        </div>

        <main className="relative flex-1 overflow-y-auto" style={{ background: "radial-gradient(ellipse 80% 50% at 50% -20%, color-mix(in srgb, var(--primary) 4%, transparent), transparent)" }}>
          <AnimatedView key={view}>
            {view === "dashboard" && <Dashboard />}
            {view === "tasks" && <TasksView onCapture={handleCapture} onNewProject={handleNewProject} />}
            {view === "calendar" && <CalendarView />}
            {view === "notes" && <NotesView />}
            {view === "habits" && <HabitsView />}
            {view === "focus" && <FocusView />}
            {view === "progress" && <ProgressView />}
            {view === "checklists" && <ChecklistsView />}
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
      {/* Floating mini timer — shows when timer runs but user is on another view */}
      <FloatingTimer />

      {/* Confetti + badge popup when an achievement milestone is crossed */}
      <MilestonePopup />
      {/* Rolling backup manager — auto-saves data & shows restore prompt */}
      <BackupManager />
    </div>
  )
}

/** Animated wrapper — fades in + slides up each time the view changes */
function AnimatedView({ children }: { children: React.ReactNode }) {
  // h-full: lets views like Notes fill the scroll area and manage their own
  // internal scrolling (OneNote-style panels). Other views simply overflow as
  // before — main is the scroller either way.
  return (
    <div className="h-full view-enter">
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
    <ErrorBoundary>
      <ProFlowProvider>
        <Workspace />
      </ProFlowProvider>
    </ErrorBoundary>
  )
}
