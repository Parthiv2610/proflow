"use client"

import {
  Bell,
  Calendar,
  FileText,
  Flame,
  LayoutDashboard,
  ListTodo,
  Settings,
  Target,
  Timer,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useStore, type View } from "./store"

type NavItem = {
  id: View
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
  hint?: string
}

const workspace: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, hint: "Overview of tasks, habits, goals & stats" },
  { id: "tasks", label: "Tasks & Projects", icon: ListTodo, hint: "Manage to-dos with drag & drop priorities" },
  { id: "calendar", label: "Calendar", icon: Calendar, hint: "Week & month view with time-block events" },
]

const tools: NavItem[] = [
  { id: "notes", label: "Notes & Docs", icon: FileText, hint: "Quick notes with tags" },
  { id: "habits", label: "Habits & Goals", icon: Target, hint: "Track daily routines and goal progress" },
  { id: "focus", label: "Focus Timer", icon: Timer, hint: "Pomodoro sessions for deep work" },
]

export function Sidebar() {
  const { view, setView, tasks, habits, notifications, userName, avatarUrl, sessionCount } = useStore()
  const overdueCount = tasks.filter((t) => t.overdue && t.status !== "done").length
  const unread = notifications.filter((n) => !n.read).length
  const maxStreak = habits.length > 0 ? Math.max(...habits.map((h) => h.streak)) : 0
  const showHints = sessionCount < 5

  return (
    <aside className="flex h-svh w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
            <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" fill="currentColor" opacity="0.35" />
            <path d="M12 2 3 7l9 5 9-5-9-5Z" fill="currentColor" />
          </svg>
        </div>
        <span className="text-lg font-semibold tracking-tight text-sidebar-foreground">ProFlow</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3">
        <NavGroup label="Workspace">
          {workspace.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              active={view === item.id}
              badge={item.id === "tasks" ? overdueCount : undefined}
              onClick={() => setView(item.id)}
              showHint={showHints}
            />
          ))}
        </NavGroup>

        <NavGroup label="Tools">
          {tools.map((item) => (
            <NavButton key={item.id} item={item} active={view === item.id} onClick={() => setView(item.id)} showHint={showHints} />
          ))}
        </NavGroup>

        <div className="mt-6 rounded-2xl border border-sidebar-border bg-gradient-to-b from-accent/60 to-transparent p-4">
          <div className="flex items-center gap-2">
            <Flame className="size-4 text-focus" />
            <span className="text-sm font-semibold text-sidebar-foreground">{maxStreak > 0 ? `${maxStreak}-day streak` : "Start a habit"}</span>
          </div>
          <div className="mt-3 flex gap-1">
            {Array.from({ length: 14 }).map((_, i) => (
              <span
                key={i}
                className={cn("h-1.5 flex-1 rounded-full", i < maxStreak ? "bg-focus" : "bg-muted")}
              />
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{maxStreak > 0 ? "Keep it going!" : "Create a habit to get started"}</p>
        </div>
      </nav>

      <div className="px-3 pb-3">
        <NavButton
          item={{ id: "notifications", label: "Notifications", icon: Bell, hint: "Alerts for tasks, events & habits" }}
          active={view === "notifications"}
          badge={unread}
          badgeTone="danger"
          onClick={() => setView("notifications")}
          showHint={showHints}
        />
        <NavButton
          item={{ id: "settings", label: "Settings", icon: Settings, hint: "Profile, theme & preferences" }}
          active={view === "settings"}
          onClick={() => setView("settings")}
          showHint={showHints}
        />
        <button
          type="button"
          onClick={() => setView("settings")}
          className="mt-2 flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-sidebar-accent"
        >
          {avatarUrl ? (
            <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-primary/30">
              <img src={avatarUrl} alt="" className="size-full object-cover" />
            </span>
          ) : (
            <span className="flex size-9 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary">
              {userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-sidebar-foreground">{userName}</span>
            <span className="block truncate text-xs text-muted-foreground">Personal</span>
          </span>
        </button>
      </div>
    </aside>
  )
}

function NavGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 first:mt-2">
      <p className="px-3 pb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">{label}</p>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  )
}

function NavButton({
  item,
  active,
  badge,
  badgeTone = "primary",
  onClick,
  showHint = false,
}: {
  item: NavItem
  active: boolean
  badge?: number
  badgeTone?: "primary" | "danger"
  onClick: () => void
  showHint?: boolean
}) {
  const Icon = item.icon
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium",
          "transition-all duration-200 ease-out",
          active
            ? "bg-sidebar-accent text-sidebar-foreground shadow-sm"
            : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
        )}
      >
        {/* Active indicator bar */}
        {active && (
          <span className="absolute -left-3 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary animate-in fade-in slide-in-from-left-1 duration-200" />
        )}
        <Icon className={cn(
          "size-4.5 shrink-0 transition-all duration-200",
          active
            ? "text-primary scale-110"
            : "text-muted-foreground group-hover:text-sidebar-foreground group-hover:scale-105",
        )} />
        <span className="flex-1 text-left">{item.label}</span>
        {badge != null && badge > 0 && (
          <span
            className={cn(
              "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold",
              badgeTone === "danger" ? "bg-danger text-danger-foreground" : "bg-primary text-primary-foreground",
            )}
          >
            {badge}
          </span>
        )}
      </button>
      {/* Tooltip hint — appears on hover during first 5 sessions */}
      {showHint && item.hint && (
        <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 -translate-x-1/2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <div className="whitespace-nowrap rounded-lg border border-border bg-popover px-2.5 py-1.5 text-[11px] font-medium text-popover-foreground shadow-lg">
            {item.hint}
          </div>
          <div className="absolute left-1/2 top-full -translate-x-1/2 border-[5px] border-transparent border-t-popover" />
        </div>
      )}
    </div>
  )
}
