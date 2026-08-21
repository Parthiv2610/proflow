"use client"

import { useState } from "react"
import { Check, CheckCircle2, Flame, Bell, BellOff, Pencil, Plus, Shield, Target, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  FREE_SHIELD_EVERY_LEVELS,
  HABIT_SHIELD_PRICE,
  levelFor,
  MAX_HABIT_SHIELDS,
  MAX_SHIELDS,
  nextShieldMilestone,
  SHIELD_PRICE,
  useStore,
} from "../store"
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
    updateHabit,
    deleteHabit,
    addGoal,
    updateGoal,
    deleteGoal,
    xp,
    streakShields,
    buyShield,
    buyHabitShield,
  } = useStore()
  const doneToday = habits.filter((h) => h.doneToday).length
  const [justBought, setJustBought] = useState(false)
  const [notEnough, setNotEnough] = useState(false)
  const [miniBought, setMiniBought] = useState<string | null>(null)

  const handleBuyMini = (id: string) => {
    if (buyHabitShield(id)) {
      setMiniBought(id)
      setTimeout(() => setMiniBought(null), 2500)
    }
  }

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

  // add/edit-habit modal state — `editingHabit` non-null means the modal edits
  // an existing habit (same form, pre-filled) instead of creating one.
  const [habitOpen, setHabitOpen] = useState(false)
  const [habitName, setHabitName] = useState("")
  const [habitWeek, setHabitWeek] = useState<boolean[]>([true, true, true, true, true, true, false])
  const [habitReminderEnabled, setHabitReminderEnabled] = useState(false)
  const [habitReminderTime, setHabitReminderTime] = useState("09:00")
  const [editingHabit, setEditingHabit] = useState<(typeof habits)[number] | null>(null)

  // add-goal modal state
  const [goalOpen, setGoalOpen] = useState(false)
  const [goalName, setGoalName] = useState("")
  const [goalProgress, setGoalProgress] = useState(0)

  const DEFAULT_WEEK = [true, true, true, true, true, true, false]

  const openAddHabit = () => {
    setEditingHabit(null)
    setHabitName("")
    setHabitWeek(DEFAULT_WEEK)
    setHabitReminderEnabled(false)
    setHabitReminderTime("09:00")
    setHabitOpen(true)
  }

  const openEditHabit = (h: (typeof habits)[number]) => {
    setEditingHabit(h)
    setHabitName(h.name)
    setHabitWeek([...h.week])
    setHabitReminderEnabled(h.reminderEnabled ?? false)
    setHabitReminderTime(h.reminderTime ?? "09:00")
    setHabitOpen(true)
  }

  const submitHabit = (e: React.FormEvent) => {
    e.preventDefault()
    const name = habitName.trim()
    if (!name) return
    if (editingHabit) {
      updateHabit(editingHabit.id, {
        name,
        week: habitWeek,
        reminderEnabled: habitReminderEnabled,
        reminderTime: habitReminderTime,
      })
    } else {
      addHabit(name, habitWeek, habitReminderEnabled, habitReminderTime)
    }
    setHabitName("")
    setHabitWeek(DEFAULT_WEEK)
    setHabitReminderEnabled(false)
    setHabitReminderTime("09:00")
    setEditingHabit(null)
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
          <Button variant="secondary" onClick={openAddHabit}>
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
              Miss a day and a shield keeps your streak alive — up to {MAX_SHIELDS} shared, or {HABIT_SHIELD_PRICE} XP per habit.
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
              <button
                type="button"
                onClick={() => openEditHabit(h)}
                aria-label={`Edit ${h.name}`}
                className="group/habit flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-sm font-medium", h.doneToday && "text-foreground")}>{h.name}</span>
                  <span className="mt-1.5 flex items-center gap-1">
                    {h.week.map((on, i) => (
                      <span key={i} className={cn("size-2 rounded-full", on ? "bg-focus" : "bg-muted")} title={weekDays[i]} />
                    ))}
                  </span>
                </span>
                <Pencil className="size-3.5 shrink-0 text-muted-foreground/60 opacity-0 transition-opacity group-hover/habit:opacity-100 group-focus-within:opacity-100" />
              </button>
              <div className="flex items-center gap-1.5 rounded-lg bg-focus/10 px-2.5 py-1 text-focus">
                <Flame className="size-3.5" />
                <span className="text-sm font-semibold">{h.streak}</span>
              </div>
              <button
                type="button"
                onClick={() => handleBuyMini(h.id)}
                disabled={(h.shields ?? 0) >= MAX_HABIT_SHIELDS || xp < HABIT_SHIELD_PRICE}
                title={
                  (h.shields ?? 0) >= MAX_HABIT_SHIELDS
                    ? "Max mini shields"
                    : `Buy a mini shield for this habit (${HABIT_SHIELD_PRICE} XP)`
                }
                className={cn(
                  "flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition-colors",
                  (h.shields ?? 0) > 0
                    ? "bg-focus/10 text-focus hover:bg-focus/20"
                    : "bg-muted/40 text-muted-foreground hover:bg-focus/15 hover:text-focus",
                  ((h.shields ?? 0) >= MAX_HABIT_SHIELDS || xp < HABIT_SHIELD_PRICE) &&
                    "cursor-not-allowed opacity-50",
                )}
              >
                {miniBought === h.id ? (
                  <CheckCircle2 className="size-3.5 text-success" />
                ) : (
                  <Shield className="size-3.5" />
                )}
                {(h.shields ?? 0)}/{MAX_HABIT_SHIELDS}
              </button>
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
                <p className="truncate text-sm font-semibold">{g.name}</p>
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
        onClose={() => {
          setHabitOpen(false)
          setEditingHabit(null)
        }}
        title={editingHabit ? "Edit habit" : "Add a habit"}
        description={editingHabit ? "Update the name and schedule." : "A habit you want to build."}
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
          {/* Reminder toggle + time */}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">Reminder</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setHabitReminderEnabled(!habitReminderEnabled)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  habitReminderEnabled
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {habitReminderEnabled ? <Bell className="size-4" /> : <BellOff className="size-4" />}
                {habitReminderEnabled ? "On" : "Off"}
              </button>
              {habitReminderEnabled && (
                <input
                  type="time"
                  value={habitReminderTime}
                  onChange={(e) => setHabitReminderTime(e.target.value)}
                  className="h-9 w-32 rounded-lg border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                />
              )}
            </div>
            {habitReminderEnabled && (
              <p className="text-xs text-muted-foreground">
                You&apos;ll be notified at {habitReminderTime} on scheduled days.
              </p>
            )}
          </div>
          <div className="mt-1 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setHabitOpen(false)
                setEditingHabit(null)
              }}
            >
              Cancel
            </Button>
            <Button type="submit" size="lg">
              {editingHabit ? "Save changes" : "Create habit"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={goalOpen} onClose={() => setGoalOpen(false)} title="Add a goal" description="A goal you're working toward.">
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
