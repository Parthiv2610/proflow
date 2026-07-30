"use client"

import { Pause, Play, SkipForward, Timer, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatTime, useStore } from "./store"

export function SessionBar() {
  const {
    secondsLeft,
    totalSeconds,
    running,
    mode,
    pomodoro,
    totalPomodoros,
    sessionLabel,
    toggleTimer,
    skipTimer,
    stopTimer,
  } = useStore()

  const progress = ((totalSeconds - secondsLeft) / totalSeconds) * 100

  return (
    <div className="relative overflow-hidden rounded-2xl border border-focus/40 bg-focus/[0.07]">
      <div
        className="absolute bottom-0 left-0 h-0.5 bg-focus transition-all duration-1000"
        style={{ width: `${progress}%` }}
      />
      <div className="flex flex-wrap items-center gap-4 p-4 sm:flex-nowrap">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-focus/15 text-focus">
          <Timer className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-foreground">
            {mode === "focus" ? "Deep Work Session" : "Break"} — {sessionLabel}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            Pomodoro {pomodoro} of {totalPomodoros} · Session started at 2:15 PM
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-2xl font-bold tabular-nums text-focus sm:text-3xl">
            {formatTime(secondsLeft)}
          </span>
          <div className="flex items-center gap-1">
            <SessionButton
              label={running ? "Pause session" : "Resume session"}
              onClick={toggleTimer}
              className="bg-focus/15 text-focus hover:bg-focus/25"
            >
              {running ? <Pause className="size-4" /> : <Play className="size-4" />}
            </SessionButton>
            <SessionButton label="Skip to next" onClick={skipTimer}>
              <SkipForward className="size-4" />
            </SessionButton>
            <SessionButton label="End session" onClick={stopTimer}>
              <X className="size-4" />
            </SessionButton>
          </div>
        </div>
      </div>
    </div>
  )
}

function SessionButton({
  children,
  label,
  onClick,
  className,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  )
}
