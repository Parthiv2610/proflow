"use client"

import { useMemo, useState } from "react"
import { Card } from "./ui"
import { useStore } from "./store"

type Point = { day: string; focus: number; tasks: number }

const W = 720
const H = 240
const PAD_X = 36
const PAD_Y = 24

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function FocusChart() {
  const { focusLog, tasks, recurringLog } = useStore()
  const [hover, setHover] = useState<number | null>(null)

  // Real data — the last 7 days ending today, built from recorded focus
  // sessions and task completions. Fresh installs are all zeros.
  const data = useMemo<Point[]>(() => {
    const pts: Point[] = []
    const now = new Date()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
      const key = dayKey(d)
      const entry = focusLog.find((e) => e.date === key)
      pts.push({
        day: d.toLocaleDateString("en-US", { weekday: "short" }),
        focus: entry ? Math.round((entry.minutes / 60) * 10) / 10 : 0,
        tasks:
          tasks.filter((t) => t.completedAt === key).length +
          recurringLog.filter((d) => d === key).length,
      })
    }
    return pts
  }, [focusLog, tasks, recurringLog])

  const weekHours = data.reduce((s, d) => s + d.focus, 0)
  const allZero = data.every((d) => d.focus === 0 && d.tasks === 0)

  const FOCUS_MAX = Math.max(...data.map((d) => d.focus), 1)
  const TASKS_MAX = Math.max(...data.map((d) => d.tasks), 1)
  const innerW = W - PAD_X * 2
  const innerH = H - PAD_Y * 2
  const step = innerW / (data.length - 1)

  const x = (i: number) => PAD_X + i * step
  const yFocus = (v: number) => PAD_Y + innerH - (v / FOCUS_MAX) * innerH
  const yTasks = (v: number) => PAD_Y + innerH - (v / TASKS_MAX) * innerH

  const focusLine = data.map((d, i) => `${x(i)},${yFocus(d.focus)}`).join(" ")
  const focusArea = `${PAD_X},${PAD_Y + innerH} ${focusLine} ${x(data.length - 1)},${PAD_Y + innerH}`
  const tasksLine = data.map((d, i) => `${x(i)},${yTasks(d.tasks)}`).join(" ")

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-card-foreground">Focus Hours — Last 7 Days</h2>
          <p className="text-sm text-muted-foreground">Logged from completed focus sessions</p>
        </div>
        <div className="flex items-center gap-4">
          <Legend color="var(--primary)" label="Focus hrs" />
          <Legend color="var(--focus)" label="Tasks done" />
          <span className="rounded-md bg-success/15 px-2 py-1 text-xs font-semibold text-success">
            {weekHours > 0 ? `${weekHours.toFixed(1)}h this week` : "No sessions yet"}
          </span>
        </div>
      </div>

      <div className="mt-4">
        {allZero ? (
          <div className="flex h-56 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-center">
            <p className="text-sm font-medium text-foreground">No focus sessions yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Start the Focus Timer and complete a session — your focus hours and completed
              tasks will appear here automatically.
            </p>
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-56 w-full"
            role="img"
            aria-label="Focus hours and tasks completed over the last 7 days"
          >
            <defs>
              <linearGradient id="focusFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
              </linearGradient>
            </defs>

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

            <text x={PAD_X - 10} y={PAD_Y + 4} textAnchor="end" className="fill-muted-foreground text-[10px]">
              {FOCUS_MAX}
            </text>
            <text x={W - PAD_X + 10} y={PAD_Y + 4} textAnchor="start" className="fill-muted-foreground text-[10px]">
              {TASKS_MAX}
            </text>
            <text x={PAD_X - 10} y={PAD_Y + innerH} textAnchor="end" className="fill-muted-foreground text-[10px]">
              0
            </text>

            <polygon points={focusArea} fill="url(#focusFill)" />
            <polyline points={focusLine} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points={tasksLine} fill="none" stroke="var(--focus)" strokeWidth="2.5" strokeDasharray="2 5" strokeLinecap="round" />

            {data.map((d, i) => (
              <g key={d.day}>
                <circle cx={x(i)} cy={yFocus(d.focus)} r={hover === i ? 5 : 3.5} fill="var(--primary)" />
                <circle cx={x(i)} cy={yTasks(d.tasks)} r={hover === i ? 5 : 3.5} fill="var(--focus)" />
                <text x={x(i)} y={H - 4} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                  {d.day}
                </text>
                <rect
                  x={x(i) - step / 2}
                  y={PAD_Y}
                  width={step}
                  height={innerH}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                />
                {hover === i && (
                  <g>
                    <rect x={x(i) - 46} y={yFocus(d.focus) - 46} width="92" height="38" rx="8" fill="var(--popover)" stroke="var(--border)" />
                    <text x={x(i)} y={yFocus(d.focus) - 30} textAnchor="middle" className="fill-primary text-[11px] font-semibold">
                      {d.focus}h focus
                    </text>
                    <text x={x(i)} y={yFocus(d.focus) - 16} textAnchor="middle" className="fill-focus text-[11px] font-semibold">
                      {d.tasks} tasks done
                    </text>
                  </g>
                )}
              </g>
            ))}
          </svg>
        )}
      </div>
    </Card>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}
