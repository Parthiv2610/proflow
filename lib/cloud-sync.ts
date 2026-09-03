"use client"

/**
 * Cloud Sync — sync ProFlow data across devices using Supabase (free tier).
 *
 * Setup:
 *   1. Go to https://supabase.com → Create free project
 *   2. Go to SQL Editor → paste the CREATE TABLE from `getSetupSQL()`
 *   3. Copy Project URL + anon key from Settings → API
 *   4. Paste into ProFlow Settings → Cloud Sync
 *
 * All data stays in your Supabase — no third-party servers involved.
 */

import { setSyncing, markSynced } from "./sync-state"
import { addConflict } from "./conflict-state"

export type CloudSyncStatus = "idle" | "connecting" | "syncing" | "done" | "error"

export type CloudSyncInfo = {
  status: CloudSyncStatus
  error: string | null
  lastSynced: number | null // epoch ms
  connectedDevices: number
}

// SQL to create the sync table in Supabase:
export function getSetupSQL(): string {
  return `CREATE TABLE IF NOT EXISTS proflow_sync (
  id TEXT PRIMARY KEY DEFAULT 'default',
  user_id TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS so only your user_id can access their data
ALTER TABLE proflow_sync ENABLE ROW LEVEL SECURITY;

-- Allow all operations for anon key (your devices use the anon key)
CREATE POLICY "Allow all for anon" ON proflow_sync
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index for fast lookups by user_id
CREATE INDEX IF NOT EXISTS idx_proflow_sync_user ON proflow_sync(user_id);`
}

// ── Config (stored in localStorage) ──

export type CloudConfig = {
  url: string      // Supabase project URL
  anonKey: string  // Supabase anon/public key
  userId: string   // Unique user identifier (auto-generated)
}

export function getCloudConfig(): CloudConfig | null {
  try {
    const url = localStorage.getItem("proflow-cloud-url") || ""
    const anonKey = localStorage.getItem("proflow-cloud-key") || ""
    const userId = localStorage.getItem("proflow-cloud-userId") || ""
    if (!url || !anonKey || !userId) return null
    return { url: url.replace(/\/+$/, ""), anonKey, userId }
  } catch {
    return null
  }
}

export function setCloudConfig(config: { url?: string; anonKey?: string; userId?: string }) {
  if (config.url !== undefined) localStorage.setItem("proflow-cloud-url", config.url)
  if (config.anonKey !== undefined) localStorage.setItem("proflow-cloud-key", config.anonKey)
  if (config.userId !== undefined) localStorage.setItem("proflow-cloud-userId", config.userId)
}

export function generateUserId(): string {
  return `user-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function clearCloudConfig() {
  localStorage.removeItem("proflow-cloud-url")
  localStorage.removeItem("proflow-cloud-key")
  localStorage.removeItem("proflow-cloud-userId")
}

// ── Data collection (same as LAN sync) ──

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

// ── Additive merge (same logic as LAN sync) ──

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

function applyData(data: Record<string, unknown>) {
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

  const merged = additiveMerge(current, data)

  for (const [key, value] of Object.entries(merged)) {
    try {
      localStorage.setItem("proflow-" + key, JSON.stringify(value))
    } catch {}
  }

  // Notify React hooks to re-read from localStorage
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("proflow:synced"))
  }
}

// ── Supabase REST API helpers ──

async function supabaseRequest(
  config: CloudConfig,
  table: string,
  method: string,
  body?: any,
  params?: Record<string, string>,
): Promise<any> {
  let url = `${config.url}/rest/v1/${table}`
  if (params) {
    const qs = new URLSearchParams(params).toString()
    url += `?${qs}`
  }

  const headers: Record<string, string> = {
    "apikey": config.anonKey,
    "Authorization": `Bearer ${config.anonKey}`,
    "Content-Type": "application/json",
    "Prefer": method === "POST" || method === "PATCH" ? "return=representation" : "return=minimal",
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Supabase ${res.status}: ${text.slice(0, 200) || res.statusText}`)
  }

  // PATCH/POST with return=representation returns an array
  const contentType = res.headers.get("content-type") || ""
  if (contentType.includes("application/json")) {
    return res.json()
  }
  return null
}

// ── Public API ──

/** Test the connection and create the row if needed */
export async function connectCloud(config: CloudConfig): Promise<CloudSyncInfo> {
  setSyncing(true)
  try {
    // Try to read existing data
    const rows = await supabaseRequest(config, "proflow_sync", "GET", undefined, {
      user_id: `eq.${config.userId}`,
      select: "*",
    })

    if (!rows || rows.length === 0) {
      // First time — create the row with current local data
      const localData = collectAllData()
      await supabaseRequest(config, "proflow_sync", "POST", {
        id: config.userId,
        user_id: config.userId,
        data: localData,
        updated_at: new Date().toISOString(),
      })
    } else {
      // Row exists — merge cloud data into local
      applyData(rows[0].data || {})
    }

    markSynced()
    return { status: "done", error: null, lastSynced: Date.now(), connectedDevices: 1 }
  } catch (e: any) {
    return { status: "error", error: e.message || "Connection failed", lastSynced: null, connectedDevices: 0 }
  } finally {
    setSyncing(false)
  }
}

/** Push local data to cloud */
export async function pushToCloud(): Promise<CloudSyncInfo> {
  const config = getCloudConfig()
  if (!config) return { status: "error", error: "Not connected", lastSynced: null, connectedDevices: 0 }

  setSyncing(true)
  try {
    const localData = collectAllData()
    await supabaseRequest(config, "proflow_sync", "PATCH", {
      data: localData,
      updated_at: new Date().toISOString(),
    }, {
      user_id: `eq.${config.userId}`,
    })

    markSynced()
    return { status: "done", error: null, lastSynced: Date.now(), connectedDevices: 1 }
  } catch (e: any) {
    setSyncing(false)
    return { status: "error", error: e.message || "Push failed", lastSynced: null, connectedDevices: 0 }
  }
}

/** Pull data from cloud */
export async function pullFromCloud(): Promise<CloudSyncInfo> {
  const config = getCloudConfig()
  if (!config) return { status: "error", error: "Not connected", lastSynced: null, connectedDevices: 0 }

  setSyncing(true)
  try {
    const rows = await supabaseRequest(config, "proflow_sync", "GET", undefined, {
      user_id: `eq.${config.userId}`,
      select: "data",
    })

    if (rows && rows.length > 0 && rows[0].data) {
      applyData(rows[0].data)
    }

    markSynced()
    return { status: "done", error: null, lastSynced: Date.now(), connectedDevices: 1 }
  } catch (e: any) {
    setSyncing(false)
    return { status: "error", error: e.message || "Pull failed", lastSynced: null, connectedDevices: 0 }
  }
}

/** Full sync: push then pull */
export async function syncCloud(): Promise<CloudSyncInfo> {
  const pushResult = await pushToCloud()
  if (pushResult.status === "error") return pushResult
  return pullFromCloud()
}

/**
 * Auto-sync: push every 30s, pull every 45s.
 * Returns a cleanup function.
 */
export function startCloudAutoSync(
  onSync?: (result: CloudSyncInfo) => void,
): () => void {
  const config = getCloudConfig()
  if (!config) return () => {}

  let stopped = false

  const push = async () => {
    if (stopped) return
    try {
      const result = await pushToCloud()
      if (onSync && !stopped) onSync(result)
    } catch {}
  }

  const pull = async () => {
    if (stopped) return
    try {
      const result = await pullFromCloud()
      if (onSync && !stopped) onSync(result)
    } catch {}
  }

  // Initial sync
  push()
  setTimeout(() => { if (!stopped) pull() }, 5000)

  const pushInterval = setInterval(push, 30_000)
  const pullInterval = setInterval(pull, 45_000)

  return () => {
    stopped = true
    clearInterval(pushInterval)
    clearInterval(pullInterval)
  }
}

/** Disconnect from cloud */
export function disconnectCloud(): void {
  clearCloudConfig()
}
