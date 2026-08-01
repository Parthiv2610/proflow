"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  Calendar,
  FileText,
  Flame,
  LayoutDashboard,
  ListTodo,
  Maximize2,
  Minimize2,
  Plus,
  Settings,
  Target,
  Timer,
  Bell,
  ArrowRight,
  SquarePen,
  Sparkles,
  Trophy,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useStore, type View } from "./store"

type NavAction = {
  kind: "navigate"
  view: View
  label: string
  icon: React.ComponentType<{ className?: string }>
  shortcut?: string
}

type PaletteAction =
  | NavAction
  | { kind: "task"; id: string; title: string; project: string }
  | { kind: "note"; id: string; title: string; tag: string }
  | QuickAction

type QuickAction = {
  kind: "action"
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  onPick: () => void
}

const navActions: NavAction[] = [
  { kind: "navigate", view: "dashboard", label: "Dashboard", icon: LayoutDashboard, shortcut: "⌘1" },
  { kind: "navigate", view: "tasks", label: "Tasks & Projects", icon: ListTodo, shortcut: "⌘2" },
  { kind: "navigate", view: "calendar", label: "Calendar", icon: Calendar, shortcut: "⌘3" },
  { kind: "navigate", view: "notes", label: "Notes & Docs", icon: FileText, shortcut: "⌘4" },
  { kind: "navigate", view: "habits", label: "Habits & Goals", icon: Target, shortcut: "⌘5" },
  { kind: "navigate", view: "focus", label: "Focus Timer", icon: Timer, shortcut: "⌘6" },
  { kind: "navigate", view: "progress", label: "Progress & Badges", icon: Trophy, shortcut: "⌘7" },
  { kind: "navigate", view: "notifications", label: "Notifications", icon: Bell, shortcut: "⌘8" },
  { kind: "navigate", view: "settings", label: "Settings", icon: Settings, shortcut: "⌘9" },
]

export function CommandPalette({
  open,
  onClose,
  onCapture,
}: {
  open: boolean
  onClose: () => void
  onCapture: () => void
}) {
  const { tasks, notes, setView, addTask, focusMode, toggleFocusMode } = useStore()
  const [query, setQuery] = useState("")
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Reset state on open
  useEffect(() => {
    if (open) {
      setQuery("")
      setActiveIdx(0)
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [open])

  const q = query.trim().toLowerCase()

  // Build the merged results list
  const results = useMemo(() => {
    const items: PaletteAction[] = []

    // 1. Quick actions (always show at top when empty, filtered when typing)
    const actions: QuickAction[] = [
      {
        kind: "action",
        id: "toggle-focus",
        label: focusMode ? "Exit Focus Mode" : "Enter Focus Mode",
        icon: focusMode ? Minimize2 : Maximize2,
        onPick: () => { toggleFocusMode(); onClose() },
      },
      { kind: "action", id: "new-task", label: "Quick add task...", icon: Plus, onPick: onCapture },
      { kind: "action", id: "new-note", label: "Create a new note", icon: SquarePen, onPick: () => { setView("notes"); onClose() } },
    ]

    if (!q) {
      items.push(...actions)
      items.push(...navActions)
    }

    // 2. Matching nav actions
    if (q) {
      for (const a of navActions) {
        if (a.label.toLowerCase().includes(q)) items.push(a)
      }
    }

    // 3. Matching tasks
    if (q) {
      for (const t of tasks) {
        if (t.title.toLowerCase().includes(q) || t.project.toLowerCase().includes(q)) {
          items.push({ kind: "task", id: t.id, title: t.title, project: t.project })
        }
      }
    }

    // 4. Matching notes
    if (q) {
      for (const n of notes) {
        if (n.title.toLowerCase().includes(q) || n.tag.toLowerCase().includes(q)) {
          items.push({ kind: "note", id: n.id, title: n.title, tag: n.tag })
        }
      }
    }

    // 5. If typing, also show actions that match
    if (q) {
      for (const a of actions) {
        if (a.label.toLowerCase().includes(q)) items.push(a)
      }
    }

    // Also show quick-create-task action if query looks like a task title
    if (q && !items.some((i) => i.kind === "action" && i.id === "create-task")) {
      items.push({
        kind: "action",
        id: "create-task",
        label: `Create task: "${query}"`,
        icon: Sparkles,
        onPick: () => {
          addTask({ title: query, project: "Personal", category: "Admin", priority: "medium", due: "Today" })
          onClose()
        },
      })
    }

    return items
  }, [q, tasks, notes, navActions, setView, addTask, onCapture, onClose, focusMode, toggleFocusMode])

  // Clamp active index when results change
  useEffect(() => {
    setActiveIdx((prev) => Math.min(prev, Math.max(0, results.length - 1)))
  }, [results.length])

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.children[activeIdx] as HTMLElement | undefined
    el?.scrollIntoView({ block: "nearest" })
  }, [activeIdx])

  const pick = useCallback(
    (item: PaletteAction) => {
      if (item.kind === "navigate") {
        setView(item.view)
      } else if (item.kind === "action") {
        item.onPick()
      } else if (item.kind === "task") {
        setView("tasks")
      } else if (item.kind === "note") {
        setView("notes")
      }
      onClose()
    },
    [setView, onClose],
  )

  const pickIndex = useCallback(
    (idx: number) => {
      if (idx >= 0 && idx < results.length) pick(results[idx])
    },
    [results, pick],
  )

  // Internal keyboard nav
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          setActiveIdx((prev) => (prev + 1) % results.length)
          break
        case "ArrowUp":
          e.preventDefault()
          setActiveIdx((prev) => (prev - 1 + results.length) % results.length)
          break
        case "Enter":
          e.preventDefault()
          pickIndex(activeIdx)
          break
        case "Escape":
          onClose()
          break
      }
    },
    [results.length, activeIdx, pickIndex, onClose],
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Palette card */}
      <div
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border px-4">
          <svg
            className="size-4 shrink-0 text-muted-foreground"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search views, tasks, notes… or type to create"
            className="h-12 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden shrink-0 items-center gap-0.5 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:flex">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="max-h-[360px] overflow-y-auto p-2"
          role="listbox"
          aria-label="Results"
        >
          {results.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <span className="text-sm text-muted-foreground">No results found</span>
              <p className="text-xs text-muted-foreground">Try a different search term</p>
            </div>
          ) : (
            results.map((item, idx) => (
              <button
                key={`${item.kind}-${item.kind === "navigate" ? item.view : item.id}`}
                type="button"
                role="option"
                aria-selected={idx === activeIdx}
                onClick={() => pickIndex(idx)}
                onMouseEnter={() => setActiveIdx(idx)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                  idx === activeIdx
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground hover:bg-accent/50",
                )}
              >
                {/* Icon */}
                {item.kind === "navigate" && (
                  <item.icon className="size-4 shrink-0 text-muted-foreground" />
                )}
                {item.kind === "task" && (
                  <ListTodo className="size-4 shrink-0 text-primary" />
                )}
                {item.kind === "note" && (
                  <FileText className="size-4 shrink-0 text-focus" />
                )}
                {item.kind === "action" && (
                  <item.icon className="size-4 shrink-0 text-info" />
                )}

                {/* Label */}
                <span className="flex-1 truncate">
                  {item.kind === "navigate" && item.label}
                  {item.kind === "task" && (
                    <>
                      {item.title}
                      <span className="ml-2 text-xs text-muted-foreground">{item.project}</span>
                    </>
                  )}
                  {item.kind === "note" && (
                    <>
                      {item.title}
                      <span className="ml-2 text-xs text-muted-foreground">{item.tag}</span>
                    </>
                  )}
                  {item.kind === "action" && item.label}
                </span>

                {/* Badge / shortcut */}
                {item.kind === "navigate" && item.shortcut && (
                  <kbd className="shrink-0 rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {item.shortcut}
                  </kbd>
                )}
                {(item.kind === "task" || item.kind === "note") && (
                  <ArrowRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-4 border-t border-border px-4 py-2.5">
          <Hint keys="↑↓" label="Navigate" />
          <Hint keys="↵" label="Select" />
          <Hint keys="Esc" label="Close" />
        </div>
      </div>
    </div>
  )
}

function Hint({ keys, label }: { keys: string; label: string }) {
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <kbd className="rounded border border-border bg-muted/50 px-1 py-0.5 text-[10px] font-medium">{keys}</kbd>
      <span>{label}</span>
    </span>
  )
}
