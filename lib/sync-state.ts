/**
 * Lightweight global sync state — no React, just event-driven.
 * Auto-sync and manual sync operations update this; the topbar
 * listens for changes to show a live indicator.
 */

type Listener = () => void

let lastSyncedAt: Date | null = null
let syncing = false
let listeners: Listener[] = []

function emit() {
  for (const fn of listeners) fn()
}

export function getSyncState() {
  return { lastSyncedAt, syncing }
}

export function setSyncing(val: boolean) {
  if (syncing === val) return
  syncing = val
  emit()
}

export function markSynced() {
  lastSyncedAt = new Date()
  syncing = false
  emit()
}

export function onSyncStateChange(fn: Listener): () => void {
  listeners.push(fn)
  return () => {
    listeners = listeners.filter((l) => l !== fn)
  }
}
