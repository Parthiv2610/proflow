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
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{greeting()}{userName ? `, ${userName.split(" ")[0]}` : ""}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{formatDateLong()}</p>
      </div>

      {/* Quick stats row */}
      <div className="stagger grid grid-cols-3 gap-3">
        <Card className="py-3 px-4">
          <p className="text-xs text-muted-foreground">Tasks</p>
          <AnimatedNumber value={tasksToday} className="text-2xl font-bold" suffix=" " /><span className="text-sm font-normal text-muted-foreground">done</span>
        </Card>
        <Card className="py-3 px-4">
          <p className="text-xs text-muted-foreground">Habits</p>
          <AnimatedNumber value={habitsToday} className="text-2xl font-bold" suffix=" " /><span className="text-sm font-normal text-muted-foreground">done</span>
        </Card>
        <Card className="py-3 px-4">
          <p className="text-xs text-muted-foreground">Focus</p>
          <AnimatedNumber value={focusMinutesToday} className="text-2xl font-bold" suffix=" " /><span className="text-sm font-normal text-muted-foreground">min</span>
        </Card>
      </div>

      {/* Streak + Completion */}
      <div className="stagger grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="px-4 py-3">
          <p className="text-xs text-muted-foreground">Habit Streak</p>
          <div className="mt-1 flex items-baseline gap-1.5">
            <AnimatedNumber value={bestStreak} className="text-3xl font-bold" />
            <span className="text-sm text-muted-foreground">days</span>
            {streakShields > 0 && (
              <span className="ml-auto flex items-center gap-1 text-xs text-focus">
                <Shield className="size-3" /> {streakShields}
              </span>
            )}
          </div>
          <div className="mt-2">
            <StreakCalendar habit={bestHabit} className="rounded-lg bg-secondary/30 p-2" />
          </div>
        </Card>

        <Card className="px-4 py-3">
          <p className="text-xs text-muted-foreground">Tasks Done</p>
          <div className="mt-1 flex items-baseline gap-1.5">
            <AnimatedNumber value={pct} className="text-3xl font-bold" suffix="%" />
            <span className="text-sm text-muted-foreground">{done}/{total}</span>
          </div>
          <div className="mt-3">
            <ProgressBar value={pct} />
          </div>
          {overdue.length > 0 && (
            <button type="button" onClick={() => setView("tasks")} className="mt-3 flex items-center gap-1 text-xs font-medium text-danger">
              {overdue.length} overdue <ArrowRight className="size-3" />
            </button>
          )}
        </Card>
      </div>

      {/* Focus + Goals + Upcoming */}
      <div className="stagger grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="px-4 py-3">
          <p className="text-xs text-muted-foreground">Focus This Week</p>
          <p className="mt-1"><AnimatedNumber value={weekFocusHours} className="text-2xl font-bold" suffix=" " /><span className="text-sm font-normal text-muted-foreground">hrs</span></p>
        </Card>

        <Card className="px-4 py-3">
          <p className="text-xs text-muted-foreground">Goals</p>
          <div className="mt-1 flex items-center gap-3">
            <AnimatedNumber value={goalAvg} className="text-2xl font-bold" suffix="%" />
            <CircularProgress value={goalAvg} size={40} stroke={5} tone="var(--success)">
              <span className="text-[10px] font-bold">{goalAvg}</span>
            </CircularProgress>
          </div>
        </Card>

        <Card className="px-4 py-3">
          <p className="text-xs text-muted-foreground">Upcoming</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{events.filter((e) => e.date >= today).length}</p>
          <button type="button" onClick={() => setView("calendar")} className="mt-1 flex items-center gap-1 text-xs text-primary">
            View calendar <ArrowRight className="size-3" />
          </button>
        </Card>
      </div>

      {/* Habits list */}
      {habits.length > 0 && (
        <Card className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted-foreground">Today&apos;s Habits</p>
            <button type="button" onClick={() => setView("habits")} className="text-xs text-primary">Manage</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {habits.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => toggleHabit(h.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors",
                  h.doneToday ? "bg-success/10 text-success line-through" : "bg-secondary text-foreground hover:bg-secondary/80",
                )}
              >
                {h.doneToday ? "✓" : "○"} {h.name}
                {h.streak > 0 && <span className="text-xs text-muted-foreground">{h.streak}d</span>}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Recent notes */}
      {notes.length > 0 && (
        <Card className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted-foreground">Recent Notes</p>
            <button type="button" onClick={() => setView("notes")} className="text-xs text-primary">Open</button>
          </div>
          <div className="flex flex-col gap-1">
            {notes.slice(0, 3).map((n) => (
              <p key={n.id} className="truncate text-sm text-muted-foreground">{n.title}</p>
            ))}
          </div>
        </Card>
      )}

      <FocusChart />
    </div>
  )
}
