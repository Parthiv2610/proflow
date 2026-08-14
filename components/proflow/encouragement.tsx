"use client"

import { useMemo } from "react"
import { Sparkles, Star } from "lucide-react"
import { levelFor, levelName, xpForNextLevel, xpIntoLevel, useStore } from "./store"
import { Card, ProgressBar } from "./ui"

// Gentle, non-pressuring one-liners — rotated daily (seeded by date) so the
// card always feels fresh but never naggy.
const QUOTES = [
  "Small steps every day add up to big results.",
  "You don't have to be great to start, but you have to start to be great.",
  "Finished is better than perfect.",
  "One task at a time — that's all it takes.",
  "Progress, not perfection.",
  "You showed up today. That's already a win.",
  "The best time to plant a tree was 20 years ago. The second best time is now.",
  "Focus on the next small thing, not the whole mountain.",
  "Rest is productive too. Be kind to yourself.",
  "A little progress each day adds up to big results.",
  "You're building something — be proud of the process.",
  "Start where you are. Use what you have. Do what you can.",
]

/** Context-aware nudge based on what you've actually done today. */
function nudge(
  doneTasks: number,
  activeLeft: number,
  habitsDone: number,
  habitsTotal: number,
  weekHours: number,
  streak: number,
): string {
  if (streak > 0 && streak % 7 === 0) {
    return `🎉 ${streak}-day focus streak — that's seriously consistent.`
  }
  if (doneTasks >= 5) return `🔥 ${doneTasks} tasks done today — you're on fire.`
  if (doneTasks >= 3) return `✨ ${doneTasks} tasks knocked out. Keep the ball rolling!`
  if (weekHours >= 5) return `💪 ${weekHours} hrs of focus this week — impressive.`
  if (habitsTotal > 0 && habitsDone === habitsTotal) {
    return `✅ All ${habitsTotal} habit${habitsTotal > 1 ? "s" : ""} done today. Perfect attendance!`
  }
  if (activeLeft === 0 && doneTasks > 0) return `🏁 All tasks done — time to enjoy the win.`
  if (habitsTotal > 0 && habitsDone > 0) {
    return `🌱 ${habitsDone}/${habitsTotal} habits done. Keep the chain going.`
  }
  if (doneTasks === 1) return `🌟 First task done. You're moving!`
  return `🌤️ No pressure — even one small task is a win today.`
}

export function EncouragementCard() {
  const { tasks, habits, focusLog, xp } = useStore()

  const quote = useMemo(() => {
    const d = new Date()
    const dayOfYear = Math.floor(
      (d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86_400_000,
    )
    return QUOTES[dayOfYear % QUOTES.length]
  }, [])

  const done = tasks.filter((t) => t.status === "done").length
  const activeLeft = tasks.filter((t) => t.status !== "done").length
  const habitsDone = habits.filter((h) => h.doneToday).length
  const weekHours = useMemo(() => {
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

  const streak = useMemo(() => {
    const keys = new Set(focusLog.map((e) => e.date))
    let n = 0
    const d = new Date()
    const mk = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`
    if (!keys.has(mk(d))) d.setDate(d.getDate() - 1)
    while (keys.has(mk(d))) {
      n++
      d.setDate(d.getDate() - 1)
    }
    return n
  }, [focusLog])

  const level = levelFor(xp)
  const into = xpIntoLevel(xp)
  const need = xpForNextLevel(level)
  const pct = Math.min(100, Math.round((into / need) * 100))

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:gap-8">
        {/* Quote + nudge */}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            <Sparkles className="size-3.5 text-primary" />
            A little encouragement
          </p>
          <p className="mt-2 text-base font-medium text-balance text-foreground">“{quote}”</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {nudge(done, activeLeft, habitsDone, habits.length, weekHours, streak)}
          </p>
        </div>

        {/* Level + XP progress */}
        <div className="min-w-64 flex-1 shrink-0 lg:max-w-xs">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Star className="size-4 fill-primary text-primary" />
              Level {level} · {levelName(level)}
            </p>
            <span className="text-xs font-medium text-muted-foreground tabular-nums">
              {xp} XP
            </span>
          </div>
          <ProgressBar value={pct} tone="primary" className="mt-2" />
          <p className="mt-1.5 text-xs text-muted-foreground">
            {need - into} XP to Level {level + 1} — tasks, habits and focus count.
          </p>
        </div>
      </div>
    </Card>
  )
}
