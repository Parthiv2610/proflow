"use client"

/**
 * True when running inside the Capacitor (Android APK) WebView. */
import { setSyncing, markSynced } from "./sync-state"
import { addConflict } from "./conflict-state"

export function isCapacitor(): boolean {
  return (
    typeof window !== "undefined" &&
    !!(window as any).Capacitor?.isNativePlatform?.()
  )
}

/** Get a friendly device name for the current client. */
function getDeviceName(): string {
  if (typeof window === "undefined") return "Unknown"
  const api = (window as any).electronAPI
  if (api?.isElectron) return "Desktop"
  if (isCapacitor()) {
    const ua = navigator.userAgent || ""
    // Extract device model from User-Agent (e.g. "Pixel 7" from "Pixel 7/13...")
    const match = ua.match(/\(([^)]+)\)/)
    const model = match ? match[1].split(";")[0].trim() : ""
    return model ? `📱 ${model}` : "📱 Phone"
  }
  const ua = navigator.userAgent || ""
  if (/android/i.test(ua)) return "📱 Android"
  if (/iphone|ipad/i.test(ua)) return "📱 iPhone"
  return "🌐 Web"
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

/**
 * Additive merge: only ADDS new items, never deletes.
 * - Arrays: items with new IDs are added, existing items are updated
 * - Numbers: takes the higher value
 * - Objects: new keys are added
 * - Everything else: overwritten (latest wins)
 */
function additiveMerge(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...existing }

  for (const [key, incomingValue] of Object.entries(incoming)) {
    const existingValue = result[key]

    // Array of objects with id — additive merge by id
    if (
      Array.isArray(incomingValue) &&
      incomingValue.length > 0 &&
      typeof incomingValue[0] === "object" &&
      incomingValue[0] !== null &&
      "id" in (incomingValue[0] as any)
    ) {
      const existingArr = Array.isArray(existingValue) ? existingValue : []
      const existingMap = new Map(existingArr.map((item: any) => [item.id, item]))
      let changed = false
      for (const item of incomingValue as any[]) {
        const localItem = existingMap.get(item.id)
        if (!localItem) {
          existingMap.set(item.id, item)
          changed = true
        } else {
          // Detect conflict: both sides modified the same item differently
          const remoteStr = JSON.stringify(item)
          const localStr = JSON.stringify(localItem)
          if (remoteStr !== localStr) {
            // Find a human-readable label
            const label = item.name || item.title || item.desc || item.id
            addConflict({
              storageKey: key,
              itemId: item.id,
              label: String(label).slice(0, 80),
              local: localItem,
              remote: item,
            })
          }
          // Default: remote wins (latest)
          existingMap.set(item.id, { ...localItem, ...item })
        }
      }
      if (changed || incomingValue.length > existingArr.length) {
        result[key] = Array.from(existingMap.values())
      }
    }
    // Number — take the higher value
    else if (
      typeof incomingValue === "number" &&
      typeof existingValue === "number"
    ) {
      result[key] = Math.max(existingValue, incomingValue)
    }
    // Object/Record — merge keys (additive)
    else if (
      typeof incomingValue === "object" &&
      incomingValue !== null &&
      !Array.isArray(incomingValue) &&
      typeof existingValue === "object" &&
      existingValue !== null &&
      !Array.isArray(existingValue)
    ) {
      result[key] = { ...(existingValue as any), ...(incomingValue as any) }
    }
    // Everything else — overwrite with latest
    else {
      result[key] = incomingValue
    }
  }

  return result
}

/** Merge incoming data additively into localStorage — never deletes existing items. */
function applyData(data: Record<string, unknown>) {
  // Read current data from localStorage
  const current: Record<string, unknown> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith("proflow-")) {
      const raw = localStorage.getItem(k)
      if (raw !== null) {
        try {
          current[k.slice("proflow-".length)] = JSON.parse(raw)
        } catch {
          current[k.slice("proflow-".length)] = raw
        }
      }
    }
  }

  // Additive merge: incoming items are added, existing items are never removed
  const merged = additiveMerge(current, data)

  // Write merged data back
  for (const [key, value] of Object.entries(merged)) {
    try {
      localStorage.setItem("proflow-" + key, JSON.stringify(value))
    } catch {}
  }

  // Notify React hooks to re-read from localStorage (for auto-sync pull)
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("proflow:synced"))
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
  setSyncing(true)
  try {
    const url = serverUrl.replace(/\/+$/, "") + "/sync"
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { "X-Device-Name": getDeviceName() },
    })
    if (!res.ok) throw new Error(`Server returned HTTP ${res.status} ${res.statusText}`)
    const json = await res.json()
    if (json.data) applyData(json.data)
    markSynced()
    return { status: "done", url: serverUrl, error: null }
  } catch (e: any) {
    setSyncing(false)
    let msg = e.message || "Failed to connect"
    msg = explainFetchError(msg, serverUrl)
    return { status: "error", url: serverUrl, error: msg }
  }
}

export async function pushToLan(serverUrl: string): Promise<LanSyncInfo> {
  setSyncing(true)
  try {
    const url = serverUrl.replace(/\/+$/, "") + "/sync"
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-Device-Name": getDeviceName() },
      body: JSON.stringify({ data: collectAllData() }),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) throw new Error(`Server returned HTTP ${res.status} ${res.statusText}`)
    markSynced()
    return { status: "done", url: serverUrl, error: null }
  } catch (e: any) {
    setSyncing(false)
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
    autoSync: localStorage.getItem("proflow-lan-autoSync") === "true",
  }
}

export function setLanConfig(config: { lastUrl?: string; autoConnect?: boolean; autoSync?: boolean }) {
  if (config.lastUrl !== undefined) localStorage.setItem("proflow-lan-lastUrl", config.lastUrl)
  if (config.autoConnect !== undefined) localStorage.setItem("proflow-lan-auto", String(config.autoConnect))
  if (config.autoSync !== undefined) localStorage.setItem("proflow-lan-autoSync", String(config.autoSync))
}

/**
 * Auto-sync: pushes local data to the server every 30 seconds,
 * and pulls fresh data every 45 seconds (bidirectional).
 * Call this in a useEffect. Returns a cleanup function.
 */
export function startAutoSync(
  serverUrl: string,
  onSync?: (result: LanSyncInfo) => void,
): () => void {
  if (!serverUrl) return () => {}

  let stopped = false

  // Push: send local data to server
  const push = async () => {
    if (stopped) return
    try {
      const result = await pushToLan(serverUrl)
      if (onSync && !stopped) onSync(result)
    } catch {}
  }

  // Pull: fetch data from server and apply locally
  const pull = async () => {
    if (stopped) return
    try {
      const result = await pullFromLan(serverUrl)
      if (onSync && !stopped) onSync(result)
    } catch {}
  }

  // Push immediately, then pull shortly after
  push()
  setTimeout(() => { if (!stopped) pull() }, 5000)

  // Push every 30s, pull every 45s (staggered so they don't collide)
  const pushInterval = setInterval(push, 30_000)
  const pullInterval = setInterval(pull, 45_000)

  return () => {
    stopped = true
    clearInterval(pushInterval)
    clearInterval(pullInterval)
  }
}
