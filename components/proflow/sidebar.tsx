"use client"

import { Bell, Calendar, CheckSquare, FileText, LayoutDashboard, ListTodo, Settings, Target, Timer, Trophy } from "lucide-react"
import { cn } from "@/lib/utils"
import { useStore, type View } from "./store"

type NavItem = {
  id: View
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
}

// Grouped nav sections with dividers between them
const navGroups: { items: NavItem[] }[] = [
  {
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "tasks", label: "Tasks", icon: ListTodo },
      { id: "checklists", label: "Checklists", icon: CheckSquare },
    ],
  },
  {
    items: [
      { id: "habits", label: "Habits", icon: Target },
      { id: "focus", label: "Focus", icon: Timer },
    ],
  },
  {
    items: [
      { id: "notes", label: "Notes", icon: FileText },
      { id: "calendar", label: "Calendar", icon: Calendar },
      { id: "progress", label: "Progress", icon: Trophy },
    ],
  },
]

export function Sidebar() {
  const { view, setView, tasks, notifications, userName, avatarUrl } = useStore()
  const overdueCount = tasks.filter((t) => t.overdue).length
  const unread = notifications.filter((n) => !n.read).length

  return (
    <aside className="flex h-svh w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden="true">
            <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" fill="currentColor" opacity="0.35" />
            <path d="M12 2 3 7l9 5 9-5-9-5Z" fill="currentColor" />
          </svg>
        </div>
        <span className="text-sm font-semibold text-sidebar-foreground">ProFlow</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 flex flex-col justify-between py-2">
        {navGroups.map((group, gi) => (
          <div key={gi} className="flex flex-col">
            {gi > 0 && <div className="mx-2 my-1.5 h-px bg-sidebar-border/50" />}
            <div className="nav-enter flex flex-col gap-0.5">
              {group.items.map((item) => (
                <NavButton
                  key={item.id}
                  item={item}
                  active={view === item.id}
                  badge={item.id === "tasks" ? overdueCount : undefined}
                  onClick={() => setView(item.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-2 pb-3 flex flex-col">
        <div className="mx-2 my-1.5 h-px bg-sidebar-border/50" />
        <NavButton
          item={{ id: "notifications", label: "Notifications", icon: Bell }}
          active={view === "notifications"}
          badge={unread}
          badgeTone="danger"
          onClick={() => setView("notifications")}
        />
        <NavButton
          item={{ id: "settings", label: "Settings", icon: Settings }}
          active={view === "settings"}
          onClick={() => setView("settings")}
        />
        <div className="mx-2 my-1.5 h-px bg-sidebar-border/50" />
        <button
          type="button"
          onClick={() => setView("settings")}
          className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-sidebar-accent"
        >
          {avatarUrl ? (
            <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full">
              <img src={avatarUrl} alt="" className="size-full object-cover" />
            </span>
          ) : (
            <span className="flex size-7 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
              {userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
            </span>
          )}
          <span className="truncate text-sm text-sidebar-foreground">{userName}</span>
        </button>
      </div>
    </aside>
  )
}

function NavButton({
  item,
  active,
  badge,
  badgeTone = "primary",
  onClick,
}: {
  item: NavItem
  active: boolean
  badge?: number
  badgeTone?: "primary" | "danger"
  onClick: () => void
}) {
  const Icon = item.icon
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm",
        "transition-all duration-200 ease-out",
        active
          ? "bg-sidebar-accent text-sidebar-foreground font-medium shadow-sm"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
      )}
    >
      {/* Sliding active indicator */}
      {active && (
        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" style={{ animation: "slide-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) both" }} />
      )}
      <Icon className={cn(
        "size-4 shrink-0 transition-all duration-200",
        active && "text-primary scale-110",
      )} />
      <span className="flex-1 text-left">{item.label}</span>
      {badge != null && badge > 0 && (
        <span
          className={cn(
            "flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold",
            badgeTone === "danger" ? "bg-danger text-danger-foreground" : "bg-primary text-primary-foreground",
          )}
        >
          {badge}
        </span>
      )}
    </button>
  )
}
