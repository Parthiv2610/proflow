"use client"

import { useState } from "react"
import { Check, Flame, Plus, Shield, Target, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { FREE_SHIELD_EVERY_LEVELS, levelFor, MAX_SHIELDS, nextShieldMilestone, SHIELD_PRICE, useStore } from "../store"
import { Card, CircularProgress, PageHeader, ProgressBar } from "../ui"
import { Modal } from "../modal"
import { Button } from "@/components/ui/button"

const weekDays = ["M", "T", "W", "T", "F", "S", "S"]

const inputCls =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"

export function HabitsView() {
  const {
    habits,
    goals,
    toggleHabit,
    addHabit,
    deleteHabit,
    addGoal,
    updateGoal,
    deleteGoal,
    xp,
    streakShields,
    buyShield,
  } = useStore()
  const doneToday = habits.filter((h) => h.doneToday).length
  const [justBought, setJustBought] = useState(false)
  const [notEnough, setNotEnough] = useState(false)

  // Next free shield lands at the next multiple of FREE_SHIELD_EVERY_LEVELS.
  const nextFreeShieldLevel = nextShieldMilestone(levelFor(xp))

  const handleBuy = () => {
    if (buyShield()) {
      setJustBought(true)
      setNotEnough(false)
      setTimeout(() => setJustBought(false), 2500)
    } else {
      setJustBought(false)
      setNotEnough(true)
      setTimeout(() => setNotEnough(false), 2500)
    }
  }

  // add-habit modal state
  const [habitOpen, setHabitOpen] = useState(false)
  const [habitName, setHabitName] = useState("")
  const [habitWeek, setHabitWeek] = useState<boolean[]>([true, true, true, true, true, true, false])

  // add-goal modal state
  const [goalOpen, setGoalOpen] = useState(false)
  const [goalName, setGoalName] = useState("")
  const [goalProgress, setGoalProgress] = useState(0)

  const submitHabit = (e: React.FormEvent) => {
    e.preventDefault()
    const name = habitName.trim()
    if (!name) return
    addHabit(name, habitWeek)
    setHabitName("")
    setHabitWeek([true, true, true, true, true, true, false])
    setHabitOpen(false)
  }

  const submitGoal = (e: React.FormEvent) => {
    e.preventDefault()
    const name = goalName.trim()
    if (!name) return
    addGoal(name, goalProgress)
    setGoalName("")
    setGoalProgress(0)
    setGoalOpen(false)
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <PageHeader title="Habits & Goals" subtitle={`${doneToday}/${habits.length} habits done today · ${goals.length} active goals`}>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setHabitOpen(true)}>
            <Plus className="size-4" /> Add habit
          </Button>
          <Button onClick={() => setGoalOpen(true)}>
            <Target className="size-4" /> Add goal
          </Button>
        </div>
      </PageHeader>

      {/* Streak Shields — buy insurance with XP so a missed day doesn't reset your streak. */}
      <Card className="flex flex-wrap items-center justify-between gap-4 border-focus/20 bg-focus/5 p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-focus/15 text-focus">
            <Shield className="size-6" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Streak Shields</p>
            <p className="text-xs text-muted-foreground">
              Miss a scheduled day and a shield keeps your streak alive — automatically. You can hold up to{" "}
              <span className="font-medium text-focus">{MAX_SHIELDS}</span> at once. Shields and XP stay in sync between your laptop and phone.
            </p>
            <p className="mt-1 text-[11px] font-medium text-focus/80">
              🎁 Free shield every {FREE_SHIELD_EVERY_LEVELS} levels — next at Level {nextFreeShieldLevel}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Your XP</p>
            <p className="text-sm font-bold tabular-nums">{xp}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Shields</p>
            <p className="text-sm font-bold tabular-nums">
              {streakShields}/{MAX_SHIELDS}
            </p>
          </div>
          <Button variant="secondary" onClick={handleBuy} disabled={streakShields >= MAX_SHIELDS}>
            <Shield className="size-4" />
            {streakShields >= MAX_SHIELDS ? "Max held" : `Buy · ${SHIELD_PRICE} XP`}
          </Button>
        </div>
        <p
          className={cn(
            "w-full text-xs font-medium transition-opacity",
            justBought ? "text-success" : notEnough ? "text-danger" : "opacity-0",
          )}
        >
          {justBought
            ? "Shield purchased — your streak is protected!"
            : notEnough
              ? `Not enough XP yet — you need ${SHIELD_PRICE} XP for a shield.`
              : " "}
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Flame className="size-4 text-focus" />
            <h2 className="font-semibold">Daily Habits</h2>
          </div>
          {habits.length === 0 && (
            <Card className="flex flex-col items-center gap-2 p-6 text-center text-sm text-muted-foreground">
              <Flame className="size-6 text-focus/60" />
              <p className="font-medium text-foreground">No habits yet</p>
              <p>Click “Add habit” to start building a daily routine.</p>
            </Card>
          )}
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
              <button
                type="button"
                onClick={() => deleteHabit(h.id)}
                aria-label={`Delete ${h.name}`}
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground/60 transition-colors hover:bg-danger/10 hover:text-danger"
              >
                <Trash2 className="size-4" />
              </button>
            </Card>
          ))}
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Target className="size-4 text-success" />
            <h2 className="font-semibold">Goals</h2>
          </div>
          {goals.length === 0 && (
            <Card className="flex flex-col items-center gap-2 p-6 text-center text-sm text-muted-foreground">
              <Target className="size-6 text-success/60" />
              <p className="font-medium text-foreground">No goals yet</p>
              <p>Click “Add goal” to set a target with progress.</p>
            </Card>
          )}
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
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex-1">
                    <ProgressBar value={g.progress} tone={g.status === "on-track" ? "success" : "danger"} />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateGoal(g.id, { progress: Math.max(0, g.progress - 10) })}
                      aria-label={`Decrease ${g.name} progress`}
                      className="flex size-7 items-center justify-center rounded-lg border border-input text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      onClick={() => updateGoal(g.id, { progress: Math.min(100, g.progress + 10) })}
                      aria-label={`Increase ${g.name} progress`}
                      className="flex size-7 items-center justify-center rounded-lg border border-input text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => deleteGoal(g.id)}
                aria-label={`Delete ${g.name}`}
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground/60 transition-colors hover:bg-danger/10 hover:text-danger"
              >
                <Trash2 className="size-4" />
              </button>
            </Card>
          ))}
        </section>
      </div>

      <Modal
        open={habitOpen}
        onClose={() => setHabitOpen(false)}
        title="Add a habit"
        description="Something you want to do regularly."
      >
        <form onSubmit={submitHabit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="habit-name" className="text-sm font-medium text-foreground">
              Habit name
            </label>
            <input
              id="habit-name"
              autoFocus
              value={habitName}
              onChange={(e) => setHabitName(e.target.value)}
              placeholder="e.g. Drink 2L of water"
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">Repeat on</span>
            <div className="flex gap-1.5">
              {weekDays.map((d, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setHabitWeek((prev) => prev.map((on, j) => (j === i ? !on : on)))}
                  aria-pressed={habitWeek[i]}
                  className={cn(
                    "size-10 flex-1 rounded-lg border text-sm font-semibold transition-colors",
                    habitWeek[i]
                      ? "border-focus bg-focus text-focus-foreground"
                      : "border-input bg-background text-muted-foreground hover:text-foreground",
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setHabitOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="lg">
              Create habit
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={goalOpen} onClose={() => setGoalOpen(false)} title="Add a goal" description="Set a target you're working toward.">
        <form onSubmit={submitGoal} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="goal-name" className="text-sm font-medium text-foreground">
              Goal name
            </label>
            <input
              id="goal-name"
              autoFocus
              value={goalName}
              onChange={(e) => setGoalName(e.target.value)}
              placeholder="e.g. Ship ProFlow v3"
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="goal-progress" className="text-sm font-medium text-foreground">
              Starting progress: <span className="font-semibold text-primary">{goalProgress}%</span>
            </label>
            <input
              id="goal-progress"
              type="range"
              min={0}
              max={100}
              step={5}
              value={goalProgress}
              onChange={(e) => setGoalProgress(Number(e.target.value))}
              className="w-full accent-[var(--primary)]"
            />
          </div>
          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setGoalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="lg">
              Create goal
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
