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
  Target,
  TrendingUp,
  TriangleAlert,
  Zap,
} from "lucide-react"
import { cn, timeAgo } from "@/lib/utils"
import { DragSortContainer, DragSortItem } from "../drag-sort"
import { FocusChart } from "../focus-chart"
import { EncouragementCard } from "../encouragement"
import { WeeklyWrap } from "../weekly-wrap"
import { TaskRow } from "../task-row"
import { useStore, MAX_SHIELDS, type EventItem, type View } from "../store"
import { Card, CircularProgress, ProgressBar } from "../ui"

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

function momentumLabel(score: number) {
  if (score >= 100) return "On fire! 🔥"
  if (score >= 75) return "On a roll"
  if (score >= 50) return "In the flow"
  if (score >= 25) return "Getting going"
  if (score > 0) return "Warming up"
  return "Ready to start"
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
  const { tasks, habits, goals, events, notes, setView, cycleTaskStatus, deleteTask, reorderTasks, toggleHabit, userName, lanInfo, lanAuthed, lanOnline, lastSyncedAt, focusLog, streakShields } = useStore()

  const syncIndicator = useMemo(() => {
    const active =
      (lanInfo?.mode === "electron" && lanInfo.enabled) || (lanInfo?.mode === "phone" && lanAuthed)
    if (!active) return { text: "Local only", dot: "bg-muted" }
    if (lanInfo?.mode === "phone" && !lanOnline) return { text: "Laptop offline", dot: "bg-warning" }
    return { text: `Synced ${timeAgo(lastSyncedAt)}`, dot: "bg-success" }
  }, [lanInfo, lanAuthed, lanOnline, lastSyncedAt])

  const done = tasks.filter((t) => t.status === "done").length
  const total = tasks.length
  const pct = total ? Math.round((done / total) * 100) : 0
  const overdue = tasks.filter((t) => t.overdue && t.status !== "done")
  const activeTasks = tasks.filter((t) => t.status !== "done").slice(0, 6)
  const activeIds = activeTasks.map((t) => t.id)

  const handleDashboardReorder = useCallback(
    (ids: string[]) => {
      reorderTasks(ids)
    },
    [reorderTasks],
  )
  const habitsToday = habits.filter((h) => h.doneToday).length
  const goalAvg = goals.length ? Math.round(goals.reduce((s, g) => s + g.progress, 0) / goals.length) : 0

  // Momentum meter — today's completions as a 0-100 energy bar, weighted exactly
  // like the XP economy (task +10, habit +5, focus session +25) so it doubles as
  // "today's XP in percentage form". Computed inline (not memoized): the live
  // clock below re-renders every second anyway, and that keeps it accurate the
  // moment the day rolls over, even if the app has been open past midnight.
  const tasksToday = tasks.filter((t) => t.status === "done" && t.completedAt === todayStr()).length
  const focusToday = focusLog.find((e) => e.date === todayStr())?.sessions ?? 0
  const momentumScore = Math.min(100, tasksToday * 10 + habitsToday * 5 + focusToday * 25)

  // 7-day Momentum strip — per-day scores for the last week. Past days use the
  // date-stamped sources (task completions + focus sessions); habit check-ins
  // are only stored for today, so today's bar also includes them to match the
  // meter above.
  const weekMomentum = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    const done = tasks.filter((t) => t.status === "done" && t.completedAt === key).length
    const sess = focusLog.find((e) => e.date === key)?.sessions ?? 0
    let score = done * 10 + sess * 25
    if (i === 6) score += habitsToday * 5
    return {
      key,
      score,
      isToday: i === 6,
      label: d.toLocaleDateString("en-US", { weekday: "narrow" }),
    }
  })
  const weekMax = Math.max(100, ...weekMomentum.map((d) => d.score))
  const onTrack = goals.filter((g) => g.status === "on-track").length
  const atRisk = goals.filter((g) => g.status === "at-risk").length

  // Real deep-work hours: sum of completed focus sessions over the last 7 days
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
            {formatDateLong()} · <span className="tabular-nums text-foreground/80">{formatTime12(now)}</span> · {tasks.filter((t) => t.status !== "done").length} tasks due today ·{" "}
            <span className="text-danger">{overdue.length} overdue</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setView("settings")}
          className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          title="Sync settings"
        >
          {syncIndicator.text}
          <span className={cn("size-2 rounded-full", syncIndicator.dot)} />
        </button>
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

          {/* Momentum meter — a little energy bar that fills as you get things done today */}
          <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both" style={{ animationDelay: "50ms" }}>
            <Card className="relative overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Zap className="size-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Momentum</p>
                    <span className="text-sm font-bold text-primary">{momentumLabel(momentumScore)}</span>
                  </div>
                  <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${momentumScore}%`,
                        background: "linear-gradient(90deg, var(--primary), var(--focus), var(--success))",
                      }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {tasksToday} task{tasksToday === 1 ? "" : "s"} · {habitsToday} habit{habitsToday === 1 ? "" : "s"} ·{" "}
                    {focusToday} focus session{focusToday === 1 ? "" : "s"} today
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold tracking-tight tabular-nums">{momentumScore}%</p>
                  <p className="text-xs text-muted-foreground">of daily momentum</p>
                </div>
              </div>

              {/* 7-day momentum strip — your energy trend week over week */}
              <div className="mt-4 border-t border-border/50 pt-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">7-day trend</p>
                  <p className="text-[10px] text-muted-foreground">tasks + focus · habits today only</p>
                </div>
                <div className="mt-2 flex items-end gap-1.5">
                  {weekMomentum.map((d) => (
                    <div key={d.key} className="flex flex-1 flex-col items-center gap-1">
                      <div className="flex h-9 w-full items-end">
                        <div
                          title={`${d.key}: ${d.score}%`}
                          className={cn(
                            "w-full rounded-md transition-all duration-500",
                            d.score > 0 ? "bg-focus/50" : "bg-muted/60",
                          )}
                          style={{
                            height: `${Math.max(d.score > 0 ? 8 : 3, Math.round((d.score / weekMax) * 36))}px`,
                            ...(d.isToday
                              ? { background: "linear-gradient(to top, var(--primary), var(--focus))" }
                              : {}),
                          }}
                        />
                      </div>
                      <span
                        className={cn(
                          "text-[10px]",
                          d.isToday ? "font-semibold text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {d.label}
                      </span>
                    </div>
                  ))}
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

            {/* Habit Streak */}
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both" style={{ animationDelay: "100ms" }}>
            <Card className="transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
              <div className="flex items-start justify-between">
                <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Habit Streak</p>
                <span className="flex size-9 items-center justify-center rounded-lg bg-focus/15 text-focus">
                  <Flame className="size-4.5" />
                </span>
              </div>
              <div className="mt-3 flex items-end gap-2">
                <span className="text-5xl font-bold tracking-tight">{Math.max(...habits.map((h) => h.streak), 0)}</span>
                <span className="mb-1.5 text-sm text-muted-foreground">days</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  Best: {Math.max(...habits.map((h) => h.streak), 0)} days · {habitsToday}/{habits.length} habits today
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
              <div className="mt-4 flex items-center justify-between gap-1">
                {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                    <span className={cn("h-6 w-full rounded-md", i < Math.min(Math.max(...habits.map((h) => h.streak), 0), 7) ? "bg-focus" : "bg-muted")} />
                    <span className="text-[10px] text-muted-foreground">{d}</span>
                  </div>
                ))}
              </div>
            </Card>
            </div>

            {/* Deep Work */}
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both" style={{ animationDelay: "200ms" }}>
            <Card className="transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
              <div className="flex items-start justify-between">
                <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Deep Work</p>
                <span className="flex size-9 items-center justify-center rounded-lg bg-info/15 text-info">
                  <Clock className="size-4.5" />
                </span>
              </div>
              <div className="mt-3 flex items-end gap-2">
                <span className="text-5xl font-bold tracking-tight">{weekFocusHours}</span>
                <span className="mb-1.5 text-sm text-muted-foreground">hrs</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">Last 7 days · logged from completed focus sessions</p>
              <p className="mt-4 text-xs text-muted-foreground">
                {weekFocusHours > 0 ? `${weekFocusHours} hrs of deep work this week` : "Complete a focus session to start tracking"}
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
                  <p className="mt-2 flex items-center gap-1 text-sm font-medium text-success">
                    <TrendingUp className="size-4" /> {onTrack} on track · {atRisk} at risk
                  </p>
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

          <Card>
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">Today&apos;s Tasks</h2>
                <p className="text-sm text-muted-foreground">
                  {tasks.filter((t) => t.status !== "done").length} active · delete or complete inline
                </p>
              </div>
              <button
                type="button"
                onClick={() => setView("tasks")}
                className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                View all <ArrowRight className="size-3.5" />
              </button>
            </div>
            <div className="mt-4">
              {activeTasks.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No active tasks — you&apos;re all caught up!</p>
              ) : (
                <DragSortContainer ids={activeIds} onReorder={handleDashboardReorder} className="flex flex-col gap-2">
                  {activeTasks.map((t) => (
                    <DragSortItem key={t.id} id={t.id}>
                      <TaskRow
                        task={t}
                        dragHandle
                        onToggle={() => cycleTaskStatus(t.id)}
                        onDelete={() => deleteTask(t.id)}
                      />
                    </DragSortItem>
                  ))}
                </DragSortContainer>
              )}
            </div>
          </Card>
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
                  <span className="text-xs text-muted-foreground">{h.streak}d</span>
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
                  ? "Deep work logged automatically when you complete a focus session."
                  : "No focus sessions yet — start the Focus Timer to build this week's total."}
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
              <div className="flex items-center justify-between">
                <p className="font-semibold">{g.name}</p>
                <span
                  className={cn(
                    "rounded-md px-2 py-0.5 text-xs font-medium",
                    g.status === "on-track" ? "bg-success/15 text-success" : "bg-danger/15 text-danger",
                  )}
                >
                  {g.status === "on-track" ? "On track" : "At risk"}
                </span>
              </div>
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
  const sorted = useMemo(() => [...events].filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date)), [events, today])
  const nextEvent = sorted[0]
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
        <span className="text-5xl font-bold tracking-tight">{events.length}</span>
        <span className="mb-1.5 text-sm text-muted-foreground">events</span>
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
