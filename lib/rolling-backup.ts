"use client"

const isElectron =
  typeof window !== "undefined" && !!(window as any).electronAPI?.isElectron

const STORAGE_PREFIX = "proflow-"

/** Collect all proflow-* keys from localStorage into a plain object. */
export function collectAllData(): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(STORAGE_PREFIX)) {
        const raw = localStorage.getItem(key)
        if (raw !== null) {
          try {
            data[key] = JSON.parse(raw)
          } catch {
            // keep as string if not JSON
            data[key] = raw
          }
        }
      }
    }
  } catch {}
  return data
}

/** Apply data to localStorage (used by restore). */
export function applyData(data: Record<string, unknown>) {
  try {
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith(STORAGE_PREFIX)) {
        localStorage.setItem(key, JSON.stringify(value))
      }
    }
  } catch {}
}

/**
 * Save a rolling backup to Electron's userData directory.
 * Only works in Electron (desktop). On web/mobile this is a no-op.
 */
export async function saveRollingBackup(): Promise<boolean> {
  if (!isElectron) return false
  const api = (window as any).electronAPI
  try {
    const data = collectAllData()
    const keys = Object.keys(data)
    if (keys.length === 0) return false // don't backup empty data
    const result = await api.rollingSave({ data })
    return result?.ok === true
  } catch {
    return false
  }
}

/** Load rolling backup from Electron's userData directory. */
export async function loadRollingBackup(): Promise<{
  found: boolean
  data?: Record<string, unknown>
  savedAt?: string
}> {
  if (!isElectron) return { found: false }
  const api = (window as any).electronAPI
  try {
    return await api.rollingLoad()
  } catch {
    return { found: false }
  }
}

/** Check if there is any data in localStorage. */
export function hasAnyData(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(STORAGE_PREFIX)) {
        const raw = localStorage.getItem(key)
        if (raw && raw !== "undefined" && raw !== "null" && raw !== "[]") return true
      }
    }
  } catch {}
  return false
}
