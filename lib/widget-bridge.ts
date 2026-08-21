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
