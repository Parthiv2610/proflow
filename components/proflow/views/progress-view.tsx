"use client"

import { useMemo, useState } from "react"
import {
  Activity,
  BarChart3,
  CalendarDays,
  Flame,
  Layers,
  ListTodo,
  PieChart,
  Repeat,
  Timer,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  ACHIEVEMENTS,
  FREE_SHIELD_EVERY_LEVELS,
  levelFor,
  levelName,
  nextShieldMilestone,
  xpForLevel,
  xpForNextLevel,
  xpIntoLevel,
  useStore,
  type Achievement,
  type CompletedTask,
  type FocusLogEntry,
  type Task,
} from "../store"
import { Card, PageHeader, ProgressBar } from "../ui"

/**
 * Progress — the achievement cabinet: level curve + XP, all badges (earned and
 * locked with progress), this week's activity, and a GitHub-style streak calendar
 * built from real focus sessions and task completions.
 */
export function ProgressView() {
  const { xp, achievements, bestStreak, totalTasksDone, focusLog, tasks, completedTasks, recurringLog, habits, weeklyFocusGoal } = useStore()

  const level = levelFor(xp)
  const into = xpIntoLevel(xp)
  const need = xpForNextLevel(level)
  const levelPct = need > 0 ? Math.round((into / need) * 100) : 100

  // ── This week's stats (all real data, Monday–Sunday) ─────────
  const stats = useMemo(() => {
    const earned = ACHIEVEMENTS.filter((a) => achievements[a.id]).length
    return { earned }
  }, [achievements])

  const week = useMemo(() => {
    // Monday of the current week (the app's weeks start Monday).
    const now = new Date()
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
    const key = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    const mondayKey = key(monday)

    // Tasks completed within this week ("YYYY-MM-DD" compares lexicographically),
    // including recurring-task occurrences from the completion log.
    const tasksDone =
      completedTasks.filter((t) => !!t.completedAt && t.completedAt >= mondayKey)
        .length + recurringLog.filter((d) => d >= mondayKey).length

    // Focus sessions & minutes this week, plus distinct active days.
    let sessions = 0
    let minutes = 0
    const activeDays = new Set<string>()
    focusLog.forEach((e) => {
      if (e.date >= mondayKey) {
        sessions += e.sessions
        minutes += e.minutes
        if (e.sessions > 0) activeDays.add(e.date)
      }
    })
    completedTasks.forEach((t) => {
      if (t.completedAt && t.completedAt >= mondayKey) activeDays.add(t.completedAt)
    })
    recurringLog.forEach((d) => {
      if (d >= mondayKey) activeDays.add(d)
    })

    return {
      tasksDone,
      sessions,
      minutes,
      hours: Math.round((minutes / 60) * 10) / 10,
      activeDays: activeDays.size,
    }
  }, [completedTasks, focusLog, recurringLog])

  // ── Level curve: cumulative XP per level, with current marker ──
  const curve = useMemo(() => {
    const top = Math.max(level + 4, 10) // chart a few levels ahead
    const pts = Array.from({ length: top }, (_, i) => {
      const lvl = i + 1
      return { lvl, xp: xpForLevel(lvl) }
    })
    const maxXp = Math.max(xpForLevel(top), xp, 100)
    const W = 100
    const H = 40
    const toXY = (lvl: number, xpVal: number) => ({
      x: ((lvl - 1) / (top - 1)) * W,
      y: H - (xpVal / maxXp) * H * 0.92,
    })
    const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${toXY(p.lvl, p.xp).x},${toXY(p.lvl, p.xp).y}`).join(" ")
    const cur = toXY(level, xpForLevel(level))
    return { path, cur, top, maxXp, W, H }
  }, [level, xp])

  // ── Streak calendar: GitHub-style heatmap of the last ~16 weeks ──
  const heat = useMemo(() => {
    const counts: Record<string, number> = {}
    const bump = (date: string, n: number) => {
      counts[date] = (counts[date] ?? 0) + n
    }
    // Focus sessions count double, completed tasks count once.
    focusLog.forEach((e) => bump(e.date, e.sessions * 2))
    completedTasks.forEach((t) => {
      if (t.completedAt) bump(t.completedAt, 1)
    })
    recurringLog.forEach((d) => bump(d, 1))

    const today = new Date()
    const todayKeyStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
    // Habit check-ins count once. Habits only store whether they were done
    // TODAY (no per-day history yet), so past days can't light up — today's
    // check-in does, which is why the calendar now responds to habits at all.
    habits.forEach((h) => {
      if (h.doneToday) bump(todayKeyStr, 1)
    })
    // Anchor the grid to a Sunday: start on the Sunday of the current week, 15
    // weeks earlier. Rows then map directly to getDay() (0 = Sunday … 6 = Saturday)
    // and the final column is a real Sunday-aligned partial week ending today.
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay() - 15 * 7)
    const dayMs = 24 * 60 * 60 * 1000
    const weeks: ({ date: string; count: number; isToday: boolean } | null)[][] = Array.from(
      { length: 16 },
      () => Array(7).fill(null),
    )
    let activeDays = 0
    for (let t = start.getTime(); t <= today.getTime(); t += dayMs) {
      const d = new Date(t)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      const count = counts[key] ?? 0
      if (count > 0) activeDays++
      const col = Math.floor((t - start.getTime()) / dayMs / 7)
      const row = d.getDay() // 0 = Sunday
      weeks[col][row] = { date: key, count, isToday: key === todayKeyStr }
    }
    return { weeks, activeDays }
  }, [focusLog, completedTasks, recurringLog, habits])

  const heatColor = (count: number) => {
    if (count <= 0) return "bg-muted"
    if (count === 1) return "bg-focus/40"
    if (count === 2) return "bg-focus/60"
    if (count === 3) return "bg-focus/80"
    return "bg-focus"
  }

  // Progress toward a locked badge (threshold vs the relevant current stat).
  const totalFocusSessions = focusLog.reduce((s, e) => s + e.sessions, 0)
  const progressFor = (a: Achievement) => {
    const v =
      a.category === "streak" ? bestStreak : a.category === "tasks" ? totalTasksDone : totalFocusSessions
    return { v, pct: Math.min(100, Math.round((v / a.threshold) * 100)) }
  }

  // Row order is getDay()-based (0 = Sunday) — label the odd rows.
  const weekLabels = ["Sun", "", "Tue", "", "Thu", "", "Sat"]

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <PageHeader
        title="Progress"
        subtitle={`Level ${level} · ${levelName(level)} · ${stats.earned}/${ACHIEVEMENTS.length} badges earned`}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── Level & XP ── */}
        <Card className="transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
          <div className="flex items-start justify-between">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Level</p>
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Zap className="size-4.5" />
            </span>
          </div>
          <div className="mt-3 flex items-end gap-2">
            <span className="text-5xl font-bold tracking-tight">{level}</span>
            <span className="mb-1.5 text-sm font-medium text-primary">{levelName(level)}</span>
          </div>
          <div className="mt-3">
            <ProgressBar value={levelPct} />
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>
                {into} / {need} XP in this level
              </span>
              <span>{need - into} XP to Level {level + 1}</span>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Total <span className="font-semibold text-foreground">{xp} XP</span> — tasks, habits and focus count.
          </p>
          <p className="mt-1 text-xs text-focus/80">
            🎁 Free shield every {FREE_SHIELD_EVERY_LEVELS} levels — next at Level {nextShieldMilestone(level)}
          </p>
          {/* Level curve */}
          <div className="mt-4 rounded-xl border border-border bg-secondary/20 p-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <TrendingUp className="size-3.5" />
              Cumulative XP by level
            </div>
            <svg viewBox={`0 0 ${curve.W} ${curve.H}`} className="mt-2 h-24 w-full" preserveAspectRatio="none">
              <polyline
                points={curve.path}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
              {/* Current level marker */}
              <circle
                cx={curve.cur.x}
                cy={curve.cur.y}
                r="3"
                fill="var(--primary)"
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx={curve.cur.x}
                cy={curve.cur.y}
                r="6"
                fill="none"
                stroke="var(--primary)"
                strokeWidth="1"
                opacity="0.4"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>L1 · 0 XP</span>
              <span>L{curve.top} · {curve.maxXp.toLocaleString()} XP</span>
            </div>
          </div>
        </Card>

        {/* ── This week ── */}
        <Card className="transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
          <div className="flex items-start justify-between">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">This Week</p>
            <span className="flex size-9 items-center justify-center rounded-lg bg-focus/15 text-focus">
              <CalendarDays className="size-4.5" />
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <BestTile
              icon={<ListTodo className="size-4" />}
              label="Tasks completed"
              value={String(week.tasksDone)}
              tone="text-primary"
            />
            <BestTile
              icon={<Timer className="size-4" />}
              label="Focus sessions"
              value={String(week.sessions)}
              tone="text-info"
            />
            <BestTile
              icon={<TrendingUp className="size-4" />}
              label="Focus"
              value={`${week.hours}h`}
              tone="text-success"
            />
            <BestTile
              icon={<Flame className="size-4" />}
              label="Active days"
              value={String(week.activeDays)}
              tone="text-focus"
            />
          </div>
          {/* Weekly focus goal */}
          {weeklyFocusGoal > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="size-3.5" />
                  Focus goal
                </span>
                <span className="font-medium text-foreground tabular-nums">
                  {week.hours}h / {(weeklyFocusGoal / 60).toFixed(1).replace(/\.0$/, "")}h
                </span>
              </div>
              <ProgressBar
                value={Math.min(100, Math.round((week.minutes / weeklyFocusGoal) * 100))}
                tone="success"
                className="mt-1.5"
              />
            </div>
          )}
          <p className="mt-4 text-xs text-muted-foreground">This week (Mon–Sun) — resets each Monday.</p>
        </Card>
      </div>

      {/* ── Badge cabinet ── */}
      <Card className="transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Badge Cabinet</p>
            <p className="mt-1 text-sm text-muted-foreground">Earned badges last forever; locked ones show progress.</p>
          </div>
          <span className="flex size-9 items-center justify-center rounded-lg bg-success/15 text-success">
            <Trophy className="size-4.5" />
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
          {ACHIEVEMENTS.map((a) => {
            const earned = !!achievements[a.id]
            const prog = progressFor(a)
            return (
              <div
                key={a.id}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all duration-200",
                  earned
                    ? "border-focus/40 bg-focus/5 hover:-translate-y-0.5 hover:shadow-md"
                    : "border-border bg-secondary/20",
                )}
              >
                <span className={cn("text-3xl", !earned && "grayscale opacity-50")}>{a.icon}</span>
                <p className="text-sm font-semibold text-foreground">{a.name}</p>
                <p className="text-xs text-muted-foreground">{a.desc}</p>
                {earned ? (
                  <span className="text-[10px] font-semibold text-focus">Earned</span>
                ) : (
                  <span className="w-full">
                    <ProgressBar value={prog.pct} tone="focus" className="h-1.5" />
                    <span className="mt-1 block text-[10px] text-muted-foreground">
                      {prog.v}/{a.threshold}
                    </span>
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </Card>

      {/* ── Streak calendar ── */}
      <Card className="transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Streak Calendar</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Last 16 weeks — focus, tasks and habit check-ins. {heat.activeDays} active days.
            </p>
          </div>
          <span className="flex size-9 items-center justify-center rounded-lg bg-info/15 text-info">
            <TrendingUp className="size-4.5" />
          </span>
        </div>
        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {/* Day-of-week labels */}
          <div className="flex flex-col gap-[3px] pr-1">
            {weekLabels.map((d, i) => (
              <span key={i} className="flex h-[13px] items-center text-[9px] text-muted-foreground">
                {d}
              </span>
            ))}
          </div>
          {/* Week columns */}
          <div className="flex gap-[3px]">
            {heat.weeks.map((col, ci) => (
              <div key={ci} className="flex flex-col gap-[3px]">
                {col.map((d, ri) =>
                  d ? (
                    <span
                      key={ri}
                      title={d.date}
                      className={cn(
                        "size-[13px] rounded-[3px]",
                        heatColor(d.count),
                        d.isToday && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                      )}
                    />
                  ) : (
                    <span key={ri} className="size-[13px] rounded-[3px]" />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
          Less
          {[0, 1, 2, 3, 4].map((n) => (
            <span key={n} className={cn("size-[11px] rounded-[3px]", heatColor(n))} />
          ))}
          More
        </div>
      </Card>

      {/* ── Charts & trends ── */}
      <div className="flex items-center gap-2.5 pt-1">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <BarChart3 className="size-4.5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Charts &amp; Trends</h2>
          <p className="text-sm text-muted-foreground">Your effort over time.</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="lg:col-span-2 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
          <ActivityChart focusLog={focusLog} tasks={tasks} completedTasks={completedTasks} recurringLog={recurringLog} />
        </Card>
        <Card className="transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
          <WeeklyTrend focusLog={focusLog} weeklyFocusGoal={weeklyFocusGoal} />
        </Card>
        <Card className="transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
          <TaskMixDonut tasks={tasks} completedTasks={completedTasks} />
        </Card>
        <Card className="transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
          <WeekdayChart focusLog={focusLog} completedTasks={completedTasks} recurringLog={recurringLog} />
        </Card>
        <Card className="transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
          <ProjectBars tasks={tasks} completedTasks={completedTasks} />
        </Card>
      </div>
    </div>
  )
}

function dayKeyStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}

// ── Daily activity: focus minutes + tasks completed, per day ──────────
function ActivityChart({
  focusLog,
  tasks,
  completedTasks,
  recurringLog,
}: {
  focusLog: FocusLogEntry[]
  tasks: Task[]
  completedTasks: CompletedTask[]
  recurringLog: string[]
}) {
  const [range, setRange] = useState<7 | 14 | 30>(14)
  const [hover, setHover] = useState<number | null>(null)

  const data = useMemo(() => {
    const now = new Date()
    const pts: { label: string; minutes: number; tasks: number; isToday: boolean }[] = []
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
      const k = dayKeyStr(d)
      const entry = focusLog.find((e) => e.date === k)
      pts.push({
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        minutes: entry?.minutes ?? 0,
        tasks: completedTasks.filter((t) => t.completedAt === k).length + recurringLog.filter((d) => d === k).length,
        isToday: i === 0,
      })
    }
    return pts
  }, [focusLog, completedTasks, recurringLog, range])

  const W = 720
  const H = 250
  const PAD_X = 36
  const PAD_Y = 26
  const innerW = W - PAD_X * 2
  const innerH = H - PAD_Y * 2
  const step = innerW / range
  const barW = Math.min(step / 3, 16)
  const maxMins = Math.max(...data.map((d) => d.minutes), 1)
  const maxTasks = Math.max(...data.map((d) => d.tasks), 1)
  const x = (i: number) => PAD_X + step * (i + 0.5)
  const yM = (v: number) => PAD_Y + innerH - (v / maxMins) * innerH
  const yT = (v: number) => PAD_Y + innerH - (v / maxTasks) * innerH
  const labelEvery = Math.max(1, Math.ceil(range / 8))
  const allZero = data.every((d) => d.minutes === 0 && d.tasks === 0)

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Daily Activity</p>
          <p className="mt-1 text-sm text-muted-foreground">Focus time and tasks, per day.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Legend color="var(--primary)" label="Focus hrs" />
          <Legend color="var(--focus)" label="Tasks done" />
          <div className="flex rounded-lg border border-border p-0.5">
            {([7, 14, 30] as const).map((n) => (
              <button
                key={n}
                onClick={() => setRange(n)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  range === n ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {n}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {allZero ? (
        <div className="mt-4 flex h-52 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-center">
          <BarChart3 className="size-6 text-muted-foreground/60" />
          <p className="text-sm font-medium text-foreground">No activity yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">Complete tasks or focus sessions to see your rhythm.</p>
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mt-4 h-52 w-full"
          role="img"
          aria-label="Daily focus hours and tasks completed"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <line
              key={t}
              x1={PAD_X}
              x2={W - PAD_X}
              y1={PAD_Y + innerH * t}
              y2={PAD_Y + innerH * t}
              stroke="var(--border)"
              strokeDasharray="4 6"
            />
          ))}

          {data.map((d, i) => (
            <g key={i}>
              <rect
                x={x(i) - barW - 1.5}
                y={yM(d.minutes)}
                width={barW}
                height={PAD_Y + innerH - yM(d.minutes)}
                rx={Math.min(3, barW / 2)}
                fill="var(--primary)"
                opacity={d.isToday ? 1 : 0.85}
              />
              <rect
                x={x(i) + 1.5}
                y={yT(d.tasks)}
                width={barW}
                height={PAD_Y + innerH - yT(d.tasks)}
                rx={Math.min(3, barW / 2)}
                fill="var(--focus)"
                opacity={d.isToday ? 1 : 0.85}
              />
              {i % labelEvery === 0 && (
                <text x={x(i)} y={H - 6} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                  {d.label}
                </text>
              )}
              {d.isToday && <circle cx={x(i)} cy={yM(d.minutes) - 9} r="2.5" fill="var(--primary)" />}
              <rect
                x={PAD_X + step * i}
                y={PAD_Y}
                width={step}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            </g>
          ))}

          {hover !== null && data[hover] && (
            <g pointerEvents="none">
              <rect
                x={Math.max(PAD_X, Math.min(x(hover) - 78, W - PAD_X - 156))}
                y={PAD_Y - 8}
                width="156"
                height="52"
                rx="10"
                fill="var(--popover)"
                stroke="var(--border)"
              />
              <text x={x(hover)} y={PAD_Y + 10} textAnchor="middle" className="fill-foreground text-[11px] font-semibold">
                {data[hover].label}
                {data[hover].isToday ? " · Today" : ""}
              </text>
              <text x={x(hover)} y={PAD_Y + 25} textAnchor="middle" className="fill-primary text-[11px]">
                {(data[hover].minutes / 60).toFixed(1)}h focus
              </text>
              <text x={x(hover)} y={PAD_Y + 38} textAnchor="middle" className="fill-focus text-[11px]">
                {data[hover].tasks} tasks done
              </text>
            </g>
          )}
        </svg>
      )}
    </div>
  )
}

// ── Focus trend: focus minutes per week vs the weekly goal ─────────
function WeeklyTrend({ focusLog, weeklyFocusGoal }: { focusLog: FocusLogEntry[]; weeklyFocusGoal: number }) {
  const data = useMemo(() => {
    const now = new Date()
    const weeks: { label: string; minutes: number; isCurrent: boolean }[] = []
    for (let w = 7; w >= 0; w--) {
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7) - w * 7)
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      const mKey = dayKeyStr(monday)
      const sKey = dayKeyStr(sunday)
      let minutes = 0
      focusLog.forEach((e) => {
        if (e.date >= mKey && e.date <= sKey) minutes += e.minutes
      })
      weeks.push({
        label: monday.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        minutes,
        isCurrent: w === 0,
      })
    }
    return weeks
  }, [focusLog])

  const W = 640
  const H = 210
  const PAD_X = 30
  const PAD_Y = 26
  const innerW = W - PAD_X * 2
  const innerH = H - PAD_Y * 2
  const maxV = Math.max(...data.map((d) => d.minutes), weeklyFocusGoal, 1)
  const step = innerW / data.length
  const barW = Math.min(step * 0.55, 34)
  const x = (i: number) => PAD_X + step * (i + 0.5)
  const y = (v: number) => PAD_Y + innerH - (v / maxV) * innerH
  const goalHours = weeklyFocusGoal / 60

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Focus Trend</p>
          <p className="mt-1 text-sm text-muted-foreground">Weekly focus vs your {goalHours}h goal.</p>
        </div>
        <span className="flex size-9 items-center justify-center rounded-lg bg-success/15 text-success">
          <Activity className="size-4.5" />
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-44 w-full" role="img" aria-label="Weekly focus hours trend">
        <line
          x1={PAD_X}
          x2={W - PAD_X}
          y1={y(weeklyFocusGoal)}
          y2={y(weeklyFocusGoal)}
          stroke="var(--success)"
          strokeDasharray="5 5"
          strokeWidth="1.5"
        />
        {data.map((d, i) => (
          <g key={i}>
            <rect
              x={x(i) - barW / 2}
              y={y(d.minutes)}
              width={barW}
              height={Math.max(1, PAD_Y + innerH - y(d.minutes))}
              rx="4"
              fill={d.minutes >= weeklyFocusGoal ? "var(--success)" : "var(--primary)"}
              opacity={d.isCurrent ? 1 : 0.8}
            />
            <text x={x(i)} y={H - 6} textAnchor="middle" className="fill-muted-foreground text-[10px]">
              {d.label}
            </text>
            {d.minutes > 0 && (
              <text x={x(i)} y={y(d.minutes) - 5} textAnchor="middle" className="fill-muted-foreground text-[9px]">
                {(d.minutes / 60).toFixed(1)}
              </text>
            )}
          </g>
        ))}
        <text x={W - PAD_X} y={y(weeklyFocusGoal) - 6} textAnchor="end" className="fill-success text-[10px] font-semibold">
          goal {goalHours}h
        </text>
      </svg>
    </div>
  )
}

// ── Task mix: donut of done / in-progress / to-do ─────────────────────
function TaskMixDonut({ tasks, completedTasks }: { tasks: Task[]; completedTasks: CompletedTask[] }) {
  const done = completedTasks.length
  const inProg = tasks.filter((t) => t.status === "in-progress").length
  const todo = tasks.filter((t) => t.status === "todo").length
  const total = done + inProg + todo
  const R = 52
  const C = 2 * Math.PI * R
  let acc = 0
  const arcs = [
    { label: "Done", count: done, color: "var(--success)" },
    { label: "In progress", count: inProg, color: "var(--info)" },
    { label: "To do", count: todo, color: "var(--muted-foreground)" },
  ].map((s) => {
    const frac = total > 0 ? s.count / total : 0
    const offset = acc
    acc += frac
    return { ...s, frac, offset }
  })

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Task Mix</p>
          <p className="mt-1 text-sm text-muted-foreground">Task status breakdown.</p>
        </div>
        <span className="flex size-9 items-center justify-center rounded-lg bg-info/15 text-info">
          <PieChart className="size-4.5" />
        </span>
      </div>
      {total === 0 ? (
        <div className="mt-4 flex h-40 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-center">
          <p className="text-sm font-medium text-foreground">No tasks yet</p>
          <p className="max-w-xs text-sm text-muted-foreground">Add tasks to see the breakdown.</p>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-6">
          <div className="relative">
            <svg viewBox="0 0 140 140" className="size-40">
              {arcs.map((s) =>
                s.frac > 0 ? (
                  <circle
                    key={s.label}
                    cx="70"
                    cy="70"
                    r={R}
                    fill="none"
                    stroke={s.color}
                    strokeWidth="15"
                    strokeDasharray={`${s.frac * C} ${C}`}
                    strokeDashoffset={-s.offset * C}
                    transform="rotate(-90 70 70)"
                  />
                ) : null,
              )}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold tracking-tight tabular-nums">{total}</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">tasks</span>
            </div>
          </div>
          <ul className="flex flex-col gap-2">
            {arcs.map((s) => (
              <li key={s.label} className="flex items-center gap-2 text-sm">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="w-20 text-muted-foreground">{s.label}</span>
                <span className="font-semibold tabular-nums">{s.count}</span>
                <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">
                  {Math.round(s.frac * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── Weekly rhythm: tasks + focus minutes by weekday (Mon-first) ────────
function WeekdayChart({
  focusLog,
  completedTasks,
  recurringLog,
}: {
  focusLog: FocusLogEntry[]
  completedTasks: CompletedTask[]
  recurringLog: string[]
}) {
  const data = useMemo(() => {
    const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    return names.map((label, i) => {
      let minutes = 0
      let count = 0
      focusLog.forEach((e) => {
        const d = new Date(`${e.date}T00:00:00`)
        if (!Number.isNaN(d.getTime()) && (d.getDay() + 6) % 7 === i) minutes += e.minutes
      })
      completedTasks.forEach((t) => {
        if (t.completedAt) {
          const d = new Date(`${t.completedAt}T00:00:00`)
          if (!Number.isNaN(d.getTime()) && (d.getDay() + 6) % 7 === i) count++
        }
      })
      recurringLog.forEach((date) => {
        const d = new Date(`${date}T00:00:00`)
        if (!Number.isNaN(d.getTime()) && (d.getDay() + 6) % 7 === i) count++
      })
      return { label, minutes, count }
    })
  }, [focusLog, completedTasks, recurringLog])

  const W = 640
  const H = 210
  const PAD_X = 30
  const PAD_Y = 26
  const innerW = W - PAD_X * 2
  const innerH = H - PAD_Y * 2
  const step = innerW / data.length
  const barW = Math.min(step / 4, 14)
  const maxMins = Math.max(...data.map((d) => d.minutes), 1)
  const maxTasks = Math.max(...data.map((d) => d.count), 1)
  const x = (i: number) => PAD_X + step * (i + 0.5)
  const yM = (v: number) => PAD_Y + innerH - (v / maxMins) * innerH
  const yT = (v: number) => PAD_Y + innerH - (v / maxTasks) * innerH

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Weekly Rhythm</p>
          <p className="mt-1 text-sm text-muted-foreground">Your busiest weekdays.</p>
        </div>
        <span className="flex size-9 items-center justify-center rounded-lg bg-focus/15 text-focus">
          <Repeat className="size-4.5" />
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-44 w-full" role="img" aria-label="Productivity by day of week">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={PAD_X}
            x2={W - PAD_X}
            y1={PAD_Y + innerH * t}
            y2={PAD_Y + innerH * t}
            stroke="var(--border)"
            strokeDasharray="4 6"
          />
        ))}
        {data.map((d, i) => (
          <g key={i}>
            <rect
              x={x(i) - barW - 1.5}
              y={yM(d.minutes)}
              width={barW}
              height={PAD_Y + innerH - yM(d.minutes)}
              rx={Math.min(3, barW / 2)}
              fill="var(--primary)"
              opacity="0.85"
            />
            <rect
              x={x(i) + 1.5}
              y={yT(d.count)}
              width={barW}
              height={PAD_Y + innerH - yT(d.count)}
              rx={Math.min(3, barW / 2)}
              fill="var(--focus)"
              opacity="0.85"
            />
            <text x={x(i)} y={H - 6} textAnchor="middle" className="fill-muted-foreground text-[10px]">
              {d.label}
            </text>
          </g>
        ))}
      </svg>
      <div className="mt-1 flex items-center justify-center gap-4">
        <Legend color="var(--primary)" label="Focus min" />
        <Legend color="var(--focus)" label="Tasks done" />
      </div>
    </div>
  )
}

// ── By project: task volume per project, completed vs open ─────────────
function ProjectBars({ tasks, completedTasks }: { tasks: Task[]; completedTasks: CompletedTask[] }) {
  const rows = useMemo(() => {
    const map = new Map<string, { total: number; done: number }>()
    // Active tasks count as open
    tasks.forEach((t) => {
      if (!t.project) return
      const r = map.get(t.project) ?? { total: 0, done: 0 }
      r.total++
      map.set(t.project, r)
    })
    // Completed tasks count as done
    completedTasks.forEach((t) => {
      if (!t.project) return
      const r = map.get(t.project) ?? { total: 0, done: 0 }
      r.total++
      r.done++
      map.set(t.project, r)
    })
    return Array.from(map.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 6)
  }, [tasks, completedTasks])
  const max = Math.max(...rows.map(([, r]) => r.total), 1)

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">By Project</p>
          <p className="mt-1 text-sm text-muted-foreground">Task load per project.</p>
        </div>
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Layers className="size-4.5" />
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="mt-4 flex h-40 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-center">
          <p className="text-sm font-medium text-foreground">No projects yet</p>
          <p className="max-w-xs text-sm text-muted-foreground">Assign tasks to projects to see load.</p>
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {rows.map(([name, r]) => {
            const donePct = r.total > 0 ? Math.round((r.done / r.total) * 100) : 0
            return (
              <li key={name}>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-medium text-foreground">{name}</span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {r.done}/{r.total} done
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="flex h-full">
                    {r.done > 0 && (
                      <div
                        className="h-full rounded-l-full bg-success transition-all duration-300"
                        style={{ width: `${(r.done / max) * 100}%` }}
                      />
                    )}
                    {r.total - r.done > 0 && (
                      <div
                        className="h-full bg-primary/70 transition-all duration-300"
                        style={{ width: `${((r.total - r.done) / max) * 100}%` }}
                      />
                    )}
                  </div>
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{donePct}% complete</p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function BestTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone: string
}) {
  return (
    <div className="rounded-xl border border-border bg-secondary/20 p-3">
      <span className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", tone)}>
        {icon}
        <span className="truncate">{label}</span>
      </span>
      <p className="mt-1.5 text-2xl font-bold tracking-tight tabular-nums">{value}</p>
    </div>
  )
}
