"use client"

/**
 * True when running inside the Capacitor (Android APK) WebView. */
export function isCapacitor(): boolean {
  return (
    typeof window !== "undefined" &&
    !!(window as any).Capacitor?.isNativePlatform?.()
  )
}

/**
 * LAN Sync — sync data between devices on the same WiFi network.
 *
 * One device starts a temporary HTTP server, the other connects as a client.
 * No internet required — works entirely on your local network.
 */

export type LanSyncStatus =
  | "idle"
  | "starting"
  | "running"
  | "connecting"
  | "syncing"
  | "done"
  | "error"

export type LanSyncInfo = {
  status: LanSyncStatus
  url: string | null
  error: string | null
}

const SYNC_PORT = 7777

// ── Data helpers ──

function collectAllData(): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith("proflow-")) {
        const raw = localStorage.getItem(k)
        if (raw !== null) {
          try {
            data[k.slice("proflow-".length)] = JSON.parse(raw)
          } catch {
            data[k.slice("proflow-".length)] = raw
          }
        }
      }
    }
  } catch {}
  return data
}

function applyData(data: Record<string, unknown>) {
  for (const [key, value] of Object.entries(data)) {
    try {
      localStorage.setItem("proflow-" + key, JSON.stringify(value))
    } catch {}
  }
}

// ── Server side (Desktop / Electron) ──

export async function startLanServer(): Promise<LanSyncInfo> {
  try {
    const api = (window as any).electronAPI
    if (!api?.startLanSync) {
      return {
        status: "error",
        url: null,
        error: "LAN server requires the desktop (Electron) app — not available on mobile or web",
      }
    }

    const result = await api.startLanSync({
      port: SYNC_PORT,
      data: collectAllData(),
    })

    if (result?.error) {
      return { status: "error", url: null, error: result.error }
    }

    const ip = result?.localIp || "localhost"
    return {
      status: "running",
      url: `http://${ip}:${SYNC_PORT}`,
      error: null,
    }
  } catch (e: any) {
    return { status: "error", url: null, error: e.message || "Failed to start server" }
  }
}

export async function stopLanServer(): Promise<void> {
  try {
    const api = (window as any).electronAPI
    if (api?.stopLanSync) await api.stopLanSync()
  } catch {}
}

// ── Client side (Phone / any device) ──

export async function pullFromLan(serverUrl: string): Promise<LanSyncInfo> {
  try {
    const url = serverUrl.replace(/\/+$/, "") + "/sync"
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) throw new Error(`Server returned HTTP ${res.status} ${res.statusText}`)
    const json = await res.json()
    if (json.data) applyData(json.data)
    return { status: "done", url: serverUrl, error: null }
  } catch (e: any) {
    let msg = e.message || "Failed to connect"
    msg = explainFetchError(msg, serverUrl)
    return { status: "error", url: serverUrl, error: msg }
  }
}

export async function pushToLan(serverUrl: string): Promise<LanSyncInfo> {
  try {
    const url = serverUrl.replace(/\/+$/, "") + "/sync"
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: collectAllData() }),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) throw new Error(`Server returned HTTP ${res.status} ${res.statusText}`)
    return { status: "done", url: serverUrl, error: null }
  } catch (e: any) {
    let msg = e.message || "Failed to connect"
    msg = explainFetchError(msg, serverUrl)
    return { status: "error", url: serverUrl, error: msg }
  }
}

function explainFetchError(msg: string, serverUrl: string): string {
  if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
    // Check if this looks like a localhost URL (common mistake on mobile)
    if (serverUrl.includes("localhost") || serverUrl.includes("127.0.0.1")) {
      return `Cannot reach ${serverUrl} — on mobile, use the PC's LAN IP (e.g. http://192.168.1.x:7777), NOT localhost. Both devices must be on the same WiFi.`
    }
    return `Cannot reach server at ${serverUrl}.\n\nTroubleshooting:\n1. Make sure both devices are on the same WiFi network\n2. Make sure the ProFlow server is running on the other device\n3. Try opening ${serverUrl} in your phone's browser — if it shows text, the server is reachable\n4. Check if your router has "AP isolation" or "client isolation" enabled (disable it)`
  }
  if (msg.includes("timeout"))
    return `Connection timed out — server at ${serverUrl} may be unreachable. Try opening the URL in your phone's browser first.`
  return msg
}

export function getLanConfig() {
  return {
    lastUrl: localStorage.getItem("proflow-lan-lastUrl") || "",
    autoConnect: localStorage.getItem("proflow-lan-auto") === "true",
  }
}

export function setLanConfig(config: { lastUrl?: string; autoConnect?: boolean }) {
  if (config.lastUrl !== undefined) localStorage.setItem("proflow-lan-lastUrl", config.lastUrl)
  if (config.autoConnect !== undefined) localStorage.setItem("proflow-lan-auto", String(config.autoConnect))
}
