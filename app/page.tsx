"use client"

import { useCallback, useEffect, useState } from "react"
import { Minimize2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { CaptureDialog } from "@/components/proflow/capture-dialog"
import { CommandPalette } from "@/components/proflow/command-palette"
import { CalendarView } from "@/components/proflow/views/calendar-view"
import { Dashboard } from "@/components/proflow/views/dashboard"
import { FocusView } from "@/components/proflow/views/focus-view"
import { HabitsView } from "@/components/proflow/views/habits-view"
import { NotesView } from "@/components/proflow/views/notes-view"
import { NotificationsView } from "@/components/proflow/views/notifications-view"
import { SettingsView } from "@/components/proflow/views/settings-view"
import { TasksView } from "@/components/proflow/views/tasks-view"
import { ProFlowProvider, useStore } from "@/components/proflow/store"
import { Sidebar } from "@/components/proflow/sidebar"
import { Topbar } from "@/components/proflow/topbar"
import { WelcomeTour } from "@/components/proflow/welcome-tour"

function Workspace() {
  const { view, focusMode, toggleFocusMode } = useStore()
  const [captureOpen, setCaptureOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)

  const handleCapture = useCallback(() => setCaptureOpen(true), [])
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

  return (
    <div className="flex h-svh overflow-hidden bg-background text-foreground">
      {/* Animated sidebar — slides out when focus mode is active */}
      <div
        className="overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out"
        style={{
          width: focusMode ? 0 : 256,
          opacity: focusMode ? 0 : 1,
        }}
      >
        <div className="w-64 shrink-0">
          <Sidebar />
        </div>
      </div>

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
            {view === "tasks" && <TasksView onCapture={handleCapture} />}
            {view === "calendar" && <CalendarView />}
            {view === "notes" && <NotesView />}
            {view === "habits" && <HabitsView />}
            {view === "focus" && <FocusView />}
            {view === "notifications" && <NotificationsView />}
            {view === "settings" && <SettingsView />}
          </AnimatedView>

          {/* Exit Focus Mode badge (only shows when focusMode is true) */}
          <FocusModeExit />
        </main>
      </div>

      <CaptureDialog open={captureOpen} onClose={() => setCaptureOpen(false)} />
      <CommandPalette open={paletteOpen} onClose={closePalette} onCapture={handleCapture} />
      <WelcomeTour />
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
