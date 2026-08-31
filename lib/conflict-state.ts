/**
 * Conflict state — tracks items that differ on both devices during LAN sync.
 * The ConflictResolver UI reads from this; the merge logic writes to it.
 */

export type ConflictItem = {
  /** e.g. "tasks", "habits", "notes" */
  storageKey: string
  /** The item's id field */
  itemId: string
  /** Human-readable label (falls back to item name/title/desc) */
  label: string
  /** The local version (current localStorage) */
  local: any
  /** The incoming version (from the other device) */
  remote: any
}

type Listener = () => void

let conflicts: ConflictItem[] = []
let listeners: Listener[] = []

function emit() {
  for (const fn of listeners) fn()
}

export function getConflicts(): ConflictItem[] {
  return conflicts
}

export function addConflict(c: ConflictItem) {
  // Deduplicate by storageKey+itemId
  if (conflicts.some((x) => x.storageKey === c.storageKey && x.itemId === c.itemId)) return
  conflicts.push(c)
  emit()
}

export function clearConflicts() {
  conflicts = []
  emit()
}

export function resolveConflict(storageKey: string, itemId: string, winner: "local" | "remote") {
  const idx = conflicts.findIndex((x) => x.storageKey === storageKey && x.itemId === itemId)
  if (idx === -1) return null
  const conflict = conflicts[idx]
  conflicts = conflicts.filter((_, i) => i !== idx)
  emit()
  return { ...conflict, winner }
}

export function onConflictChange(fn: Listener): () => void {
  listeners.push(fn)
  return () => {
    listeners = listeners.filter((l) => l !== fn)
  }
}
