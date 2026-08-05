"use client"

/**
 * Show a notification. Every call is also recorded as an in-app notification
 * (the bell badge + Notifications page) via a window event — on Android the
 * WebView has no OS Notification API, so the in-app center is the only place
 * the user sees these. Requests OS permission the first time it's used, never
 * throws.
 */
export function showNotification(title: string, body: string) {
  try {
    // In-app record first — independent of OS permission/availability.
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("proflow-notification", { detail: { title, body } }))
    }
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
