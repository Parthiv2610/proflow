"use client"

import { Calendar, CheckSquare, LayoutDashboard, ListTodo, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import { useStore, type View } from "./store"

type TabItem = {
  id: View
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
}

export function BottomTabs() {
  const { view, setView, tasks, closeSidebar } = useStore()
  const overdueCount = tasks.filter((t) => t.overdue).length

  const tabs: TabItem[] = [
    { id: "dashboard", label: "Home", icon: LayoutDashboard },
    { id: "tasks", label: "Tasks", icon: ListTodo, badge: overdueCount },
    { id: "checklists", label: "Lists", icon: CheckSquare },
    { id: "calendar", label: "Calendar", icon: Calendar },
    { id: "settings", label: "Settings", icon: Settings },
  ]

  return (
    <nav
      aria-label="Primary"
      className="flex shrink-0 items-stretch border-t border-border bg-background/95 px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-lg"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon
        const active = view === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setView(tab.id)
              closeSidebar()
            }}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl py-1.5",
              "transition-all duration-200 ease-out",
              active ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span
              className={cn(
                "relative flex size-8 items-center justify-center rounded-full transition-all duration-200",
                active && "bg-primary/15",
              )}
            >
              <Icon className={cn("size-5 transition-transform duration-200", active && "scale-110")} />
              {tab.badge != null && tab.badge > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-semibold text-danger-foreground">
                  {tab.badge}
                </span>
              )}
            </span>
            <span className="text-[10px] leading-none font-medium">{tab.label}</span>
            {/* Active indicator dot */}
            <span
              className={cn(
                "absolute -bottom-1 h-1 w-1 rounded-full bg-primary transition-all duration-200",
                active ? "opacity-100" : "opacity-0",
              )}
            />
          </button>
        )
      })}
    </nav>
  )
}
