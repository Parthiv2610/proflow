"use client"

/**
 * Platform detection helpers. LAN sync was removed entirely — this file only
 * keeps the Capacitor (Android APK) check that the update system needs.
 */

/** True when running inside the Capacitor (Android APK) WebView. */
export function isCapacitor(): boolean {
  return (
    typeof window !== "undefined" &&
    !!(window as any).Capacitor?.isNativePlatform?.()
  )
}
