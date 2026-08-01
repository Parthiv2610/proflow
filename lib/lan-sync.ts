"use client"

/**
 * Renderer-side LAN sync support.
 *
 * Four possible modes:
 *  - "electron" — running inside the desktop app. The laptop hosts the LAN
 *    server; the renderer talks to it through IPC (preload bridge).
 *  - "phone"    — this page was served by the laptop's LAN server (phone
 *    browser on the same Wi-Fi). Syncs by polling the same origin's API.
 *  - "cap"      — running inside the Android APK (Capacitor WebView). The app
 *    is NOT served by the laptop, so it stores the laptop's LAN URL and syncs
 *    against that absolute URL.
 *  - "none"     — plain web (e.g. Vercel) or dev — no LAN sync.
 */

export type SyncSnapshot = {
  collections: Record<string, { v: number; items: unknown }>
}

export type LanInfo = {
  mode: "electron" | "phone" | "cap" | "none"
  enabled: boolean
  url: string | null
  ip: string | null
  /** All candidate LAN addresses, most-likely-reachable first. */
  ips?: string[]
  port: number
  passcode: string | null
  host: string | null
}

const PASSCODE_KEY = "proflow-lan-code"
const ENABLED_KEY = "proflow-lan-enabled"
const LAPTOP_URL_KEY = "proflow-laptop-url"

export function getStoredPasscode(): string {
  try {
    return localStorage.getItem(PASSCODE_KEY) || ""
  } catch {
    return ""
  }
}

export function storePasscode(code: string) {
  try {
    localStorage.setItem(PASSCODE_KEY, code)
  } catch {
    // storage unavailable
  }
}

export function clearPasscode() {
  try {
    localStorage.removeItem(PASSCODE_KEY)
  } catch {
    // storage unavailable
  }
}

export function getStoredEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === "1"
  } catch {
    return false
  }
}

export function setStoredEnabled(on: boolean) {
  try {
    if (on) localStorage.setItem(ENABLED_KEY, "1")
    else localStorage.removeItem(ENABLED_KEY)
  } catch {
    // storage unavailable
  }
}

/** True when running inside the Capacitor (Android APK) WebView. */
export function isCapacitor(): boolean {
  return (
    typeof window !== "undefined" &&
    !!(window as any).Capacitor?.isNativePlatform?.()
  )
}

export function getStoredLaptopUrl(): string {
  try {
    return localStorage.getItem(LAPTOP_URL_KEY) || ""
  } catch {
    return ""
  }
}

export function setStoredLaptopUrl(url: string) {
  try {
    const clean = (url || "").trim().replace(/\/+$/, "")
    if (clean) localStorage.setItem(LAPTOP_URL_KEY, clean)
    else localStorage.removeItem(LAPTOP_URL_KEY)
  } catch {
    // storage unavailable
  }
}

/** Build the LanInfo object for cap mode from a laptop URL. */
export function buildCapLanInfo(url: string): LanInfo {
  let ip: string | null = null
  let port = 5174
  try {
    const u = new URL(url)
    ip = u.hostname
    port = u.port ? Number(u.port) : 5174
  } catch {
    // fall back to defaults
  }
  const clean = url.trim().replace(/\/+$/, "")
  return {
    mode: "cap",
    enabled: !!clean,
    url: clean || null,
    ip,
    port,
    passcode: getStoredPasscode() || null,
    host: null,
  }
}

/** The API base for cap mode (the laptop URL); "" means same-origin. */
function apiBase(): string {
  if (isCapacitor()) return getStoredLaptopUrl()
  return ""
}

/**
 * Figure out which sync mode this page is running in.
 * Returns null when there is no LAN sync at all.
 */
export async function detectLan(): Promise<LanInfo | null> {
  // 1) Electron desktop app
  const api = (window as any).electronAPI
  if (api?.lanGetStatus) {
    try {
      const status = await api.lanGetStatus()
      return {
        mode: "electron",
        enabled: !!status.enabled,
        url: status.url || null,
        ip: status.ip || null,
        ips: Array.isArray(status.ips) ? status.ips : status.ip ? [status.ip] : [],
        port: status.port || 5174,
        passcode: status.passcode || null,
        host: status.host || null,
      }
    } catch {
      return null
    }
  }

  // 2) Android APK (Capacitor WebView) — link to the laptop URL directly
  if (isCapacitor()) {
    return buildCapLanInfo(getStoredLaptopUrl())
  }

  // 3) Phone/browser served by the laptop's LAN server
  try {
    const res = await fetch("/api/info", { cache: "no-store" })
    if (res.headers.get("x-proflow-lan") === "1") {
      let host: string | null = null
      try {
        const info = await res.json()
        host = info?.host || null
      } catch {
        // header is enough
      }
      return {
        mode: "phone",
        enabled: true,
        url: window.location.origin,
        ip: window.location.hostname,
        port: Number(window.location.port) || 5174,
        passcode: getStoredPasscode() || null,
        host,
      }
    }
  } catch {
    // not served by our server — not LAN mode
  }

  return null
}

type PullResult = { snap: SyncSnapshot | null; authed: boolean; reachable: boolean }

/** Pull the laptop's current state (same-origin in phone mode, absolute URL in cap mode). */
export async function lanPull(): Promise<PullResult> {
  try {
    const code = getStoredPasscode()
    const base = apiBase()
    // In the APK with no laptop URL configured yet, there is nothing to reach —
    // don't fall back to a same-origin fetch (the WebView has no LAN server).
    if (isCapacitor() && !base) return { snap: null, authed: false, reachable: false }
    const res = await fetch(`${base}/api/state`, {
      headers: { "X-ProFlow-Passcode": code },
      cache: "no-store",
    })
    if (res.status === 401) return { snap: null, authed: false, reachable: true }
    if (!res.ok) return { snap: null, authed: false, reachable: true }
    const data = await res.json()
    return {
      snap: data && data.collections ? (data as SyncSnapshot) : null,
      authed: true,
      reachable: true,
    }
  } catch {
    return { snap: null, authed: false, reachable: false }
  }
}

/** Push our state to the laptop (same-origin in phone mode, absolute URL in cap mode). */
export async function lanPushSnapshot(snap: SyncSnapshot): Promise<boolean> {
  try {
    const code = getStoredPasscode()
    const base = apiBase()
    if (isCapacitor() && !base) return false
    const res = await fetch(`${base}/api/state`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-ProFlow-Passcode": code },
      body: JSON.stringify(snap),
      cache: "no-store",
    })
    return res.ok
  } catch {
    return false
  }
}
