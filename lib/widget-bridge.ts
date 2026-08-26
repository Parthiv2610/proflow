"use client"

import { isCapacitor } from "./lan-sync"

/**
 * Bridge to push today's summary data into Android SharedPreferences
 * so the home-screen widgets can display it. Every call is a safe
 * no-op on desktop/web.
 */

type WidgetBridgeApi = {
  updateToday?: (opts: {
    tasksDone: number
    habitsDone: number
    focusMinutes: number
    streak: number
    pendingTasks: string
  }) => Promise<unknown>
  updateHabits?: (opts: { habits: string }) => Promise<unknown>
  updateTasks?: (opts: { tasks: string }) => Promise<unknown>
}

function plugin(): WidgetBridgeApi | null {
  if (!isCapacitor()) return null
  return (window as any)?.Capacitor?.Plugins?.WidgetBridge ?? null
}

/** Push today's summary to the native widgets. Call on every relevant store change. */
export async function updateWidgets(data: {
  tasksDone: number
  habitsDone: number
  focusMinutes: number
  streak: number
  pendingTasks: string
}) {
  try {
    await plugin()?.updateToday?.(data)
  } catch {
    // widget bridge unavailable — ignore
  }
}

/** Push habit list data for the interactive habits widget. */
export async function updateHabitWidget(habitsData: string) {
  try {
    await plugin()?.updateHabits?.({ habits: habitsData })
  } catch {
    // ignore
  }
}

/** Push task list data for the interactive tasks widget. */
export async function updateTaskWidget(tasksData: string) {
  try {
    await plugin()?.updateTasks?.({ tasks: tasksData })
  } catch {
    // ignore
  }
}

// Listen for widget toggle broadcasts from native and dispatch them to the store
export function onWidgetToggle(callback: (type: "habit" | "task", id: string) => void) {
  if (typeof window === "undefined") return
  window.addEventListener("message", (e: any) => {
    if (e?.data?.type === "WIDGET_HABIT_TOGGLE") callback("habit", e.data.id)
    if (e?.data?.type === "WIDGET_TASK_TOGGLE") callback("task", e.data.id)
  })
}
