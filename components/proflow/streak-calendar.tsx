"use client"

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Habit } from "./store"

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]
const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"]

/** "YYYY-MM-DD" key for a date. */
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/**
 * Build the set of dates that should be marked as "completed" for a habit.
 *
 * Instead of guessing from the streak count (which breaks when the schedule
 * has gaps), we use the actual `completedDays` array stored per habit. This
 * array is populated by toggleHabit and records every date the user checked.
 */
function completedDates(habit: Habit, today: Date): Set<string> {
  const done = new Set<string>()

  // Add today if checked
  if (habit.doneToday) {
    done.add(dateKey(today))
  }

  // Use the actual completed days history — no guessing needed.
  // We only show dates that fall within the visible calendar range, so
  // limit to ~60 days back to keep the set small.
  const cutoff = new Date(today)
  cutoff.setDate(cutoff.getDate() - 60)
  const cutoffKey = dateKey(cutoff)

  for (const d of habit.completedDays) {
    if (d >= cutoffKey) {
      done.add(d)
    }
  }

  return done
}

/**
 * Compute the actual streak count from a habit's completedDays history.
 * Walks backwards from today counting consecutive scheduled days that were
 * completed. This is the authoritative streak, matching what the calendar shows.
 */
function computeActualStreak(habit: Habit, today: Date): number {
  let streak = 0
  if (habit.doneToday) {
    streak = 1
  }

  const cursor = new Date(today)
  cursor.setDate(cursor.getDate() - 1)

  const completedSet = new Set(habit.completedDays)
  // Also include today if doneToday
  if (habit.doneToday) completedSet.add(dateKey(today))

  let safety = 400
  while (safety-- > 0) {
    const key = dateKey(cursor)
    const dayIdx = (cursor.getDay() + 6) % 7

    if (habit.week[dayIdx]) {
      // Scheduled day — check if completed
      if (completedSet.has(key)) {
        streak++
      } else {
        // Missed a scheduled day — streak broken
        break
      }
    }
    // Non-scheduled days are skipped (don't break the streak)
    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
}

export function StreakCalendar({
  habit,
  compact = false,
  className,
}: {
  habit: Habit | null
  compact?: boolean
  className?: string
}) {
  const today = useMemo(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  }, [])

  const [month, setMonth] = useState(today.getMonth())
  const [year, setYear] = useState(today.getFullYear())

  const completed = useMemo(
    () => (habit ? completedDates(habit, today) : new Set<string>()),
    [habit, today],
  )

  // Compute the real streak from actual completion data (not the stored counter)
  const actualStreak = useMemo(
    () => (habit ? computeActualStreak(habit, today) : 0),
    [habit, today],
  )

  const todayKeyStr = dateKey(today)

  // Build the grid for the current month
  const grid = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    // Monday-first: 0=Mon … 6=Sun.  JS getDay(): 0=Sun … 6=Sat
    const startOffset = (firstDay.getDay() + 6) % 7

    const cells: { day: number; key: string; isToday: boolean; isPast: boolean; scheduled: boolean; completed: boolean }[] = []

    for (let i = 0; i < startOffset; i++) {
      cells.push({ day: 0, key: `pad-${i}`, isToday: false, isPast: false, scheduled: false, completed: false })
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d)
      const key = dateKey(date)
      const dayIdx = (date.getDay() + 6) % 7
      const scheduled = habit ? habit.week[dayIdx] : false
      const isPast = date.getTime() < today.getTime()
      cells.push({
        day: d,
        key,
        isToday: key === todayKeyStr,
        isPast,
        scheduled,
        completed: completed.has(key),
      })
    }

    return cells
  }, [year, month, habit, today, todayKeyStr, completed])

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1) }
    else setMonth(month - 1)
  }

  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1) }
    else setMonth(month + 1)
  }

  const isCurrentMonth = month === today.getMonth() && year === today.getFullYear()

  if (!habit) {
    return (
      <div className={cn("flex items-center justify-center rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground", className)}>
        Select a habit to see its streak calendar
      </div>
    )
  }

  return (
    <div className={cn("select-none", className)}>
      {/* Header: month nav + streak badge */}
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={prevMonth} className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
          <ChevronLeft className={cn("size-4", compact && "size-3")} />
        </button>
        <div className="flex items-center gap-2">
          <span className={cn("font-semibold", compact ? "text-xs" : "text-sm")}>
            {MONTH_NAMES[month]} {year}
          </span>
          <span className="flex items-center gap-1 rounded-full bg-focus/15 px-2 py-0.5 text-[10px] font-bold text-focus">
            🔥 {actualStreak}d
          </span>
        </div>
        <button type="button" onClick={nextMonth} className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
          <ChevronRight className={cn("size-4", compact && "size-3")} />
        </button>
      </div>

      {/* Day-of-week labels */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {DAY_LABELS.map((d, i) => (
          <div key={i} className={cn("text-center font-medium text-muted-foreground", compact ? "text-[8px]" : "text-[10px]")}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {grid.map((cell) => {
          if (cell.day === 0) return <div key={cell.key} />

          let bg = "bg-muted/30" // default: future / unscheduled past
          let text = "text-muted-foreground"
          let ring = ""

          if (cell.isToday) {
            ring = "ring-2 ring-focus"
          }

          if (cell.completed) {
            bg = "bg-focus"
            text = "text-white font-bold"
          }

          return (
            <div
              key={cell.key}
              className={cn(
                "flex items-center justify-center rounded-md",
                compact ? "aspect-square text-[9px]" : "aspect-square text-[11px]",
                bg, text, ring,
                "transition-colors",
              )}
              title={
                cell.completed
                  ? `${cell.day} — completed ✓`
                  : cell.scheduled
                    ? `${cell.day} — scheduled`
                    : `${cell.day}`
              }
            >
              {cell.day}
            </div>
          )
        })}
      </div>

      {/* Legend (non-compact only) */}
      {!compact && (
        <div className="mt-2 flex items-center justify-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-focus" /> Completed</span>
        </div>
      )}
    </div>
  )
}
