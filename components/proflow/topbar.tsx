"use client"

import { useEffect, useRef } from "react"
import { Bell, Command, Menu, Pause, Play, Plus, Search, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatTime, useStore } from "./store"

export function Topbar({ onCapture }: { onCapture: () => void }) {
  const { search, setSearch, setView, secondsLeft, running, toggleTimer, notifications, toggleSidebar, sidebarOpen } = useStore()
  const searchRef = useRef<HTMLInputElement>(null)
  const unread = notifications.filter((n) => !n.read).length

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/80 px-6 py-3 backdrop-blur-md">
      {/* Hamburger — toggles the sidebar at every window size: opens the drawer on
          small windows, expands/collapses the inline sidebar on larger ones. */}
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted"
      >
        <Menu className="size-4" />
      </button>

      <form
        className="relative min-w-0 flex-1 max-w-xl"
        onSubmit={(e) => {
          e.preventDefault()
          setView("tasks")
        }}
      >
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={searchRef}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            if (e.target.value) setView("tasks")
          }}
          placeholder="Search tasks, notes, events..."
          className="h-10 w-full min-w-0 rounded-xl border border-input bg-secondary/50 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 sm:pr-24"
        />
        <div className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 items-center gap-1 sm:flex">
          <kbd className="flex items-center gap-0.5 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            ⌘K
          </kbd>
          <kbd className="flex items-center gap-0.5 rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            <Command className="size-2.5" />P
          </kbd>
        </div>
      </form>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => setView("focus")}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-focus transition-colors hover:bg-focus/10"
        >
          <span className={cn("size-2 rounded-full bg-focus", running && "animate-pulse")} />
          <span className="tabular-nums">{formatTime(secondsLeft)}</span>
          <span className="hidden text-focus/80 sm:inline">Focus</span>
        </button>

        <button
          type="button"
          onClick={toggleTimer}
          aria-label={running ? "Pause focus timer" : "Start focus timer"}
          className="flex size-9 items-center justify-center rounded-xl border border-border bg-secondary/50 text-foreground transition-colors hover:bg-muted"
        >
          {running ? <Pause className="size-4" /> : <Play className="size-4" />}
        </button>

        <Button size="lg" onClick={onCapture} className="gap-1.5 px-1.5 sm:px-2.5">
          <Plus className="size-4" />
          <span className="hidden sm:inline">Capture</span>
        </Button>

        <button
          type="button"
          onClick={() => setView("notifications")}
          aria-label="Notifications"
          className="relative flex size-9 items-center justify-center rounded-xl border border-border bg-secondary/50 text-foreground transition-colors hover:bg-muted"
        >
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-danger text-[10px] font-semibold text-danger-foreground">
              {unread}
            </span>
          )}
        </button>

        <span className="hidden size-9 items-center justify-center rounded-xl border border-border bg-secondary/50 text-primary sm:flex">
          <Zap className="size-4" />
        </span>
      </div>
    </header>
  )
}
