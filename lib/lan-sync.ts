"use client"

/**
 * Renderer-side LAN sync support.
 *
 * Three possible modes:
 *  - "electron" — running inside the desktop app. The laptop hosts the LAN
 *    server; the renderer talks to it through IPC (preload bridge).
 *  - "phone"    — this page was served by the laptop's LAN server (phone
 *    browser on the same Wi-Fi). Syncs by polling the same origin's API.
 *  - "none"     — plain web (e.g. Vercel) or dev — no LAN sync.
 */

export type SyncSnapshot = {
  collections: Record<string, { v: number; items: unknown }>
}

export type LanInfo = {
  mode: "electron" | "phone" | "none"
  enabled: boolean
  url: string | null
  ip: string | null
  port: number
  passcode: string | null
  host: string | null
}

const PASSCODE_KEY = "proflow-lan-code"
const ENABLED_KEY = "proflow-lan-enabled"

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
        port: status.port || 5174,
        passcode: status.passcode || null,
        host: status.host || null,
      }
    } catch {
      return null
    }
  }

  // 2) Phone/browser served by the laptop's LAN server
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

/** Phone transport: fetch the laptop's current state. */
export async function lanPull(): Promise<PullResult> {
  try {
    const code = getStoredPasscode()
    const res = await fetch("/api/state", {
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

/** Phone transport: push our state to the laptop. */
export async function lanPushSnapshot(snap: SyncSnapshot): Promise<boolean> {
  try {
    const code = getStoredPasscode()
    const res = await fetch("/api/state", {
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
