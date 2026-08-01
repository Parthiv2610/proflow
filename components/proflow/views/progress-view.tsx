"use client"

import { useMemo } from "react"
import { Award, Flame, ListTodo, Timer, TrendingUp, Trophy, Zap } from "lucide-react"
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
} from "../store"
import { Card, PageHeader, ProgressBar } from "../ui"

/**
 * Progress — the achievement cabinet: level curve + XP, all badges (earned and
 * locked with progress), personal bests, and a GitHub-style streak calendar
 * built from real focus sessions and task completions.
 */
export function ProgressView() {
  const { xp, achievements, bestStreak, totalTasksDone, focusLog, tasks } = useStore()

  const level = levelFor(xp)
  const into = xpIntoLevel(xp)
  const need = xpForNextLevel(level)
  const levelPct = need > 0 ? Math.round((into / need) * 100) : 100

  // ── Personal bests (all real data) ────────────────────────────
  const stats = useMemo(() => {
    const totalMinutes = focusLog.reduce((s, e) => s + e.minutes, 0)
    const totalSessions = focusLog.reduce((s, e) => s + e.sessions, 0)
    const hours = Math.round((totalMinutes / 60) * 10) / 10
    const earned = ACHIEVEMENTS.filter((a) => achievements[a.id]).length
    return { totalMinutes, totalSessions, hours, earned }
  }, [focusLog, achievements])

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
    // Focus sessions count double (deep work), completed tasks count once.
    focusLog.forEach((e) => bump(e.date, e.sessions * 2))
    tasks.forEach((t) => {
      if (t.status === "done" && t.completedAt) bump(t.completedAt, 1)
    })

    const today = new Date()
    const todayKeyStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
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
  }, [focusLog, tasks])

  const heatColor = (count: number) => {
    if (count <= 0) return "bg-muted"
    if (count === 1) return "bg-focus/40"
    if (count === 2) return "bg-focus/60"
    if (count === 3) return "bg-focus/80"
    return "bg-focus"
  }

  // Progress toward a locked badge (threshold vs the relevant current stat).
  const progressFor = (a: Achievement) => {
    const v = a.category === "streak" ? bestStreak : totalTasksDone
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
            Total <span className="font-semibold text-foreground">{xp} XP</span> — tasks, habits and focus sessions
            all count.
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

        {/* ── Personal bests ── */}
        <Card className="transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
          <div className="flex items-start justify-between">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Personal Bests</p>
            <span className="flex size-9 items-center justify-center rounded-lg bg-focus/15 text-focus">
              <Award className="size-4.5" />
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <BestTile
              icon={<Flame className="size-4" />}
              label="Best habit streak"
              value={`${bestStreak}d`}
              tone="text-focus"
            />
            <BestTile
              icon={<ListTodo className="size-4" />}
              label="Tasks completed"
              value={String(totalTasksDone)}
              tone="text-primary"
            />
            <BestTile
              icon={<Timer className="size-4" />}
              label="Focus sessions"
              value={String(stats.totalSessions)}
              tone="text-info"
            />
            <BestTile
              icon={<TrendingUp className="size-4" />}
              label="Deep work total"
              value={`${stats.hours}h`}
              tone="text-success"
            />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            These track your all-time bests across this device — badges below unlock automatically as you pass
            each milestone.
          </p>
        </Card>
      </div>

      {/* ── Badge cabinet ── */}
      <Card className="transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Badge Cabinet</p>
            <p className="mt-1 text-sm text-muted-foreground">Earned badges stay forever. Locked ones show how close you are.</p>
          </div>
          <span className="flex size-9 items-center justify-center rounded-lg bg-success/15 text-success">
            <Trophy className="size-4.5" />
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
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
              Last 16 weeks of activity — focus sessions and completed tasks. {heat.activeDays} active days.
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
