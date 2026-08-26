"use client"

import { isCapacitor } from "./lan-sync"

/**
 * Bridge to the native Android Reminders plugin (AlarmManager + OS
 * notifications). The Capacitor WebView has no web Notification API, so
 * ProFlow schedules real "ping me before my event" alerts through this plugin
 * — they fire even when the app is closed. Every call is a safe no-op on
 * desktop/web.
 */

type RemindersPluginApi = {
  schedule?: (opts: { id: string; title: string; body: string; at: number }) => Promise<unknown>
  cancel?: (opts: { id: string }) => Promise<unknown>
  cancelAll?: () => Promise<unknown>
  requestPermission?: () => Promise<{ granted: boolean }>
  hasPermission?: () => Promise<{ granted: boolean }>
}

function plugin(): RemindersPluginApi | null {
  if (!isCapacitor()) return null
  return (window as any)?.Capacitor?.Plugins?.Reminders ?? null
}

/** True when running inside an APK that has the native Reminders plugin. */
export function remindersSupported(): boolean {
  return !!plugin()
}

/** Ask for the POST_NOTIFICATIONS permission once (Android 13+). */
export async function requestReminderPermission(): Promise<boolean> {
  try {
    const res = await plugin()?.requestPermission?.()
    return !!res?.granted
  } catch {
    return false
  }
}

/** Schedule an OS notification at `at` (epoch millis). No-op off Android. */
export async function scheduleReminder(id: string, title: string, body: string, at: number) {
  try {
    await plugin()?.schedule?.({ id, title, body, at })
  } catch {
    // permission denied or scheduling failure — the reminder is skipped
  }
}

/** Cancel one scheduled reminder (and any already-shown notification). */
export async function cancelReminder(id: string) {
  try {
    await plugin()?.cancel?.({ id })
  } catch {
    // nothing to cancel
  }
}

/** Cancel every reminder this plugin has scheduled (used by data reset). */
export async function cancelAllReminders() {
  try {
    await plugin()?.cancelAll?.()
  } catch {
    // nothing to cancel
  }
}
