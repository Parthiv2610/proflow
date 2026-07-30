"use client"

import { Bell, CheckCheck, ListTodo, CalendarDays, Flame, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useStore, type AppNotification } from "@/components/proflow/store"
import { Card, PageHeader } from "@/components/proflow/ui"

const iconFor: Record<AppNotification["type"], typeof Bell> = {
  task: ListTodo,
  event: CalendarDays,
  habit: Flame,
  system: Sparkles,
}

const toneFor: Record<AppNotification["type"], string> = {
  task: "text-danger bg-danger/10",
  event: "text-info bg-info/10",
  habit: "text-focus bg-focus/10",
  system: "text-primary bg-primary/10",
}

export function NotificationsView() {
  const { notifications, markRead, markAllRead } = useStore()
  const unread = notifications.filter((n) => !n.read).length

  return (
    <div className="mx-auto max-w-3xl p-6">
      <PageHeader
        title="Notifications"
        subtitle={unread > 0 ? `${unread} unread` : "You're all caught up"}
      >
        <Button variant="outline" size="sm" onClick={markAllRead} disabled={unread === 0}>
          <CheckCheck className="size-4" />
          Mark all read
        </Button>
      </PageHeader>

      <div className="mt-6 flex flex-col gap-2">
        {notifications.map((n) => {
          const Icon = iconFor[n.type]
          return (
            <Card
              key={n.id}
              className={`flex items-start gap-3 p-4 transition-colors ${
                n.read ? "opacity-70" : ""
              }`}
            >
              <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${toneFor[n.type]}`}>
                <Icon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground">{n.title}</p>
                  {!n.read && <span className="size-2 rounded-full bg-primary" aria-label="unread" />}
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground text-pretty">{n.desc}</p>
                <p className="mt-1 text-xs text-muted-foreground">{n.time}</p>
              </div>
              {!n.read && (
                <button
                  type="button"
                  onClick={() => markRead(n.id)}
                  className="shrink-0 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  Mark read
                </button>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
