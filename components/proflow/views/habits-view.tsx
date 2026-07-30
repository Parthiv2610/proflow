"use client"

import { Check, Flame, Target } from "lucide-react"
import { cn } from "@/lib/utils"
import { useStore } from "../store"
import { Card, CircularProgress, PageHeader, ProgressBar } from "../ui"

const weekDays = ["M", "T", "W", "T", "F", "S", "S"]

export function HabitsView() {
  const { habits, goals, toggleHabit } = useStore()
  const doneToday = habits.filter((h) => h.doneToday).length

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <PageHeader title="Habits & Goals" subtitle={`${doneToday}/${habits.length} habits done today · ${goals.length} active goals`} />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Flame className="size-4 text-focus" />
            <h2 className="font-semibold">Daily Habits</h2>
          </div>
          {habits.map((h) => (
            <Card key={h.id} className="flex items-center gap-4 p-4">
              <button
                type="button"
                onClick={() => toggleHabit(h.id)}
                aria-label={`Toggle ${h.name}`}
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-xl border transition-colors",
                  h.doneToday
                    ? "border-focus bg-focus text-focus-foreground"
                    : "border-muted-foreground/40 text-transparent hover:border-focus",
                )}
              >
                <Check className="size-4.5" />
              </button>
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm font-medium", h.doneToday && "text-foreground")}>{h.name}</p>
                <div className="mt-1.5 flex items-center gap-1">
                  {h.week.map((on, i) => (
                    <span key={i} className={cn("size-2 rounded-full", on ? "bg-focus" : "bg-muted")} title={weekDays[i]} />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg bg-focus/10 px-2.5 py-1 text-focus">
                <Flame className="size-3.5" />
                <span className="text-sm font-semibold">{h.streak}</span>
              </div>
            </Card>
          ))}
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Target className="size-4 text-success" />
            <h2 className="font-semibold">Goals</h2>
          </div>
          {goals.map((g) => (
            <Card key={g.id} className="flex items-center gap-4 p-4">
              <CircularProgress
                value={g.progress}
                size={60}
                stroke={7}
                tone={g.status === "on-track" ? "var(--success)" : "var(--danger)"}
              >
                <span className="text-xs font-bold">{g.progress}%</span>
              </CircularProgress>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold">{g.name}</p>
                  <span
                    className={cn(
                      "shrink-0 rounded-md px-2 py-0.5 text-xs font-medium",
                      g.status === "on-track" ? "bg-success/15 text-success" : "bg-danger/15 text-danger",
                    )}
                  >
                    {g.status === "on-track" ? "On track" : "At risk"}
                  </span>
                </div>
                <div className="mt-2">
                  <ProgressBar value={g.progress} tone={g.status === "on-track" ? "success" : "danger"} />
                </div>
              </div>
            </Card>
          ))}
        </section>
      </div>
    </div>
  )
}
