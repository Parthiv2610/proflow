"use client"

import { useMemo } from "react"
import { CalendarDays, PartyPopper } from "lucide-react"
import { useStore } from "./store"
import { Card } from "./ui"

/** Last 7 days (including today), oldest → newest. */
function lastWeekKeys(): string[] {
  const now = new Date()
  const keys: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    keys.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    )
  }
  return keys
}

function nudge(
  tasksDone: number,
  habitsDone: number,
  focusHours: number,
  sessions: number,
  bestStreak: number,
): string {
  if (sessions >= 10) return `🔥 ${sessions} focus sessions — a genuinely focused week.`
  if (tasksDone >= 15) return `🚀 ${tasksDone} tasks closed out. That's serious momentum.`
  if (tasksDone >= 8) return `✨ ${tasksDone} tasks done — steady and consistent.`
  if (bestStreak >= 5) return `🌱 ${bestStreak}-day habit streak — showing up every day counts.`
  if (focusHours >= 5) return `💪 ${focusHours} hrs of focus banked this week.`
  if (habitsDone > 0) return `🌤️ ${habitsDone} habit${habitsDone > 1 ? "s" : ""} kept up this week.`
  return `🌤️ No pressure — next week is a fresh page, and even one small win counts.`
}

export function WeeklyWrap() {
  const { tasks, habits, focusLog, userName } = useStore()

  const wrap = useMemo(() => {
    const keys = lastWeekKeys()
    const keySet = new Set(keys)

    const tasksDone = tasks.filter((t) => t.completedAt && keySet.has(t.completedAt)).length
    const habitsDone = habits.filter((h) => h.streak > 0 || h.doneToday).length
    const bestStreak = habits.length ? Math.max(...habits.map((h) => h.streak)) : 0

    let minutes = 0
    let sessions = 0
    for (const key of keys) {
      const entry = focusLog.find((e) => e.date === key)
      if (entry) {
        minutes += entry.minutes
        sessions += entry.sessions
      }
    }
    const focusHours = Math.round((minutes / 60) * 10) / 10

    // XP is an estimate derived from the week's real completions, matching the
    // store's reward values (task +10, habit +5, session +25).
    const xp = tasksDone * 10 + habitsDone * 5 + sessions * 25

    const headline =
      sessions >= 10
        ? "A monster week of focus"
        : tasksDone >= 15
          ? "Absolute machine week"
          : tasksDone >= 8
            ? "What a productive week"
            : sessions >= 3 || focusHours >= 3
              ? "A nicely balanced week"
              : "A week of small wins"

    const firstName = userName?.trim() ? userName.trim().split(" ")[0] : ""

    return { tasksDone, habitsDone, focusHours, sessions, bestStreak, xp, headline, firstName }
  }, [tasks, habits, focusLog, userName])

  return (
    <Card className="relative overflow-hidden border-primary/25">
      {/* Soft glow */}
      <div className="pointer-events-none absolute -top-10 -right-10 size-40 rounded-full bg-primary/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-8 size-36 rounded-full bg-focus/10 blur-2xl" />

      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            <CalendarDays className="size-3.5 text-primary" />
            Weekly wrap · last 7 days
          </p>
          <h2 className="mt-1.5 flex flex-wrap items-center gap-2 text-lg font-bold text-foreground">
            <PartyPopper className="size-5 shrink-0 text-primary" />
            {wrap.headline}
            {wrap.firstName ? `, ${wrap.firstName}!` : "!"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {nudge(wrap.tasksDone, wrap.habitsDone, wrap.focusHours, wrap.sessions, wrap.bestStreak)}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-center gap-0.5 rounded-xl bg-primary/10 px-4 py-2.5">
          <span className="text-2xl font-bold text-primary tabular-nums">{wrap.xp}</span>
          <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
            XP this week
          </span>
        </div>
      </div>

      {/* Week stats */}
      <div className="relative mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Tasks done" value={String(wrap.tasksDone)} />
        <Stat label="Habits active" value={String(wrap.habitsDone)} />
        <Stat label="Focus" value={`${wrap.focusHours} hrs`} />
        <Stat label="Focus sessions" value={String(wrap.sessions)} />
      </div>
      <p className="relative mt-3 text-xs text-muted-foreground">
        {wrap.tasksDone} task{wrap.tasksDone === 1 ? "" : "s"} · {wrap.habitsDone} habit{wrap.habitsDone === 1 ? "" : "s"} · {wrap.focusHours} hrs of focus — logged from your real completions this week.
      </p>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary/40 px-3 py-2.5">
      <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">{label}</p>
      <p className="mt-0.5 text-lg font-bold text-foreground tabular-nums">{value}</p>
    </div>
  )
}
