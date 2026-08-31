"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Check, ChevronDown, ChevronUp, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { getConflicts, resolveConflict, clearConflicts, onConflictChange, type ConflictItem } from "@/lib/conflict-state"

function ItemPreview({ item, side }: { item: any; side: "local" | "remote" }) {
  const [open, setOpen] = useState(false)

  const fields = Object.entries(item).filter(([k]) => k !== "id" && typeof item[k] !== "function")

  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-xs font-medium text-foreground"
      >
        <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase", side === "local" ? "bg-primary/15 text-primary" : "bg-success/15 text-success")}>
          {side === "local" ? "This device" : "Other device"}
        </span>
        {open ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
      </button>
      {open && (
        <div className="mt-2 space-y-1">
          {fields.map(([k, v]) => (
            <div key={k} className="flex gap-2 text-[11px]">
              <span className="shrink-0 font-medium text-muted-foreground">{k}:</span>
              <span className="min-w-0 break-words text-foreground">{typeof v === "string" ? v : JSON.stringify(v)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function ConflictResolver() {
  const [conflicts, setConflicts] = useState<ConflictItem[]>(() => getConflicts())
  const [resolvedCount, setResolvedCount] = useState(0)

  useEffect(() => {
    return onConflictChange(() => setConflicts(getConflicts()))
  }, [])

  if (conflicts.length === 0) return null

  const handleResolve = (c: ConflictItem, winner: "local" | "remote") => {
    const resolved = resolveConflict(c.storageKey, c.itemId, winner)
    if (resolved) {
      // Apply the chosen version to localStorage
      try {
        const k = "proflow-" + resolved.storageKey
        const raw = localStorage.getItem(k)
        if (raw) {
          const arr = JSON.parse(raw)
          if (Array.isArray(arr)) {
            const idx = arr.findIndex((it: any) => it.id === resolved.itemId)
            if (idx !== -1) {
              arr[idx] = resolved[winner]
              localStorage.setItem(k, JSON.stringify(arr))
            }
          }
        }
        window.dispatchEvent(new Event("proflow:synced"))
      } catch {}
      setResolvedCount((c) => c + 1)
      setConflicts(getConflicts())
    }
  }

  const handleSkipAll = () => {
    clearConflicts()
    setConflicts([])
  }

  const first = conflicts[0]
  const storageLabel = first?.storageKey?.replace(/s$/, "") || "item"

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-lg rounded-2xl border border-warning/30 bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border p-4">
          <div className="flex size-9 items-center justify-center rounded-lg bg-warning/15">
            <AlertTriangle className="size-5 text-warning" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-foreground">
              Sync Conflict{conflicts.length > 1 ? `s (${conflicts.length})` : ""}
            </h2>
            <p className="text-xs text-muted-foreground">
              The same {storageLabel} was edited on both devices. Pick which version to keep.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSkipAll}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Conflict body */}
        <div className="max-h-[50vh] overflow-y-auto p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded bg-warning/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-warning">
              {storageLabel}
            </span>
            <span className="text-xs text-muted-foreground truncate">{first?.label}</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ItemPreview item={first?.local} side="local" />
            <ItemPreview item={first?.remote} side="remote" />
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => handleResolve(first, "local")}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
            >
              <Check className="size-3.5" />
              Keep this device
            </button>
            <button
              type="button"
              onClick={() => handleResolve(first, "remote")}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-success/10 border border-success/40 px-3 py-2 text-xs font-medium text-success transition-colors hover:bg-success/20"
            >
              <Check className="size-3.5" />
              Keep other device
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <span className="text-xs text-muted-foreground">
            {resolvedCount > 0 ? `${resolvedCount} resolved` : `${conflicts.length} conflict${conflicts.length !== 1 ? "s" : ""} remaining`}
          </span>
          <button
            type="button"
            onClick={handleSkipAll}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Skip all
          </button>
        </div>
      </div>
    </div>
  )
}
