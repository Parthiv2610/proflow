"use client"

import { isCapacitor } from "./lan-sync"
import { scheduleReminder, cancelReminder } from "./reminders"
import { showNotification } from "./notify"
import type { Habit } from "@/components/proflow/store"

// Desktop: we store setTimeout handles so we can cancel them on app close / habit changes
const desktopTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()

// ── Desktop scheduling ────────────────────────────────────
// On desktop/web we can't use AlarmManager, so we compute the next fire time
// for each habit and set a setTimeout.  When the timer fires we show the
// notification via the browser's Notification API (showNotification), and
// re-schedule the next day's reminder.

function nextFireTime(reminderTime: string): number {
  const [h, m] = reminderTime.split(":").map(Number)
  const now = new Date()
  const fire = new Date(now)
  fire.setHours(h, m, 0, 0)
  // If the time already passed today, schedule for tomorrow
  if (fire.getTime() <= now.getTime()) {
    fire.setDate(fire.getDate() + 1)
  }
  return fire.getTime()
}

function scheduleDesktopReminder(habit: Habit) {
  if (!habit.reminderEnabled || !habit.reminderTime || !habit.week) return

  // Check if this habit is scheduled for tomorrow — if not, skip
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowDayIndex = (tomorrow.getDay() + 6) % 7 // Monday-first
  if (!habit.week[tomorrowDayIndex]) return

  // Also check today — if the time hasn't passed yet and today is a scheduled day
  const todayDayIndex = (now.getDay() + 6) % 7
  const todayScheduled = habit.week[todayDayIndex]

  const fireTimeMs = nextFireTime(habit.reminderTime)
  const delayMs = fireTimeMs - Date.now()

  if (delayMs < 0 || delayMs > 7 * 24 * 60 * 60 * 1000) return // safety: don't schedule >7 days out

  // Cancel existing timer if any
  cancelDesktopReminder(habit.id)

  const timer = setTimeout(() => {
    showNotification(
      "ProFlow 🔔",
      `Time for your habit: "${habit.name}" — streak: ${habit.streak} days`,
    )
    desktopTimers.delete(habit.id)
    // Re-schedule for the next occurrence
    scheduleDesktopReminder(habit)
  }, delayMs)

  desktopTimers.set(habit.id, timer)
}

function cancelDesktopReminder(habitId: string) {
  const existing = desktopTimers.get(habitId)
  if (existing) {
    clearTimeout(existing)
    desktopTimers.delete(habitId)
  }
}

// ── Android scheduling ────────────────────────────────────
// On Android, we use the native Reminders plugin (AlarmManager) so the
// notification fires even when ProFlow is closed.  We schedule a daily
// alarm for each enabled habit.

async function scheduleAndroidReminder(habit: Habit) {
  if (!habit.reminderEnabled || !habit.reminderTime || !habit.week) return

  const [h, m] = habit.reminderTime.split(":").map(Number)

  // Schedule for today if the time hasn't passed, otherwise tomorrow
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  today.setHours(h, m, 0, 0)

  let fireDate = today
  if (fireDate.getTime() <= now.getTime()) {
    // Time passed today — check tomorrow
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowDayIdx = (tomorrow.getDay() + 6) % 7
    if (!habit.week[tomorrowDayIdx]) return // not scheduled tomorrow
    fireDate = tomorrow
  } else {
    // Time is today — check if today is a scheduled day
    const todayDayIdx = (now.getDay() + 6) % 7
    if (!habit.week[todayDayIdx]) return
  }

  const at = fireDate.getTime()
  if (at <= now.getTime()) return

  const id = `habit-reminder-${habit.id}`
  await scheduleReminder(
    id,
    "ProFlow 🔔",
    `Time for your habit: "${habit.name}" — streak: ${habit.streak} days`,
    at,
  )
}

async function cancelAndroidReminder(habitId: string) {
  await cancelReminder(`habit-reminder-${habitId}`)
}

// ── Public API ────────────────────────────────────────────

/** Schedule or cancel reminders for a single habit. */
export async function syncHabitReminder(habit: Habit) {
  if (isCapacitor()) {
    // Android: cancel old, schedule new (if enabled)
    await cancelAndroidReminder(habit.id)
    if (habit.reminderEnabled && habit.reminderTime) {
      await scheduleAndroidReminder(habit)
    }
  } else {
    // Desktop: cancel old, schedule new (if enabled)
    cancelDesktopReminder(habit.id)
    if (habit.reminderEnabled && habit.reminderTime) {
      scheduleDesktopReminder(habit)
    }
  }
}

/** Re-sync all habit reminders — call on app load and when habits change. */
export async function syncAllHabitReminders(habits: Habit[]) {
  // Cancel everything first
  for (const [id] of desktopTimers) {
    cancelDesktopReminder(id)
  }
  // Schedule enabled ones
  for (const h of habits) {
    await syncHabitReminder(h)
  }
}

/** Cancel all habit reminders (e.g. on data reset). */
export async function cancelAllHabitReminders(habits: Habit[]) {
  for (const h of habits) {
    cancelDesktopReminder(h.id)
    if (isCapacitor()) {
      await cancelAndroidReminder(h.id)
    }
  }
}
