"use client"

import { useMemo } from "react"
import {
  ArrowRight,
  Shield,
} from "lucide-react"
import { cn } from "@/lib/utils"

import { FocusChart } from "../focus-chart"
import { StreakCalendar } from "../streak-calendar"

import { useStore } from "../store"
import { Card, CircularProgress, ProgressBar } from "../ui"
import { AnimatedNumber } from "../animated-number"

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return "Good morning"
  if (h < 18) return "Good afternoon"
  return "Good evening"
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function formatDateLong() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
}

export function Dashboard() {
  const { tasks, completedTasks, habits, goals, events, notes, setView, toggleHabit, userName, focusLog, recurringLog, streakShields } = useStore()

  const done = completedTasks.length
  const total = tasks.length + done
  const pct = total ? Math.round((done / total) * 100) : 0
  const overdue = tasks.filter((t) => t.overdue)
  const habitsToday = habits.filter((h) => h.doneToday).length

  // Today at a glance — simple counts of what's been done today. Tasks count
  // date-stamped completions from completedTasks (including recurring rollovers);
  // habits only store "done today", and focus comes from today's session log.
  const today = todayStr()
  const tasksToday =
    completedTasks.filter((t) => t.completedAt === today).length +
    recurringLog.filter((d) => d === today).length
  const focusToday = focusLog.find((e) => e.date === today)
  const focusSessionsToday = focusToday?.sessions ?? 0
  const focusMinutesToday = focusToday?.minutes ?? 0

  // The Habit Streak card leads with the strongest habit. Its week strip shows
  // that habit's real weekly schedule (from its week[] array) — NOT a bar per
  // streak day, which used to fake a Mon→Sun pattern regardless of the
  // schedule or the actual days done.
  const bestHabit = habits.length ? habits.reduce((a, b) => (b.streak > a.streak ? b : a)) : null
  const bestStreak = bestHabit?.streak ?? 0
  const goalAvg = goals.length ? Math.round(goals.reduce((s, g) => s + g.progress, 0) / goals.length) : 0

  // Real focus hours: sum of completed focus sessions over the last 7 days
  // (including today). Starts at 0 on a fresh install.
  const weekFocusHours = useMemo(() => {
    const now = new Date()
    let minutes = 0
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      const entry = focusLog.find((e) => e.date === key)
      if (entry) minutes += entry.minutes
    }
    return Math.round((minutes / 60) * 10) / 10
  }, [focusLog])

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 p-6">
      {/* Hero header with gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6">
        <div className="absolute -top-12 -right-12 size-32 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-8 -left-8 size-24 rounded-full bg-focus/5 blur-2xl" />
        <div className="relative">
          <h1 className="text-2xl font-bold tracking-tight">{greeting()}{userName ? `, ${userName.split(" ")[0]}` : ""}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{formatDateLong()}</p>
        </div>
      </div>

      {/* Quick stats row — each with a colored left accent */}
      <div className="stagger grid grid-cols-3 gap-3">
        <div className="group rounded-2xl border border-border bg-card p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99]">
          <div className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-primary" />
            <p className="text-xs text-muted-foreground">Tasks</p>
          </div>
          <div className="mt-2">
            <AnimatedNumber value={tasksToday} className="text-3xl font-bold text-primary" suffix=" " /><span className="text-sm text-muted-foreground">done</span>
          </div>
        </div>
        <div className="group rounded-2xl border border-border bg-card p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99]">
          <div className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-focus" />
            <p className="text-xs text-muted-foreground">Habits</p>
          </div>
          <div className="mt-2">
            <AnimatedNumber value={habitsToday} className="text-3xl font-bold text-focus" suffix=" " /><span className="text-sm text-muted-foreground">done</span>
          </div>
        </div>
        <div className="group rounded-2xl border border-border bg-card p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99]">
          <div className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-info" />
            <p className="text-xs text-muted-foreground">Focus</p>
          </div>
          <div className="mt-2">
            <AnimatedNumber value={focusMinutesToday} className="text-3xl font-bold text-info" suffix=" " /><span className="text-sm text-muted-foreground">min</span>
          </div>
        </div>
      </div>

      {/* Streak + Completion */}
      <div className="stagger grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="px-5 py-4 border-focus/20 bg-gradient-to-br from-focus/5 to-transparent">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-focus/15 text-focus">
              <Shield className="size-3.5" />
            </span>
            <p className="text-sm font-medium text-foreground">Habit Streak</p>
            {streakShields > 0 && (
              <span className="ml-auto flex items-center gap-1 rounded-full bg-focus/10 px-2 py-0.5 text-xs font-medium text-focus">
                🛡 {streakShields}
              </span>
            )}
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <AnimatedNumber value={bestStreak} className="text-4xl font-bold text-focus" />
            <span className="text-sm text-muted-foreground">day streak</span>
          </div>
          <div className="mt-3">
            <StreakCalendar habit={bestHabit} className="rounded-xl bg-background/60 p-2" />
          </div>
        </Card>

        <Card className="px-5 py-4 border-success/20 bg-gradient-to-br from-success/5 to-transparent">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-success/15 text-success">
              <ArrowRight className="size-3.5 rotate-[-45deg]" />
            </span>
            <p className="text-sm font-medium text-foreground">Tasks Done</p>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <AnimatedNumber value={pct} className="text-4xl font-bold text-success" suffix="%" />
            <span className="text-sm text-muted-foreground">{done}/{total}</span>
          </div>
          <div className="mt-3">
            <ProgressBar value={pct} tone="success" />
          </div>
          {overdue.length > 0 && (
            <button type="button" onClick={() => setView("tasks")} className="mt-3 flex items-center gap-1 text-xs font-medium text-danger hover:underline">
              ⚠ {overdue.length} overdue — review <ArrowRight className="size-3" />
            </button>
          )}
        </Card>
      </div>

      {/* Focus + Goals + Upcoming */}
      <div className="stagger grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
          <div className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-info" />
            <p className="text-xs text-muted-foreground">Focus This Week</p>
          </div>
          <div className="mt-2">
            <AnimatedNumber value={weekFocusHours} className="text-3xl font-bold text-info" suffix=" " /><span className="text-sm text-muted-foreground">hrs</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
          <div className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-success" />
            <p className="text-xs text-muted-foreground">Goals</p>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <AnimatedNumber value={goalAvg} className="text-3xl font-bold" suffix="%" />
            <CircularProgress value={goalAvg} size={44} stroke={5} tone="var(--success)">
              <span className="text-[10px] font-bold">{goalAvg}</span>
            </CircularProgress>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
          <div className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-primary" />
            <p className="text-xs text-muted-foreground">Upcoming</p>
          </div>
          <div className="mt-2">
            <AnimatedNumber value={events.filter((e) => e.date >= today).length} className="text-3xl font-bold" />
          </div>
          <button type="button" onClick={() => setView("calendar")} className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline">
            View calendar <ArrowRight className="size-3" />
          </button>
        </div>
      </div>

      {/* Habits list */}
      {habits.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-foreground">Today&apos;s Habits</p>
            <button type="button" onClick={() => setView("habits")} className="text-xs text-primary hover:underline">Manage</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {habits.map((h) => {
              const streakColor = h.streak >= 7 ? "bg-success/15 text-success border-success/20"
                : h.streak >= 3 ? "bg-focus/15 text-focus border-focus/20"
                : "bg-secondary border-border"
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => toggleHabit(h.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm transition-all duration-200",
                    h.doneToday
                      ? "bg-success/15 text-success border-success/20 line-through"
                      : streakColor,
                    "hover:scale-[1.03] active:scale-[0.97]",
                  )}
                >
                  <span className="transition-transform duration-200">{h.doneToday ? "✓" : "○"}</span>
                  <span className="font-medium">{h.name}</span>
                  {h.streak > 0 && <span className="text-xs opacity-70">{h.streak}d</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent notes */}
      {notes.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-foreground">Recent Notes</p>
            <button type="button" onClick={() => setView("notes")} className="text-xs text-primary hover:underline">Open</button>
          </div>
          <div className="flex flex-col gap-1.5">
            {notes.slice(0, 3).map((n) => (
              <div key={n.id} className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-secondary/50">
                <span className="text-primary/60">📄</span>
                <p className="truncate text-sm text-muted-foreground">{n.title}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <FocusChart />
    </div>
  )
}
