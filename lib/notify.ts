"use client";

import { isCapacitor } from "./lan-sync";

/** Lazy accessor for the native Notification plugin. */
function nativePlugin() {
  if (!isCapacitor()) return null;
  return (window as any)?.Capacitor?.Plugins?.Notification ?? null;
}

/**
 * Show a notification. Every call is also recorded as an in-app notification
 * (the bell badge + Notifications page) via a window event.
 *
 * On Android (Capacitor) the web Notification API is unavailable, so we post
 * through the native NotificationPlugin which shows a real system notification
 * in the tray and lock screen. On desktop we use the browser Notification API.
 *
 * Requests OS permission the first time it's used on Android; never throws.
 */
export function showNotification(title: string, body: string) {
  try {
    // Always record in-app — this works everywhere.
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("proflow-notification", { detail: { title, body } }));
    }

    // Android: post via native plugin (system notification tray).
    const native = nativePlugin();
    if (native) {
      native.notify({ title, body }).catch(() => {
        // Permission denied or plugin missing — in-app notification still works.
      });
      return;
    }

    // Desktop/browser: use the standard Notification API.
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "granted") {
      new Notification(title, { body });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((p) => {
        if (p === "granted") new Notification(title, { body });
      });
    }
  } catch {
    // notifications unavailable — in-app fallback still recorded above
  }
}

/**
 * Request notification permission on Android (13+) at app startup.
 * Safe to call on desktop — no-op. Call once from a top-level component.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  const native = nativePlugin();
  if (!native) {
    // Desktop: use browser API.
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") return true;
      if (Notification.permission !== "denied") {
        const result = await Notification.requestPermission();
        return result === "granted";
      }
    }
    return false;
  }
  try {
    const res = await native.requestPermission();
    return !!res?.granted;
  } catch {
    return false;
  }
}
