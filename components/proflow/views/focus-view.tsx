"use client"

import { Coffee, Minus, Pause, Play, Plus, RotateCcw, SkipForward, Square, Timer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatTime, useStore } from "../store"
import { Card, CircularProgress, PageHeader } from "../ui"

export function FocusView() {
  const {
    secondsLeft,
    totalSeconds,
    running,
    mode,
    pomodoro,
    totalPomodoros,
    sessionLabel,
    focusMinutes,
    breakMinutes,
    setFocusMinutes,
    setBreakMinutes,
    toggleTimer,
    skipTimer,
    stopTimer,
    resetTimer,
    focusLog,
  } = useStore()

  // Real today stats from recorded focus sessions — zero on a fresh install.
  const todayKey = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  })()
  const todayEntry = focusLog.find((e) => e.date === todayKey)
  const todayMinutes = todayEntry?.minutes ?? 0
  const todaySessions = todayEntry?.sessions ?? 0
  // Streak: consecutive days (ending today, or yesterday if today has none yet)
  // with at least one completed focus session.
  const focusStreak = (() => {
    const keys = new Set(focusLog.map((e) => e.date))
    let streak = 0
    const d = new Date()
    const mk = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`
    if (!keys.has(mk(d))) d.setDate(d.getDate() - 1)
    while (keys.has(mk(d))) {
      streak++
      d.setDate(d.getDate() - 1)
    }
    return streak
  })()

  const progress = ((totalSeconds - secondsLeft) / totalSeconds) * 100

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <PageHeader title="Focus Timer" subtitle={`Deep work session · ${sessionLabel}`} />

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card className="flex flex-col items-center justify-center gap-6 py-10">
          <span
            className={cn(
              "flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium",
              mode === "focus" ? "bg-primary/15 text-primary" : "bg-info/15 text-info",
            )}
          >
            {mode === "focus" ? <Timer className="size-4" /> : <Coffee className="size-4" />}
            {mode === "focus" ? "Focus" : "Break"}
          </span>

          <CircularProgress
            value={progress}
            size={240}
            stroke={14}
            tone={mode === "focus" ? "var(--primary)" : "var(--info)"}
          >
            <div className="flex flex-col items-center">
              <span className="font-mono text-6xl font-bold tabular-nums">{formatTime(secondsLeft)}</span>
              <span className="mt-1 text-sm text-muted-foreground">
                Pomodoro {pomodoro} of {totalPomodoros}
              </span>
            </div>
          </CircularProgress>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={resetTimer}
              aria-label="Reset timer"
              className="flex size-11 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <RotateCcw className="size-4.5" />
            </button>
            <button
              type="button"
              onClick={toggleTimer}
              aria-label={running ? "Pause" : "Start"}
              className="flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105"
            >
              {running ? <Pause className="size-7" /> : <Play className="size-7 translate-x-0.5" />}
            </button>
            <button
              type="button"
              onClick={skipTimer}
              aria-label="Skip to next"
              className="flex size-11 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <SkipForward className="size-4.5" />
            </button>
          </div>

          <Button variant="ghost" onClick={stopTimer} className="gap-1.5 text-muted-foreground">
            <Square className="size-3.5" /> End session
          </Button>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <h2 className="font-semibold">Session progress</h2>
            <div className="mt-4 flex items-center justify-between gap-1">
              {Array.from({ length: totalPomodoros }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex h-16 flex-1 flex-col items-center justify-center gap-1 rounded-xl border text-xs font-medium",
                    i < pomodoro - 1
                      ? "border-primary/40 bg-primary/15 text-primary"
                      : i === pomodoro - 1
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-secondary/40 text-muted-foreground",
                  )}
                >
                  <Timer className="size-4" />
                  {i + 1}
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              {pomodoro - 1} of {totalPomodoros} pomodoros completed this session.
            </p>
          </Card>

          <Card className="flex flex-col gap-3">
            <h2 className="font-semibold">Timer settings</h2>
            <Stepper
              label="Focus length"
              value={focusMinutes}
              min={5}
              max={120}
              step={5}
              onChange={setFocusMinutes}
            />
            <Stepper
              label="Break length"
              value={breakMinutes}
              min={1}
              max={30}
              step={1}
              onChange={setBreakMinutes}
            />
            <p className="text-xs text-muted-foreground">
              Saved automatically — changes apply whenever the timer is idle.
            </p>
          </Card>

          <Card className="flex flex-col gap-3">
            <h2 className="font-semibold">Today</h2>
            <Stat label="Deep work" value={`${todayMinutes > 0 ? (todayMinutes / 60).toFixed(1) : "0.0"} hrs`} tone="text-info" />
            <Stat label="Sessions completed" value={String(todaySessions)} tone="text-primary" />
            <Stat label="Focus streak" value={`${focusStreak} days`} tone="text-focus" />
          </Card>
        </div>
      </div>
    </div>
  )
}

function Stepper({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (n: number) => void
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-secondary/40 px-3 py-2.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - step))}
          aria-label={`Decrease ${label}`}
          className="flex size-7 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Minus className="size-3.5" />
        </button>
        <span className="w-14 text-center text-sm font-semibold tabular-nums">
          {value} min
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + step))}
          aria-label={`Increase ${label}`}
          className="flex size-7 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-secondary/40 px-3 py-2.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-semibold", tone)}>{value}</span>
    </div>
  )
}
