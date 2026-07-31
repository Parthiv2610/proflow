"use client"

/**
 * Show an OS-level notification (works in Electron and modern browsers).
 * Requests permission the first time it's used, never throws.
 */
export function showNotification(title: string, body: string) {
  try {
    if (typeof window === "undefined" || !("Notification" in window)) return
    if (Notification.permission === "granted") {
      new Notification(title, { body })
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((p) => {
        if (p === "granted") new Notification(title, { body })
      })
    }
  } catch {
    // notifications unavailable — ignore
  }
}
