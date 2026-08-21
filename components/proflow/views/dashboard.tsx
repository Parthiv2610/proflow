"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import {
  ArrowRight,
  Calendar,
  Clock,
  Flame,
  Gauge,
  LayoutDashboard,
  Shield,
  SquareCheckBig,
  Sun,
  Target,
  TrendingUp,
  TriangleAlert,
} from "lucide-react"
import { cn } from "@/lib/utils"

import { FocusChart } from "../focus-chart"
import { EncouragementCard } from "../encouragement"
import { StreakCalendar } from "../streak-calendar"
import { WeeklyWrap } from "../weekly-wrap"

import { useStore, MAX_SHIELDS, type EventItem, type View } from "../store"
import { Card, CircularProgress, ProgressBar } from "../ui"

// Monday-first day letters for the habit schedule strip (matches Habit.week[]).

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

function formatTimeShort(h: number, m: number) {
  const ampm = h < 12 ? "AM" : "PM"
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`
}

const tabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "focus", label: "Focus & Habits", icon: Flame },
  { id: "goals", label: "Goals", icon: Target },
  { id: "notes", label: "Recent Notes", icon: Calendar },
] as const

type Tab = (typeof tabs)[number]["id"]

export function Dashboard() {
  const [tab, setTab] = useState<Tab>("overview")

  // Live clock
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  function formatTime12(date: Date) {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  }
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
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-balance">{greeting()}{userName ? `, ${userName.split(" ")[0]}` : ""}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDateLong()} · <span className="tabular-nums text-foreground/80">{formatTime12(now)}</span> · {tasks.length} tasks due today ·{" "}
            <span className="text-danger">{overdue.length} overdue</span>
          </p>
        </div>

      </div>

      <div className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1">
        {tabs.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                tab === t.id ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === "overview" && (
        <>
          <EncouragementCard />

          {/* Today at a glance — a simple count of what's been done today */}
          <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both" style={{ animationDelay: "50ms" }}>
            <Card className="transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
              <div className="flex items-start justify-between">
                <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Today at a glance
                </p>
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Sun className="size-4.5" />
                </span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div>
                  <p className="text-3xl font-bold tracking-tight tabular-nums">{tasksToday}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    task{tasksToday === 1 ? "" : "s"} done
                  </p>
                </div>
                <div>
                  <p className="text-3xl font-bold tracking-tight tabular-nums">{habitsToday}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    habit{habitsToday === 1 ? "" : "s"} done
                  </p>
                </div>
                <div>
                  <p className="text-3xl font-bold tracking-tight tabular-nums">{focusMinutesToday}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    min focused{focusSessionsToday > 0 ? ` · ${focusSessionsToday} session${focusSessionsToday === 1 ? "" : "s"}` : ""}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {/* Today's Completion */}
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both" style={{ animationDelay: "0ms" }}>
            <Card className="md:col-span-2 xl:col-span-1 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
              <div className="flex items-start justify-between">
                <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Today&apos;s Completion
                </p>
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <SquareCheckBig className="size-4.5" />
                </span>
              </div>
              <div className="mt-3 flex items-end gap-2">
                <span className="text-5xl font-bold tracking-tight">{pct}%</span>
                <span className="mb-1.5 text-sm text-muted-foreground">
                  {done}/{total}
                </span>
              </div>
              <p className="mt-2 flex items-center gap-1 text-sm font-medium text-success">
                <TrendingUp className="size-4" /> {done}/{total} tasks done
              </p>
              <div className="mt-4">
                <ProgressBar value={pct} />
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>{done} done</span>
                  <span>{total - done} remaining</span>
                </div>
              </div>
            </Card>
            </div>

            {/* Habit Streak Calendar */}
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both" style={{ animationDelay: "100ms" }}>
            <Card className="transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
              <div className="flex items-start justify-between">
                <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Habit Streak</p>
                <span className="flex size-9 items-center justify-center rounded-lg bg-focus/15 text-focus">
                  <Flame className="size-4.5" />
                </span>
              </div>
              <div className="mt-3 flex items-end gap-2">
                <span className="text-5xl font-bold tracking-tight">{bestStreak}</span>
                <span className="mb-1.5 text-sm text-muted-foreground">days</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  {habits.length === 0
                    ? "No habits yet — add one in Habits & Goals."
                    : `Best: ${bestStreak} days · ${habitsToday}/${habits.length} habits today`}
                </p>
                <span
                  className="flex items-center gap-1.5 rounded-lg bg-focus/10 px-2 py-1 text-focus"
                  title={`Streak shields: keeps your streak alive if you miss a scheduled day. Buy more in Habits & Goals.`}
                >
                  <Shield className="size-3.5" />
                  <span className="text-xs font-semibold tabular-nums">
                    {streakShields}/{MAX_SHIELDS}
                  </span>
                </span>
              </div>
              <div className="mt-4">
                <StreakCalendar habit={bestHabit} className="rounded-xl bg-secondary/30 p-3" />
              </div>
            </Card>
            </div>

            {/* Focus */}
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both" style={{ animationDelay: "200ms" }}>
            <Card className="transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
              <div className="flex items-start justify-between">
                <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Focus</p>
                <span className="flex size-9 items-center justify-center rounded-lg bg-info/15 text-info">
                  <Clock className="size-4.5" />
                </span>
              </div>
              <div className="mt-3 flex items-end gap-2">
                <span className="text-5xl font-bold tracking-tight">{weekFocusHours}</span>
                <span className="mb-1.5 text-sm text-muted-foreground">hrs</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">Last 7 days</p>
              <p className="mt-4 text-xs text-muted-foreground">
                {weekFocusHours > 0 ? `${weekFocusHours} hrs of focus this week` : "Complete a focus session to start tracking"}
              </p>
            </Card>
            </div>

            {/* Overdue Tasks */}
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both" style={{ animationDelay: "300ms" }}>
            <Card className="border-danger/30 bg-danger/[0.06] md:col-span-2 xl:col-span-1 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
              <div className="flex gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-danger/15 text-danger">
                  <TriangleAlert className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-danger">{overdue.length} Overdue Tasks</p>
                    <button
                      type="button"
                      onClick={() => setView("tasks")}
                      className="flex items-center gap-1 text-sm font-medium text-danger hover:underline"
                    >
                      Review <ArrowRight className="size-3.5" />
                    </button>
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {overdue.length ? overdue.map((t) => `"${t.title}"`).join(", ") : "All caught up!"}
                  </p>
                  {overdue.length > 0 && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      <span className="font-medium text-danger">Needs attention</span>
                    </p>
                  )}
                </div>
              </div>
            </Card>
            </div>

            {/* Goal Progress */}
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both" style={{ animationDelay: "400ms" }}>
            <Card className="transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
              <div className="flex items-start justify-between">
                <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Goal Progress</p>
                <span className="flex size-9 items-center justify-center rounded-lg bg-success/15 text-success">
                  <Target className="size-4.5" />
                </span>
              </div>
              <div className="mt-3 flex items-center gap-4">
                <div>
                  <div className="flex items-end gap-1">
                    <span className="text-5xl font-bold tracking-tight">{goalAvg}</span>
                    <span className="mb-1.5 text-sm text-muted-foreground">%</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">Avg across {goals.length} active goals</p>

                </div>
                <div className="ml-auto">
                  <CircularProgress value={goalAvg} tone="var(--success)">
                    <span className="text-sm font-bold">{goalAvg}%</span>
                  </CircularProgress>
                </div>
              </div>
            </Card>
            </div>

            {/* Upcoming */}
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both" style={{ animationDelay: "500ms" }}>
            <UpcomingCard events={events} setView={setView} />
            </div>
          </div>

          <FocusChart />

        </>
      )}

      {tab === "focus" && (
        <>
          <WeeklyWrap />
          <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="text-lg font-semibold">Today&apos;s Habits</h2>
            <p className="text-sm text-muted-foreground">{habitsToday} of {habits.length} completed</p>
            <div className="mt-4 flex flex-col gap-2">
              {habits.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => toggleHabit(h.id)}
                  className="flex w-full items-center justify-between rounded-xl bg-secondary/40 px-3 py-2.5 text-left transition-colors hover:bg-secondary/60"
                >
                  <span className="flex items-center gap-2 text-sm">
                    <Flame className={cn("size-4", h.doneToday ? "text-focus" : "text-muted-foreground")} />
                    {h.name}
                  </span>
                  <span className="flex items-center gap-2">
                    {(h.shields ?? 0) > 0 && (
                      <span
                        title={`${h.shields} mini shield${(h.shields ?? 0) > 1 ? "s" : ""} on this habit — protects this streak if you miss a day`}
                        className="flex size-5 items-center justify-center rounded-md bg-focus/10 text-focus"
                      >
                        <Shield className="size-3" />
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">{h.streak}d</span>
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setView("habits")}
              className="mt-4 flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Manage habits <ArrowRight className="size-3.5" />
            </button>
          </Card>
          <div className="flex flex-col gap-4">
            <Card>
              <div className="flex items-center gap-3">
                <Gauge className="size-5 text-info" />
                <div>
                  <p className="text-sm text-muted-foreground">Focus this week</p>
                  <p className="text-2xl font-bold">{weekFocusHours} hrs</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {weekFocusHours > 0
                  ? "Logged automatically when sessions complete."
                  : "No focus sessions yet."}
              </p>
            </Card>
            <FocusChart />
          </div>
        </div>
        </>
      )}

      {tab === "goals" && (
        <div className="grid gap-4 sm:grid-cols-2">
          {goals.map((g) => (
            <Card key={g.id}>
              <p className="font-semibold">{g.name}</p>
              <div className="mt-4 flex items-center gap-4">
                <CircularProgress
                  value={g.progress}
                  size={64}
                  stroke={7}
                  tone={g.status === "on-track" ? "var(--success)" : "var(--danger)"}
                >
                  <span className="text-xs font-bold">{g.progress}%</span>
                </CircularProgress>
                <ProgressBar value={g.progress} tone={g.status === "on-track" ? "success" : "danger"} />
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "notes" && (
        <div className="grid gap-4 sm:grid-cols-2">
          {notes.slice(0, 4).map((n) => (
            <Card key={n.id}>
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">{n.tag}</span>
                <span className="text-xs text-muted-foreground">{n.updated}</span>
              </div>
              <h3 className="mt-3 font-semibold">{n.title}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{n.body}</p>
            </Card>
          ))}
          <button
            type="button"
            onClick={() => setView("notes")}
            className="flex items-center justify-center gap-1 rounded-2xl border border-dashed border-border text-sm font-medium text-primary hover:bg-card"
          >
            Open Notes & Docs <ArrowRight className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}

// ── UpcomingCard ─────────────────────────────────────────
function UpcomingCard({ events, setView }: { events: EventItem[]; setView: (v: View) => void }) {
  const today = todayStr()
  const todayEvents = useMemo(() => events.filter((e) => e.date === today), [events, today])
  // Only events from today onward are "upcoming" — past/completed events must
  // not inflate the count (the count and the "Next" line share this filter so
  // they can never disagree).
  const upcoming = useMemo(
    () => [...events].filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date)),
    [events, today],
  )
  const nextEvent = upcoming[0]
  const blocksToday = todayEvents.filter((e) => e.hasBlock).length

  return (
    <Card>
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Upcoming</p>
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Calendar className="size-4.5" />
        </span>
      </div>
      <div className="mt-3 flex items-end gap-2">
        <span className="text-5xl font-bold tracking-tight">{upcoming.length}</span>
        <span className="mb-1.5 text-sm text-muted-foreground">upcoming</span>
      </div>
      {nextEvent ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Next: {nextEvent.title}
          {nextEvent.hasBlock ? ` at ${formatTimeShort(nextEvent.startHour, nextEvent.startMin)}` : ""}
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">No upcoming events</p>
      )}
      <button
        type="button"
        onClick={() => setView("calendar")}
        className="mt-3 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <span className="size-2 rounded-full bg-primary" />
        {todayEvents.length > 0 ? `Today · ${blocksToday} with time blocks` : "No events today"}
      </button>
    </Card>
  )
}
