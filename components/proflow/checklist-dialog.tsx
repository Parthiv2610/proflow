"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const ICONS = [
  "📝", "✅", "📋", "🛒", "✈️", "🏠", "💪", "📚", "🎯", "🎉",
  "🔧", "📦", "🛒", "🧹", "🎵", "💰", "🏃", "🎂", "🎓", "🌿",
  "🎮", "🛍️", "📸", "🍳", "💊", "🎨", "🧵", "🐕", "👶", "💼",
]

const COLORS = [
  "#9CA3AF", "#EF4444", "#F97316", "#F59E0B", "#22C55E",
  "#10B981", "#14B8A6", "#06B6D4", "#3B82F6", "#6366F1",
  "#8B5CF6", "#A855F7", "#EC4899", "#F472B6", "#FB923C",
]

export function ChecklistDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (name: string, icon: string, color: string) => void
}) {
  const [name, setName] = useState("")
  const [icon, setIcon] = useState("📝")
  const [color, setColor] = useState("#9CA3AF")

  const handleCreate = () => {
    const n = name.trim() || "Untitled checklist"
    onCreate(n, icon, color)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">New Checklist</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-5 p-6">
          {/* Name */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="e.g. Grocery List, Travel Packing..."
              className="h-10 w-full rounded-xl border border-input bg-secondary/50 px-4 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>

          {/* Icon picker */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Icon</label>
            <div className="flex flex-wrap gap-1.5">
              {ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setIcon(ic)}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-lg text-lg transition-all",
                    icon === ic
                      ? "bg-primary/20 ring-2 ring-primary scale-110"
                      : "bg-secondary hover:bg-secondary/80",
                  )}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          {/* Color picker */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Color</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "size-8 rounded-full transition-all",
                    color === c ? "ring-2 ring-offset-2 ring-offset-background scale-110" : "hover:scale-110",
                  )}
                  style={{ backgroundColor: c, outlineColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
            <span className="flex size-10 items-center justify-center rounded-xl text-xl" style={{ backgroundColor: color + "20" }}>
              {icon}
            </span>
            <span className="text-sm font-semibold text-foreground">{name || "Untitled checklist"}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  )
}
