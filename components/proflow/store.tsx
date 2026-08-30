"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useLocalStorage } from "@/lib/use-local-storage"
import { showNotification } from "@/lib/notify"
import { playChime } from "@/lib/sound"
import { updateWidgets, updateHabitWidget, updateTaskWidget } from "@/lib/widget-bridge"
import { isCapacitor } from "@/lib/lan-sync"
import { cancelAllReminders } from "@/lib/reminders"
import { syncAllHabitReminders, cancelAllHabitReminders } from "@/lib/habit-reminders"
import { celebrate } from "./confetti"

export type View =
  | "dashboard"
  | "tasks"
  | "calendar"
  | "notes"
  | "habits"
  | "focus"
  | "progress"
  | "checklists"
  | "notifications"
  | "settings"

export type TaskStatus = "todo" | "in-progress" | "done"
export type Priority = "low" | "medium" | "high"

// ── Checklists ──────────────────────────────────────────
export type SubTask = {
  id: string
  title: string
  done: boolean
}

export type ChecklistItem = {
  id: string
  title: string
  done: boolean
  priority: Priority
  due: string // "YYYY-MM-DD" or ""
  notes: string
  subtasks: SubTask[]
  createdAt: string // ISO timestamp
  completedAt?: string // ISO timestamp
  order: number // sort order within the list
}

export type Checklist = {
  id: string
  name: string
  icon: string
  color: string
  pinned: boolean
  items: ChecklistItem[]
  recurring?: "daily" | "weekly" | "monthly" | null
  createdAt: string
  archived?: boolean
}

export type Task = {
  id: string
  title: string
  project: string
  priority: Priority
  status: TaskStatus
  due: string
  overdue?: boolean
  completedAt?: string // "YYYY-MM-DD" when marked done — powers the 7-day chart
  // Repeating task: when completed, the task rolls forward to its next
  // occurrence instead of staying done (due advances by a week / a month).
  recurring?: "weekly" | "monthly"
}

/** A task that was completed and is kept for 24h so the user can restore it. */
export type CompletedTask = Task & {
  completedAtMs: number // epoch ms when marked done — used for 24h expiry
}

export type Habit = {
  id: string
  name: string
  streak: number
  doneToday: boolean
  week: boolean[]
  shields: number // mini shields owned for THIS habit (bought with XP)
  // "YYYY-MM-DD" the habit last earned its daily completion XP. Cleared when
  // the day is unchecked so an accidental check can be fully undone (the XP is
  // revoked through the ledger, and a later re-check legitimately earns again).
  // Check + uncheck nets exactly 0 XP, so this can't be farmed.
  rewardedDay: string
  // Actual dates (YYYY-MM-DD) the user completed this habit. Used by the
  // streak calendar to show exactly which days were done, instead of guessing
  // from the streak count (which breaks when the schedule has gaps).
  completedDays?: string[];
  // Reminder settings: optional fields for scheduling daily reminders
  reminderEnabled?: boolean
  reminderTime?: string // "HH:mm" format, e.g. "09:00"
}

export type Goal = {
  id: string
  name: string
  progress: number
  status: "on-track" | "at-risk"
}

export type EventItem = {
  id: string
  title: string
  time: string // display string like "3:00 PM"
  day: number // 0-6 day-of-week index (computed from date)
  date: string // actual date in "YYYY-MM-DD" format
  color: string
  hasBlock: boolean
  // time-block fields (when hasBlock is true)
  startHour: number // 0-23
  startMin: number // 0-55
  endHour: number // 0-23
  endMin: number // 0-55
}

export type NoteAttachment = {
  id: string
  name: string
  kind: "image" | "file" | "voice"
  mime: string
  dataUrl: string // base64 — stored locally with the note
  size: number // bytes
  durationMs?: number // voice notes
}

// A saved snapshot of a note's text fields, kept per note so any past version
// can be restored. Attachments are deliberately NOT versioned — they're base64
// data URLs that would blow the localStorage quota if duplicated per save.
export type NoteVersion = {
  id: string
  title: string
  body: string
  tag: string
  at: number // epoch ms — when the snapshot was taken
}

export type Note = {
  id: string
  title: string
  body: string
  tag: string
  updated: string
  pinned?: boolean
  attachments?: NoteAttachment[]
  // OneNote-style hierarchy: a note lives in a notebook → section. Optional for
  // backward compatibility — views derive "Personal" / "General" defaults.
  notebook?: string
  section?: string
}

export type AppNotification = {
  id: string
  title: string
  desc: string
  time: string
  read: boolean
  type: "task" | "event" | "habit" | "system"
}

export type FocusLogEntry = {
  date: string // "YYYY-MM-DD"
  minutes: number // focus time completed that day
  sessions: number // completed focus sessions that day
}

type TimerMode = "focus" | "break"

export type Pref = { id: string; label: string; desc: string; on: boolean }

// Sensible, real preference defaults (each one is wired to actual behavior).
export const defaultPrefs: Pref[] = [
  { id: "desktopNotif", label: "Desktop notifications", desc: "Notify about overdue tasks and today's events.", on: true },
  { id: "focusReminders", label: "Focus session reminders", desc: "Nudge when a focus session ends.", on: true },
  { id: "soundEnd", label: "Sound when timer ends", desc: "Chime when a session ends.", on: true },
  { id: "autoBreaks", label: "Auto-start breaks", desc: "Start breaks automatically.", on: false },
  { id: "androidReminders", label: "Android event reminders", desc: "Notify before today's events (Android).", on: true },
]

// Accent themes — applied as CSS variables on <html> so every view re-colors live.
export const ACCENTS: Record<string, { primary: string; fg: string; accent: string }> = {
  Purple: {
    primary: "oklch(0.62 0.2 292)",
    fg: "oklch(0.99 0 0)",
    accent: "oklch(0.3 0.03 292)",
  },
  Blue: {
    primary: "oklch(0.6 0.18 255)",
    fg: "oklch(0.99 0 0)",
    accent: "oklch(0.3 0.04 255)",
  },
  Indigo: {
    primary: "oklch(0.55 0.2 270)",
    fg: "oklch(0.99 0 0)",
    accent: "oklch(0.28 0.05 270)",
  },
  Green: {
    primary: "oklch(0.68 0.16 155)",
    fg: "oklch(0.2 0.02 155)",
    accent: "oklch(0.3 0.05 155)",
  },
  Teal: {
    primary: "oklch(0.65 0.15 175)",
    fg: "oklch(0.2 0.02 175)",
    accent: "oklch(0.3 0.05 175)",
  },
  Cyan: {
    primary: "oklch(0.68 0.14 205)",
    fg: "oklch(0.2 0.02 205)",
    accent: "oklch(0.3 0.05 205)",
  },
  Orange: {
    primary: "oklch(0.72 0.18 55)",
    fg: "oklch(0.2 0.04 55)",
    accent: "oklch(0.35 0.08 55)",
  },
  Amber: {
    primary: "oklch(0.76 0.15 70)",
    fg: "oklch(0.2 0.02 70)",
    accent: "oklch(0.35 0.06 70)",
  },
  Rose: {
    primary: "oklch(0.65 0.2 10)",
    fg: "oklch(0.99 0 0)",
    accent: "oklch(0.3 0.06 10)",
  },
}

type Store = {
  view: View
  setView: (v: View) => void

  search: string
  setSearch: (s: string) => void

  tasks: Task[]
  completedTasks: CompletedTask[] // recently completed, restorable for 24h
  projects: string[]
  addTask: (t: Omit<Task, "id" | "status"> & { status?: TaskStatus }) => void
  deleteTask: (id: string) => void
  restoreTask: (id: string) => void // move from completed back to active
  reorderTasks: (ids: string[]) => void
  cycleTaskStatus: (id: string) => void
  setTaskStatus: (id: string, status: TaskStatus) => void
  updateTask: (
    id: string,
    updates: Partial<Pick<Task, "title" | "project" | "priority" | "due" | "recurring">>,
  ) => void

  habits: Habit[]
  addHabit: (name: string, week?: boolean[], reminderEnabled?: boolean, reminderTime?: string) => void
  deleteHabit: (id: string) => void
  toggleHabit: (id: string) => void
  updateHabit: (id: string, updates: Partial<Pick<Habit, "name" | "week" | "reminderEnabled" | "reminderTime">>) => void

  goals: Goal[]
  addGoal: (name: string, progress?: number) => void
  updateGoal: (id: string, updates: Partial<Goal>) => void
  deleteGoal: (id: string) => void
  events: EventItem[]
  addEvent: (e: Omit<EventItem, "id">) => void
  updateEvent: (id: string, updates: Partial<EventItem>) => void
  deleteEvent: (id: string) => void
  notes: Note[]
  addNote: (
    n: Pick<Note, "title" | "body" | "tag"> & {
      pinned?: boolean
      attachments?: NoteAttachment[]
      notebook?: string
      section?: string
    },
  ) => string // returns the new note's id (so the view can select it)
  updateNote: (
    id: string,
    updates: Partial<Pick<Note, "title" | "body" | "tag" | "pinned" | "attachments" | "notebook" | "section">>,
  ) => void
  deleteNote: (id: string) => void
  noteHistory: Record<string, NoteVersion[]>
  restoreNoteVersion: (id: string, v: NoteVersion) => void

  notifications: AppNotification[]
  markRead: (id: string) => void
  markAllRead: () => void
  deleteNotification: (id: string) => void
  clearNotifications: () => void

  userName: string
  setUserName: (n: string) => void
  avatarUrl: string
  setAvatarUrl: (url: string) => void

  theme: string
  setTheme: (t: string) => void
  colorMode: "dark" | "light"
  setColorMode: (m: "dark" | "light") => void
  prefs: Pref[]
  togglePref: (id: string) => void

  showTour: boolean
  dismissTour: () => void
  startTour: () => void
  sessionCount: number
  resetAllData: () => void

  // focus mode
  focusMode: boolean
  toggleFocusMode: () => void

  // sidebar (collapsible drawer on phones)
  sidebarOpen: boolean
  toggleSidebar: () => void
  closeSidebar: () => void

  // timer
  secondsLeft: number
  totalSeconds: number
  running: boolean
  mode: TimerMode
  pomodoro: number
  totalPomodoros: number
  sessionLabel: string
  focusMinutes: number
  breakMinutes: number
  weeklyFocusGoal: number // minutes of focus targeted per week
  setWeeklyFocusGoal: (minutes: number) => void
  focusLog: FocusLogEntry[]
  recordFocusSession: () => void
  xp: number
  addXp: (amount: number) => void
  streakShields: number
  buyShield: () => boolean
  buyHabitShield: (id: string) => boolean
  undoLastShieldUse: () => boolean

  // achievements & milestones
  achievements: Record<string, string>
  bestStreak: number
  totalTasksDone: number
  recurringLog: string[] // completion dates of recurring-task occurrences
  pendingBadges: Achievement[]
  dismissBadge: () => void
  setFocusMinutes: (n: number) => void
  setBreakMinutes: (n: number) => void
  startTimer: () => void
  pauseTimer: () => void
  toggleTimer: () => void
  skipTimer: () => void
  stopTimer: () => void
  resetTimer: () => void

  // ── Checklists ──────────────────────────────────────────
  checklists: Checklist[]
  addChecklist: (name: string, icon?: string, color?: string) => string
  updateChecklist: (id: string, updates: Partial<Pick<Checklist, "name" | "icon" | "color" | "pinned" | "recurring" | "archived">>) => void
  deleteChecklist: (id: string) => void
  importChecklistFromTemplate: (templateId: string) => string // returns new checklist id
  // Checklist items
  addChecklistItem: (listId: string, title: string, priority?: Priority) => void
  updateChecklistItem: (listId: string, itemId: string, updates: Partial<Pick<ChecklistItem, "title" | "done" | "priority" | "due" | "notes"> & { subtasks?: SubTask[] }>) => void
  deleteChecklistItem: (listId: string, itemId: string) => void
  toggleChecklistItem: (listId: string, itemId: string) => void
  reorderChecklistItems: (listId: string, itemIds: string[]) => void
  bulkToggleChecklistItems: (listId: string, itemIds: string[], done: boolean) => void
  clearCompletedItems: (listId: string) => void
  duplicateChecklist: (listId: string) => void
}

const StoreContext = createContext<Store | null>(null)

/** "YYYY-MM-DD" for an arbitrary date. */
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** Local date key in "YYYY-MM-DD" — used to group focus time and completions by day. */
export function todayKey() {
  return dateKey(new Date())
}

/** Best-effort parse of a task's `due` display string into a real date. */
function parseDueDate(due: string): Date | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(due)) {
    const d = new Date(`${due}T00:00:00`)
    if (!Number.isNaN(d.getTime())) return d
  }
  const lower = due.toLowerCase()
  if (lower === "today") return new Date()
  if (lower === "tomorrow") {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d
  }
  return null
}

/**
 * Advance a recurring task's due date to its next occurrence. Falls back to
 * today when the label can't be parsed (e.g. custom text), so a repeating task
 * always moves forward rather than getting stuck.
 */
export function advanceRecurringDue(task: Pick<Task, "due" | "recurring">): string {
  const base = parseDueDate(task.due) ?? new Date()
  if (task.recurring === "weekly") {
    base.setDate(base.getDate() + 7)
  } else if (task.recurring === "monthly") {
    const targetMonth = base.getMonth() + 1
    base.setMonth(targetMonth)
    // JS rolls Jan 31 + 1 month over to Mar 3 — clamp to the last day of the
    // target month instead so monthly repeats stay on the same day of month.
    if (base.getMonth() !== targetMonth % 12) base.setDate(0)
  }
  return dateKey(base)
}

// ── XP & levels ────────────────────────────────────────────
// Purely positive reinforcement: you earn XP by completing things, never lose
// it, and level names are cheerful. Nothing here ever punishes a missed day.
// One name for every level 1–100, in 10 themed tiers. `levelName()` clamps at
// the last entry, so anything past level 100 keeps the top title.
const LEVEL_NAMES = [
  // 1–10 Beginning
  "Beginner", "Novice", "Rookie", "Starter", "Apprentice", "Explorer", "Learner", "Trainee", "Striver", "Go-Getter",
  // 11–20 Building
  "Builder", "Maker", "Crafter", "Achiever", "Doer", "Climber", "Grinder", "Forger", "Driver", "Velocity",
  // 21–30 Rising
  "Riser", "Soarer", "Ascender", "Rocket", "Comet", "Streak", "Surge", "Wave", "Blaze", "On Fire",
  // 31–40 Performing
  "Performer", "Producer", "Finisher", "Completer", "Executor", "Operator", "Specialist", "Skilled", "Polished", "Refined",
  // 41–50 Pro
  "Pro", "Expert", "Ace", "Prodigy", "Virtuoso", "Maestro", "Sharpshooter", "Trailblazer", "Pioneer", "Vanguard",
  // 51–60 Elite
  "Elite", "Premier", "Top Tier", "Peak", "Summit", "Apex", "Crown", "Sovereign", "Paramount", "Unstoppable",
  // 61–70 Master
  "Master", "Grandmaster", "Sage", "Guru", "Oracle", "Wizard", "Sorcerer", "Titan", "Colossus", "Giant",
  // 71–80 Champion
  "Champion", "Victor", "Conqueror", "Dominator", "Gladiator", "Warrior", "Knight", "Paladin", "Sentinel", "Guardian",
  // 81–90 Legend
  "Legend", "Icon", "Myth", "Fable", "Epic", "Hero", "Immortal", "Eternal", "Celestial", "Divine",
  // 91–100 Cosmic
  "Cosmic", "Galactic", "Stellar", "Supernova", "Nebula", "Infinity", "Omniscient", "Ascended", "Transcendent", "ProFlow Legend",
]

/** Cumulative XP needed to BE at the start of `level` (level 1 = 0). */
export function xpForLevel(level: number): number {
  return (100 * level * (level - 1)) / 2
}

/** XP needed to advance from `level` to the next one. */
export function xpForNextLevel(level: number): number {
  return 100 * level
}

/** The level a given XP total has reached. */
export function levelFor(xp: number): number {
  let level = 1
  while ((100 * (level + 1) * level) / 2 <= xp) level++
  return level
}

/** XP earned inside the current level (0 … xpForNextLevel). */
export function xpIntoLevel(xp: number): number {
  return xp - xpForLevel(levelFor(xp))
}

export function levelName(level: number): string {
  return LEVEL_NAMES[Math.min(level - 1, LEVEL_NAMES.length - 1)] ?? `Level ${level}`
}

// ── Streak shields ────────────────────────────────────────────
// Insurance against a missed habit day, bought with XP. A shield absorbs one
// missed scheduled day so the streak survives; you can hold at most 2 at once.
// Price sits just past the Level-3 milestone (~3-4 days of typical use) so
// shields are precious but reachable.
export const SHIELD_PRICE = 400
export const MAX_SHIELDS = 2

// Per-habit "mini" shields — cheaper than the shared pool (which protects any
// habit) because each one is locked to a single habit. Bought per habit; the
// XP is refunded through the ledger if the habit is deleted.
export const HABIT_SHIELD_PRICE = 100
export const MAX_HABIT_SHIELDS = 2

// Free shield as a level-up prize at every 5th level (5, 10, 15, …). The first
// lands at 1000 XP — over three shields' worth of earning — then rewards space
// out even more as levels get slower, so free shields stay genuinely scarce.
// The 2-shield cap keeps the economy honest: at max, the reward converts to
// half the shield price in XP instead of being wasted.
export const FREE_SHIELD_EVERY_LEVELS = 5

/** The next level that pays out a free shield (level 1 → 5, level 5 → 10, …). */
export function nextShieldMilestone(level: number): number {
  return level + (FREE_SHIELD_EVERY_LEVELS - (level % FREE_SHIELD_EVERY_LEVELS))
}

// ── Achievements & milestones ─────────────────────────────────
// Permanent badges earned once, celebrated with a popup + confetti when a
// milestone is crossed. Stored per-device (like XP) as id → earned "YYYY-MM-DD".
export type AchievementCategory = "streak" | "tasks" | "focus"
export type Achievement = {
  id: string
  name: string
  desc: string
  icon: string
  category: AchievementCategory
  threshold: number
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "streak-3", name: "First Flame", desc: "Reach a 3-day habit streak", icon: "🔥", category: "streak", threshold: 3 },
  { id: "streak-7", name: "Week Warrior", desc: "Reach a 7-day habit streak", icon: "⚡", category: "streak", threshold: 7 },
  { id: "streak-14", name: "Two-Week Titan", desc: "Reach a 14-day habit streak", icon: "🏆", category: "streak", threshold: 14 },
  { id: "streak-21", name: "Marathon Mind", desc: "Reach a 21-day habit streak", icon: "🧠", category: "streak", threshold: 21 },
  { id: "streak-30", name: "Monthly Master", desc: "Reach a 30-day habit streak", icon: "📅", category: "streak", threshold: 30 },
  { id: "tasks-10", name: "On a Roll", desc: "Complete 10 tasks", icon: "✅", category: "tasks", threshold: 10 },
  { id: "tasks-50", name: "Task Terminator", desc: "Complete 50 tasks", icon: "💪", category: "tasks", threshold: 50 },
  { id: "tasks-100", name: "Century Club", desc: "Complete 100 tasks", icon: "🚀", category: "tasks", threshold: 100 },
  { id: "tasks-250", name: "Powerhouse", desc: "Complete 250 tasks", icon: "🔥", category: "tasks", threshold: 250 },
  { id: "tasks-500", name: "Task Titan", desc: "Complete 500 tasks", icon: "👑", category: "tasks", threshold: 500 },
  { id: "focus-10", name: "Deep Focus", desc: "Complete 10 focus sessions", icon: "🎯", category: "focus", threshold: 10 },
  { id: "focus-50", name: "Flow State", desc: "Complete 50 focus sessions", icon: "🌊", category: "focus", threshold: 50 },
  { id: "focus-100", name: "Focus Legend", desc: "Complete 100 focus sessions", icon: "🧘", category: "focus", threshold: 100 },
  { id: "focus-250", name: "Zen Master", desc: "Complete 250 focus sessions", icon: "⚡", category: "focus", threshold: 250 },
]

// ── Gamification ledgers ────────────────────────────────────────
// XP and streak shields are SUMS of idempotent events. Every earn, spend, free
// grant and shield use carries an id; deterministic ids (free:<level>,
// use:<date>:<habitId>) keep the same logical grant/consumption from applying
// twice within a session, and random ids keep distinct actions distinct.
// Display totals below are derived from these ledgers.
export type XpEvent = { id: string; amount: number }
export type ShieldEvent = { id: string; amount: number }

/** Sum of an event ledger (amounts are numbers, missing = 0). */
function ledgerSum(events: { amount?: number }[]): number {
  return events.reduce((s, e) => s + (Number(e.amount) || 0), 0)
}

const DEFAULT_FOCUS_MINUTES = 25
const DEFAULT_BREAK_MINUTES = 5
const DEFAULT_WEEKLY_FOCUS_GOAL = 300 // 5 hours of focus per week

// Sidebar layout thresholds — the sidebar collapses by default on smaller windows.
export const SIDEBAR_DRAWER_MAX = 1024 // below this width the sidebar is an overlay drawer
const SIDEBAR_DEFAULT_OPEN_MIN = 1440 // at/above this width the sidebar starts open

const initialTasks: Task[] = []

const initialHabits: Habit[] = []

const initialGoals: Goal[] = []

const initialEvents: EventItem[] = []

const initialNotes: Note[] = []

const initialNotifications: AppNotification[] = []

export function ProFlowProvider({ children }: { children: React.ReactNode }) {
  const [view, setView] = useState<View>("dashboard")
  const [search, setSearch] = useState("")
  const [tasks, setRawTasks] = useLocalStorage<Task[]>("tasks", initialTasks)
  const [completedTasks, setCompletedTasks] = useLocalStorage<CompletedTask[]>("completedTasks", [])
  const [checklists, setChecklists] = useLocalStorage<Checklist[]>("checklists", [])
  const [habits, setRawHabits] = useLocalStorage<Habit[]>("habits", initialHabits)

  // Migration: ensure all habits have a `week` array (old habits may lack it)
  useEffect(() => {
    const patched = habits.map((h) =>
      h.week ? h : { ...h, week: [true, true, true, true, true, true, false] },
    )
    if (patched.some((h, i) => h !== habits[i])) setRawHabits(patched)
  }, [])
  const [goals, setRawGoals] = useLocalStorage<Goal[]>("goals", initialGoals)
  const [events, setRawEvents] = useLocalStorage<EventItem[]>("events", initialEvents)
  const [notes, setRawNotes] = useLocalStorage<Note[]>("notes", initialNotes)
  const [noteHistory, setRawNoteHistory] = useLocalStorage<Record<string, NoteVersion[]>>("noteHistory", {})
  const [notifications, setRawNotifications] = useLocalStorage<AppNotification[]>("notifications", initialNotifications)

  // Every OS toast (lib/notify showNotification) is ALSO recorded here as an
  // in-app notification — the bell badge and Notifications page render this
  // list, and it's the only notification channel that works on Android (the
  // WebView has no OS Notification API). History is capped so it can't grow
  // forever.
  useEffect(() => {
    const onToast = (e: Event) => {
      const detail = (e as CustomEvent<{ title?: string; body?: string }>).detail
      const title = detail?.title || "ProFlow"
      const body = detail?.body || ""
      const item: AppNotification = {
        id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title,
        desc: body,
        time: new Date().toLocaleString([], {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
        read: false,
        type: "system",
      }
      setRawNotifications((prev) => [item, ...prev].slice(0, 50))
    }
    window.addEventListener("proflow-notification", onToast)
    return () => window.removeEventListener("proflow-notification", onToast)
  }, [setRawNotifications])
  const [focusLog, setRawFocusLog] = useLocalStorage<FocusLogEntry[]>("focusLog", [])

  // ── XP & shields (event ledgers) ──────────────────────────────
  // The ledgers are authoritative; `xp` / `streakShields` below are display
  // caches derived from them. Existing users without a ledger get their saved
  // balance seeded as a single "seed" event.
  const [xpEvents, setRawXpEvents] = useLocalStorage<XpEvent[]>("xpEvents", [])
  const xpEventsRef = useRef(xpEvents)
  useEffect(() => {
    xpEventsRef.current = xpEvents
  }, [xpEvents])
  const [shieldEvents, setRawShieldEvents] = useLocalStorage<ShieldEvent[]>("shieldEvents", [])
  const shieldEventsRef = useRef(shieldEvents)
  useEffect(() => {
    shieldEventsRef.current = shieldEvents
  }, [shieldEvents])
  const setXpEvents = setRawXpEvents
  const setShieldEvents = setRawShieldEvents

  // Display cache of sum(xpEvents) — kept current whenever the ledger changes.
  const [xp, setXp] = useLocalStorage("xp", 0)
  const xpRef = useRef(xp)
  useEffect(() => {
    if (xpEvents.length === 0) {
      // One-time migration: saved XP without a ledger → seed it.
      const stored = Number(localStorage.getItem("proflow-xp")) || 0
      if (stored > 0) {
        setXpEvents([{ id: "seed", amount: stored }])
        return
      }
    }
    // The ref mirrors the TRUE ledger sum (which can dip negative in the rare
    // both-devices-spend-the-same-balance case) so affordability checks and
    // level math stay honest; only the DISPLAY is clamped at 0 — an earn
    // never visibly flickers away in the overdraft state.
    const sum = ledgerSum(xpEvents)
    xpRef.current = sum
    setXp(Math.max(0, sum))
  }, [xpEvents, setXp, setXpEvents])

  // Award XP (positive only) and celebrate when it crosses a level boundary.
  // Every award is an idempotent ledger event.
  const addXp = useCallback((amount: number) => {
    const before = levelFor(xpRef.current)
    const next = xpRef.current + amount
    xpRef.current = next
    setXpEvents((prev) => [...prev, { id: `xp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, amount }])
    setXp(Math.max(0, next))
    const after = levelFor(next)
    if (after > before) celebrate({ big: true })
  }, [setXp, setXpEvents])

  // Streak shields — buy insurance with XP. You can hold at most MAX_SHIELDS;
  // buying one costs SHIELD_PRICE XP. Balance = clamp(sum of ledger, 0..MAX).
  const [streakShields, setStreakShields] = useLocalStorage("streakShields", 0)
  useEffect(() => {
    if (shieldEvents.length === 0) {
      // One-time migration: saved shields without a ledger → seed them.
      const stored = Number(localStorage.getItem("proflow-streakShields")) || 0
      if (stored > 0) {
        setShieldEvents([{ id: "seed", amount: stored }])
        return
      }
    }
    const bal = Math.max(0, Math.min(MAX_SHIELDS, ledgerSum(shieldEvents)))
    shieldsRef.current = bal
    setStreakShields(bal)
  }, [shieldEvents, setStreakShields, setShieldEvents])
  const [lastHabitCheck, setRawLastHabitCheck] = useLocalStorage("lastHabitCheck", "")
  const setLastHabitCheck = setRawLastHabitCheck

  // A ref mirror makes the cap check race-safe against rapid clicks (the state
  // closure can be stale within one render frame); XP is already ref-authoritative.
  const shieldsRef = useRef(streakShields)
  // Per-habit mini shields need the same race-safe guard: `habits` state can be
  // stale within one render frame, so two fast taps on a buy button would both
  // pass the cap check and double-charge XP. This ref mirrors the live counts.
  const miniShieldsRef = useRef<Record<string, number>>({})
  useEffect(() => {
    miniShieldsRef.current = habits.reduce<Record<string, number>>((acc, h) => {
      acc[h.id] = h.shields ?? 0
      return acc
    }, {})
  }, [habits])
  // Guards the day-rollover against double-processing within one render frame.
  const habitCheckRef = useRef("")

  // ── Free shield level rewards ─────────────────────────────────
  // Highest level milestone that has already paid out a free shield.
  const [lastShieldMilestone, setRawLastShieldMilestone] = useLocalStorage("lastShieldMilestone", 0)
  const shieldMilestoneRef = useRef(lastShieldMilestone)
  useEffect(() => {
    shieldMilestoneRef.current = lastShieldMilestone
  }, [lastShieldMilestone])
  const setLastShieldMilestone = setRawLastShieldMilestone

  // Free shield at every FREE_SHIELD_EVERY_LEVELS-th level (3, 6, 9, …). Watches
  // XP so the reward fires exactly when a milestone level is crossed — ref-guarded
  // against double-grants, and at MAX_SHIELDS it pays half the shield price in XP
  // instead of wasting the prize.
  //
  // First run after this feature ships: seed silently to the current level's
  // milestone so long-time users don't get a retroactive shield/popup burst for
  // levels they already passed — the prize counts from now on (matches the
  // achievements seed pattern).
  useEffect(() => {
    const level = levelFor(xp)
    try {
      if (localStorage.getItem("proflow-lastShieldMilestone") === null) {
        const seeded = Math.floor(level / FREE_SHIELD_EVERY_LEVELS) * FREE_SHIELD_EVERY_LEVELS
        shieldMilestoneRef.current = seeded
        setLastShieldMilestone(seeded)
        return
      }
    } catch {
      // storage unavailable — fall through to the in-memory grant path below
    }
    let paid = shieldMilestoneRef.current
    while (paid + FREE_SHIELD_EVERY_LEVELS <= level) {
      const milestone = paid + FREE_SHIELD_EVERY_LEVELS
      shieldMilestoneRef.current = milestone
      setLastShieldMilestone(milestone)
      // Deterministic event id: the same milestone can only be granted once —
      // the ref guards skip a duplicate grant within this session.
      if (shieldsRef.current < MAX_SHIELDS) {
        if (!shieldEventsRef.current.some((e) => e.id === `free-${milestone}`)) {
          setShieldEvents((prev) => [...prev, { id: `free-${milestone}`, amount: 1 }])
          shieldsRef.current = Math.min(MAX_SHIELDS, shieldsRef.current + 1)
          setStreakShields(shieldsRef.current)
          celebrate({ big: true })
          showNotification("ProFlow", `🎁 Level ${milestone} reached — you earned a free streak shield!`)
        }
      } else {
        const bonus = Math.round(SHIELD_PRICE / 2)
        if (!xpEventsRef.current.some((e) => e.id === `bonus-${milestone}`)) {
          xpRef.current += bonus
          setXpEvents((prev) => [...prev, { id: `bonus-${milestone}`, amount: bonus }])
          setXp(Math.max(0, xpRef.current))
          showNotification("ProFlow", `🎁 Level ${milestone} reached — shields are full, so here's ${bonus} XP instead!`)
        }
      }
      paid = milestone
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xp])

  // ── Achievements state ────────────────────────────────────────
  // Achievements is a grow-only map (id → earned date) and bestStreak a
  // monotonic max. totalTasksDone is NOT stored independently: it's derived
  // from the tasks below, exactly like totalFocusRef derives from focusLog.
  const [achievements, setRawAchievements] = useLocalStorage<Record<string, string>>("achievements", {})
  const achievementsRef = useRef(achievements)
  useEffect(() => {
    achievementsRef.current = achievements
  }, [achievements])
  const setAchievements = setRawAchievements
  const [bestStreak, setRawBestStreak] = useLocalStorage("bestStreak", 0)
  const bestStreakRef = useRef(bestStreak)
  useEffect(() => {
    bestStreakRef.current = bestStreak
  }, [bestStreak])
  const setBestStreak = setRawBestStreak
  const [totalTasksDone, setTotalTasksDone] = useLocalStorage("totalTasksDone", 0)
  const totalTasksRef = useRef(totalTasksDone)
  useEffect(() => {
    totalTasksRef.current = totalTasksDone
  }, [totalTasksDone])
  const completedChecklistCount = useMemo(() => {
    return checklists.reduce((sum, cl) => sum + cl.items.filter((it) => it.done).length, 0)
  }, [checklists])
  // Lifetime log of completed recurring-task occurrences (the completion date).
  // Recurring tasks roll straight back to "todo" after a completion — they never
  // sit in the "done" state the derived counter below reads — so every
  // occurrence is recorded here with its date. It powers both the lifetime
  // counter and the daily/weekly charts. Capped so the log can't grow forever
  // (a weekly repeat is ~52 entries a year).
  const [recurringLog, setRawRecurringLog] = useLocalStorage<string[]>("recurringLog", [])
  // Lifetime task-completions counter — tasks + recurring + completed checklist items.
  useEffect(() => {
    const total = completedTasks.length + recurringLog.length + completedChecklistCount
    if (total !== totalTasksRef.current) {
      totalTasksRef.current = total
      setTotalTasksDone(total)
    }
  }, [completedTasks, recurringLog, completedChecklistCount, setTotalTasksDone])
  // Lifetime focus-session counter — kept in sync with the focus log.
  const totalFocusRef = useRef(0)
  useEffect(() => {
    totalFocusRef.current = focusLog.reduce((s, e) => s + e.sessions, 0)
  }, [focusLog])
  // Queue of badges waiting to be celebrated — if several milestones cross at
  // once (e.g. a long-time user linking a fresh phone), each gets its own popup.
  const [pendingBadges, setPendingBadges] = useState<Achievement[]>([])
  const dismissBadge = useCallback(() => setPendingBadges((prev) => prev.slice(1)), [])

  // Award a badge exactly once (ref-guarded against rapid multi-fire); the popup
  // + confetti + notification are the celebration for crossing a milestone.
  const awardIfNew = useCallback(
    (a: Achievement) => {
      if (achievementsRef.current[a.id]) return
      achievementsRef.current = { ...achievementsRef.current, [a.id]: todayKey() }
      setAchievements(achievementsRef.current)
      setPendingBadges((prev) => (prev.some((b) => b.id === a.id) ? prev : [...prev, a]))
      celebrate({ big: true })
      showNotification("ProFlow", `🏅 Achievement unlocked: ${a.name}!`)
    },
    [setAchievements],
  )

  // Streak milestones (3/7/14): track the all-time best streak; award any
  // thresholds the new best crosses.
  const checkStreakMilestones = useCallback(
    (streak: number) => {
      if (streak > bestStreakRef.current) {
        bestStreakRef.current = streak
        setBestStreak(streak)
      }
      ACHIEVEMENTS.filter((a) => a.category === "streak" && streak >= a.threshold).forEach(awardIfNew)
    },
    [awardIfNew, setBestStreak],
  )

  // Task milestones (10/50/100/250/500): bump the lifetime counter and award thresholds.
  const checkTaskMilestones = useCallback(() => {
    const total = totalTasksRef.current + 1
    totalTasksRef.current = total
    setTotalTasksDone(total)
    ACHIEVEMENTS.filter((a) => a.category === "tasks" && total >= a.threshold).forEach(awardIfNew)
  }, [awardIfNew, setTotalTasksDone])

  // Focus milestones (10/50/100/250 sessions): award every threshold the given
  // lifetime session total has crossed. Called when a session completes.
  const checkFocusMilestones = useCallback(
    (total: number) => {
      ACHIEVEMENTS.filter((a) => a.category === "focus" && total >= a.threshold).forEach(awardIfNew)
    },
    [awardIfNew],
  )

  // Seed once when the achievements key is absent: credit streaks/tasks the
  // user already completed so the badge gallery is accurate (no popup storm —
  // the celebration is reserved for live progress). Depends on tasks/habits.
  useEffect(() => {
    try {
      if (localStorage.getItem("proflow-achievements") !== null) return
      const maxStreak = habits.reduce((m, h) => Math.max(m, h.streak), 0)
      const tasksDone = completedTasks.length + recurringLog.length
      const focusSessions = focusLog.reduce((s, e) => s + e.sessions, 0)
      if (maxStreak > 0) {
        bestStreakRef.current = maxStreak
        setBestStreak(maxStreak)
      }
      if (tasksDone > 0) {
        totalTasksRef.current = tasksDone
        setTotalTasksDone(tasksDone)
      }
      if (focusSessions > 0) totalFocusRef.current = focusSessions
      const seeded: Record<string, string> = {}
      ACHIEVEMENTS.forEach((a) => {
        const v = a.category === "streak" ? maxStreak : a.category === "tasks" ? tasksDone : focusSessions
        if (v >= a.threshold) seeded[a.id] = todayKey()
      })
      if (Object.keys(seeded).length) setAchievements(seeded)
    } catch {
      // storage unavailable — nothing to seed
    }
  }, [tasks, completedTasks, habits, focusLog, recurringLog, setBestStreak, setTotalTasksDone, setAchievements])

  const buyShield = useCallback(() => {
    if (shieldsRef.current >= MAX_SHIELDS || xpRef.current < SHIELD_PRICE) return false
    xpRef.current -= SHIELD_PRICE
    const stamp = Date.now()
    const rand = Math.random().toString(36).slice(2, 8)
    setXpEvents((prev) => [...prev, { id: `spend-${stamp}-${rand}`, amount: -SHIELD_PRICE }])
    setXp(xpRef.current)
    shieldsRef.current += 1
    // Random suffix: two purchases in the same millisecond must stay distinct
    // events — a shared id would dedupe them and a shield could be lost.
    setShieldEvents((prev) => [...prev, { id: `buy-${stamp}-${rand}`, amount: 1 }])
    setStreakShields(shieldsRef.current)
    return true
  }, [setXp, setStreakShields, setXpEvents, setShieldEvents])

  // Buy a MINI shield for ONE habit — like a streak shield, but it only
  // protects that habit's streak (absorbs one missed scheduled day for it).
  // Cheaper than the shared pool because it's locked to a single habit.
  const buyHabitShield = useCallback(
    (id: string) => {
      const h = habits.find((x) => x.id === id)
      if (!h) return false
      // Ref-mirrored count: two rapid taps in one render frame both see the same
      // stale `habits` closure — the ref is incremented synchronously so the
      // second tap sees the first one's shield and hits the cap (or spends XP
      // once more only if a slot is genuinely left).
      const owned = miniShieldsRef.current[id] ?? 0
      if (owned >= MAX_HABIT_SHIELDS || xpRef.current < HABIT_SHIELD_PRICE) return false
      xpRef.current -= HABIT_SHIELD_PRICE
      const stamp = Date.now()
      const rand = Math.random().toString(36).slice(2, 8)
      setXpEvents((prev) => [...prev, { id: `spend-${stamp}-${rand}`, amount: -HABIT_SHIELD_PRICE }])
      setXp(xpRef.current)
      miniShieldsRef.current = { ...miniShieldsRef.current, [id]: owned + 1 }
      setRawHabits((prev) => prev.map((x) => (x.id === id ? { ...x, shields: (x.shields ?? 0) + 1 } : x)))
      return true
    },
    [habits, setXp, setXpEvents, setRawHabits],
  )

  // Undo the last shield usage: restore the shield to the shared pool and
  // remove the consumption event. The streak is then recalculated from the
  // actual completedDays — if the shield was covering a missed day, the
  // streak naturally breaks at that point.
  const undoLastShieldUse = useCallback(() => {
    const events = [...shieldEventsRef.current]
    // Find the most recent shield consumption (use: prefix).
    let idx = -1
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].id.startsWith("use:")) { idx = i; break; }
    }
    if (idx < 0) return false // nothing to undo
    const removed = events[idx]
    events.splice(idx, 1)
    shieldEventsRef.current = events
    setShieldEvents(events)
    // Restore one shield to the shared pool.
    shieldsRef.current += 1
    setStreakShields(shieldsRef.current)
    // Extract the habit id and date from the event id (use:YYYY-MM-DD:h_id).
    const parts = removed.id.split(":")
    const missedDate = parts[1] // YYYY-MM-DD
    const habitId = parts.slice(2).join(":") // in case id contains ':'
    // Recalculate that habit's streak from actual completion data.
    const habit = habits.find((h) => h.id === habitId)
    if (habit) {
      const today = todayKey()
      const completedSet = new Set(habit.completedDays || [])
      if (habit.doneToday) completedSet.add(today)
      let streak = habit.doneToday ? 1 : 0
      const cursor = new Date(`${missedDate}T00:00:00`)
      cursor.setDate(cursor.getDate() - 1)
      let safety = 400
      while (safety-- > 0) {
        const key = dateKey(cursor)
        const dayIdx = (cursor.getDay() + 6) % 7
        if (habit.week?.[dayIdx]) {
          if (completedSet.has(key)) streak++
          else break // missed a scheduled day → streak broken here
        }
        cursor.setDate(cursor.getDate() - 1)
      }
      setRawHabits((prev) =>
        prev.map((h) => h.id === habitId ? { ...h, streak: Math.max(0, streak) } : h),
      )
    }
    showNotification("ProFlow", "↩️ Shield use undone — shield returned")
    return true
  }, [shieldEventsRef, habits, setShieldEvents, setStreakShields, setRawHabits])

  // Projects derived from real task data — no hardcoded demo projects. A task
  // can carry any project name; the sidebar/tasks view only ever shows projects
  // the user has actually used.
  const projects = useMemo(
    () => Array.from(new Set(tasks.map((t) => t.project))).filter(Boolean),
    [tasks],
  )

  // user name
  const [userName, setRawUserName] = useLocalStorage("userName", "You")

  const setTasks = setRawTasks
  const setHabits = setRawHabits
  const setGoals = setRawGoals
  const setEvents = setRawEvents
  const setNotes = setRawNotes
  const setNotifications = setRawNotifications
  const setFocusLog = setRawFocusLog
  const setUserName = setRawUserName
  const [avatarUrl, setRawAvatarUrl] = useLocalStorage("avatarUrl", "")
  const setAvatarUrl = setRawAvatarUrl

  // Auto-expire completed tasks after 24 hours
  useEffect(() => {
    const now = Date.now()
    const expiryMs = 24 * 60 * 60 * 1000
    setCompletedTasks((prev) => prev.filter((t) => now - t.completedAtMs < expiryMs))
  }, [setCompletedTasks])

  // Periodic cleanup every 10 minutes
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now()
      const expiryMs = 24 * 60 * 60 * 1000
      setCompletedTasks((prev) => prev.filter((t) => now - t.completedAtMs < expiryMs))
    }, 10 * 60 * 1000)
    return () => clearInterval(id)
  }, [setCompletedTasks])

  // Restore a recently-completed task back to the active list
  const restoreTask = useCallback(
    (id: string) => {
      setCompletedTasks((prev) => {
        const found = prev.find((t) => t.id === id)
        if (!found) return prev
        const restored: Task = {
          id: found.id,
          title: found.title,
          project: found.project,
          priority: found.priority,
          status: "todo",
          due: found.due,
          overdue: found.overdue,
          completedAt: undefined,
          recurring: found.recurring,
        }
        setTasks((prevTasks) => {
          // Avoid duplicates if it somehow already exists
          if (prevTasks.some((t) => t.id === id)) return prevTasks
          return [...prevTasks, restored]
        })
        return prev.filter((t) => t.id !== id)
      })
      showNotification("ProFlow", "↩️ Task restored")
    },
    [setCompletedTasks, setTasks],
  )

  // Day rollover for streaks: a scheduled habit day that passes without being
  // completed normally resets the streak — a shield (if held) absorbs the miss.
  const runHabitDayCheck = useCallback(() => {
    const today = todayKey()
    if (!lastHabitCheck) {
      setLastHabitCheck(today)
      return
    }
    if (lastHabitCheck === today) return
    // Ref guard: two invocations within the same render frame (mount +
    // visibilitychange) would both see the stale closure value and double-consume
    // shields — bail if this day was already processed.
    if (habitCheckRef.current === today) return
    habitCheckRef.current = today
    // Fully elapsed days since the last check: lastHabitCheck … yesterday.
    const gapDays: Date[] = []
    const cursor = new Date(`${lastHabitCheck}T00:00:00`)
    const now = new Date()
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    while (cursor < todayMidnight) {
      gapDays.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
    if (gapDays.length === 0) {
      setLastHabitCheck(today)
      return
    }
    let shieldsLeft = shieldsRef.current
    let miniUsed = 0
    const useEvents: ShieldEvent[] = []
    const next = habits.map((h) => {
      const base = { ...h, doneToday: false }
      if (h.streak <= 0) return base
      const missedDays: string[] = []
      gapDays.forEach((d, i) => {
        // week[] is Monday-first (M,T,W,T,F,S,S) but getDay() is Sunday-first
        // (0=Sun…6=Sat) — shift so both index 0 = Monday.
        if (!h.week?.[(d.getDay() + 6) % 7]) return // habit not scheduled that weekday
        // The last active day is credited if the user had marked it done.
        if (i === 0) {
          if (!h.doneToday) missedDays.push(dateKey(d))
        } else {
          missedDays.push(dateKey(d))
        }
      })
      if (missedDays.length === 0) return base
      // Absorb one missed day per shield held. Shared-pool absorptions record a
      // deterministic event (date + habit) so the same missed day is never
      // charged twice; the habit's OWN mini shields are consumed from the habit
      // itself (the day check runs once per day, so they can't double-charge).
      const uncovered = missedDays.filter(
        (d) => !shieldEventsRef.current.some((e) => e.id === `use:${d}:${h.id}`),
      )
      let absorbed = missedDays.length - uncovered.length
      // 1) This habit's own mini shields absorb first — one missed day each.
      const ownShields = h.shields ?? 0
      const ownUsed = Math.min(ownShields, uncovered.length)
      miniUsed += ownUsed
      absorbed += ownUsed
      // 2) Whatever's still uncovered falls back to the shared pool.
      for (const d of uncovered.slice(ownUsed)) {
        if (shieldsLeft <= 0) break
        useEvents.push({ id: `use:${d}:${h.id}`, amount: -1 })
        shieldsLeft -= 1
        absorbed++
      }
      // Not enough shields to cover every missed day → the streak breaks.
      return absorbed < missedDays.length
        ? { ...base, streak: 0, shields: ownShields - ownUsed }
        : { ...base, shields: ownShields - ownUsed }
    })
    // used = shared-pool consumptions recorded this session (deduped by event id).
    const used = useEvents.length
    if (used > 0 || miniUsed > 0) {
      shieldsRef.current = shieldsLeft
      setShieldEvents((prev) => [...prev, ...useEvents])
      setStreakShields(shieldsLeft)
      const bits: string[] = []
      if (used > 0) bits.push(`${used} shared shield${used > 1 ? "s" : ""}`)
      if (miniUsed > 0) bits.push(`${miniUsed} mini shield${miniUsed > 1 ? "s" : ""}`)
      showNotification("ProFlow", `🛡️ ${bits.join(" + ")} used to keep your streaks alive!`)
      celebrate()
    }
    // Prune completedDays older than 90 days to keep localStorage lean.
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - 90)
    const cutoffKey = dateKey(cutoffDate)
    const pruned = next.map((h) =>
      h.completedDays && h.completedDays.length > 90
        ? { ...h, completedDays: h.completedDays.filter((d) => d >= cutoffKey) }
        : h,
    )
    setHabits(pruned)
    setLastHabitCheck(today)
  }, [lastHabitCheck, shieldsRef, habits, setHabits, setShieldEvents, setStreakShields, setLastHabitCheck])

  // Check on mount, every minute, and when the tab regains focus — so a streak
  // that would break overnight is caught (and shield-protected) as soon as the
  // app is next opened or the day rolls over while it stays open.
  useEffect(() => {
    runHabitDayCheck()
    const id = setInterval(runHabitDayCheck, 60_000)
    const onVis = () => runHabitDayCheck()
    document.addEventListener("visibilitychange", onVis)
    return () => {
      clearInterval(id)
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [runHabitDayCheck])

  // Sync habit reminders on load and whenever habits change.
  // On desktop this sets setTimeout-based timers; on Android it schedules
  // AlarmManager alarms via the native Reminders plugin.
  useEffect(() => {
    syncAllHabitReminders(habits)
    // Cleanup: cancel all timers when habits unmount or change
    return () => { cancelAllHabitReminders(habits) }
  }, [habits])

  // theme + preferences (persisted, applied live)
  const [theme, setRawTheme] = useLocalStorage("settings-theme", "Purple")
  const setTheme = setRawTheme
  const [prefs, setRawPrefs] = useLocalStorage<Pref[]>("settings-prefs-v2", defaultPrefs)
  const setPrefs = setRawPrefs
  const togglePref = useCallback((id: string) => {
    setPrefs((prev) => prev.map((p) => (p.id === id ? { ...p, on: !p.on } : p)))
  }, [setPrefs])

  // Apply the accent theme as CSS variables on <html>
  useEffect(() => {
    const a = ACCENTS[theme] ?? ACCENTS.Purple
    const root = document.documentElement
    root.style.setProperty("--primary", a.primary)
    root.style.setProperty("--primary-foreground", a.fg)
    root.style.setProperty("--ring", a.primary)
    root.style.setProperty("--accent", a.accent)
    root.style.setProperty("--chart-1", a.primary)
    root.style.setProperty("--sidebar-primary", a.primary)
    root.style.setProperty("--sidebar-primary-foreground", a.fg)
    root.style.setProperty("--sidebar-ring", a.primary)
    root.style.setProperty("--sidebar-accent", a.accent)
  }, [theme])

  // Light / dark appearance — toggles the `dark` class on <html> (globals.css
  // ships light tokens on :root and dark tokens under .dark; adding the .light
  // class also opts out of the OS-level prefers-color-scheme override).
  const [colorMode, setRawColorMode] = useLocalStorage<"dark" | "light">("colorMode", "dark")
  const setColorMode = setRawColorMode
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle("dark", colorMode === "dark")
    root.classList.toggle("light", colorMode === "light")
    root.style.colorScheme = colorMode
  }, [colorMode])

  // Desktop notifications — once per day, summarize overdue tasks + today's events.
  const notifiedDayRef = useRef("")
  useEffect(() => {
    if (!prefs.some((p) => p.id === "desktopNotif" && p.on)) return
    const d = new Date()
    const dayKey = d.toDateString()
    if (notifiedDayRef.current === dayKey) return
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    const overdue = tasks.filter((t) => t.overdue).length
    const eventsToday = events.filter((e) => e.date === today).length
    if (overdue === 0 && eventsToday === 0) return
    notifiedDayRef.current = dayKey
    const bits: string[] = []
    if (overdue > 0) bits.push(`${overdue} overdue task${overdue > 1 ? "s" : ""}`)
    if (eventsToday > 0) bits.push(`${eventsToday} event${eventsToday > 1 ? "s" : ""} today`)
    showNotification("ProFlow", bits.join(" · "))
  }, [prefs, tasks, events])

  // Android OS reminders — real notifications for today's time-blocked events.
  // The WebView can't fire its own notifications, so the native Reminders
  // plugin schedules AlarmManager alarms that post OS notifications even when
  // ProFlow is closed. Reconciled whenever events/prefs change: cancel
  // everything we own, then re-schedule the upcoming set (a handful of alarms,
  // so this is cheap and always reflects the current calendar).
  const remindersAskedRef = useRef(false)
  useEffect(() => {
    if (!isCapacitor()) return
    const p = (window as any)?.Capacitor?.Plugins?.Reminders
    if (!p) return
    const enabled = prefs.some((x) => x.id === "androidReminders" && x.on)
    ;(async () => {
      // Toggled off (or never on): drop any alarms this plugin still holds so
      // a disabled preference never fires stale notifications.
      if (!enabled) {
        try {
          await p.cancelAll?.()
        } catch {
          // nothing to cancel
        }
        return
      }
      // Ask for notification permission once (Android 13+); if denied, skip
      // quietly — the user can re-enable from system settings later.
      if (!remindersAskedRef.current) {
        remindersAskedRef.current = true
        try {
          const res = await p.requestPermission?.()
          if (res && res.granted === false) return
        } catch {
          return
        }
      }
      try {
        await p.cancelAll?.()
      } catch {
        return
      }
      const today = todayKey()
      const base = new Date()
      const dayStart = new Date(base.getFullYear(), base.getMonth(), base.getDate())
      for (const e of events) {
        if (e.date !== today || !e.hasBlock) continue
        const at = new Date(dayStart.getTime())
        at.setHours(e.startHour, e.startMin, 0, 0)
        // Nudge 5 minutes before the event so the user has time to wrap up.
        const fireAt = at.getTime() - 5 * 60_000
        if (fireAt <= Date.now() + 30_000) continue // already started / too soon
        const t = e.time || `${e.startHour % 12 || 12}:${String(e.startMin).padStart(2, "0")}`
        try {
          await p.schedule?.({
            id: `ev-${e.id}`,
            title: `Event today: ${e.title}`,
            body: `Starts at ${t}`,
            at: fireAt,
          })
        } catch {
          // permission denied or scheduling failure — skip this one
        }
      }
    })()
  }, [events, prefs])

  // welcome tour — defaults to OFF so the app never opens on a blocking overlay;
  // it's started manually from Settings → "Take the tour".
  const [showTour, setShowTour] = useLocalStorage("showTour", false)
  const dismissTour = useCallback(() => setShowTour(false), [])
  const startTour = useCallback(() => setShowTour(true), [])

  // onboarding tooltips — session counter (increments on mount, caps at 5)
  const [sessionCount, setSessionCount] = useLocalStorage("sessionCount", 0)
  useEffect(() => {
    setSessionCount((prev) => Math.min(prev + 1, 5))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // focus mode
  const [focusMode, setFocusMode] = useState(false)
  const toggleFocusMode = useCallback(() => setFocusMode((prev) => !prev), [])

  // Sidebar — collapses by default on smaller windows; the hamburger toggles it at any size.
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const toggleSidebar = useCallback(() => setSidebarOpen((prev) => !prev), [])
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  // Default: open on large windows, collapsed on smaller ones. Also close the
  // sidebar only when the window crosses INTO drawer territory (<1024px) — not on
  // every resize below it, so the phone's URL bar/keyboard don't slam the drawer shut.
  // useLayoutEffect sets the width-based default before first paint (no flash on wide screens).
  useLayoutEffect(() => {
    if (typeof window === "undefined") return
    const lastWidth = { v: window.innerWidth }
    setSidebarOpen(lastWidth.v >= SIDEBAR_DEFAULT_OPEN_MIN)
    const onResize = () => {
      const w = window.innerWidth
      if (lastWidth.v >= SIDEBAR_DRAWER_MAX && w < SIDEBAR_DRAWER_MAX) setSidebarOpen(false)
      lastWidth.v = w
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  // Timer settings (persisted).
  const [focusMinutes, setRawFocusMinutes] = useLocalStorage("focusMinutes", DEFAULT_FOCUS_MINUTES)
  const setFocusMinutes = setRawFocusMinutes
  const [breakMinutes, setRawBreakMinutes] = useLocalStorage("breakMinutes", DEFAULT_BREAK_MINUTES)
  const setBreakMinutes = setRawBreakMinutes
  const [weeklyFocusGoal, setRawWeeklyFocusGoal] = useLocalStorage("weeklyFocusGoal", DEFAULT_WEEKLY_FOCUS_GOAL)
  const setWeeklyFocusGoal = setRawWeeklyFocusGoal

  // timer — timestamp-based so it stays accurate when backgrounded/tab-hidden
  const [mode, setMode] = useState<TimerMode>("focus")
  const [totalSeconds, setTotalSeconds] = useState(DEFAULT_FOCUS_MINUTES * 60)
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_FOCUS_MINUTES * 60)
  const [running, setRunning] = useState(false)
  const [pomodoro, setPomodoro] = useState(1)
  const totalPomodoros = 4
  const sessionLabel = "Focus"
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const endTimeRef = useRef<number | null>(null) // absolute ms when timer ends
  const runningRef = useRef(false)
  runningRef.current = running

  // Persist / restore timer state across background/sleep/refresh.
  const persistTimerState = useCallback((endTime: number | null, secLeft: number, m: TimerMode, p: number, total: number) => {
    try {
      const data = { endTime, secondsLeft: secLeft, mode: m, pomodoro: p, total };
      localStorage.setItem("proflow-focus-timer", JSON.stringify(data));
    } catch { /* noop */ }
  }, []);

  const clearPersistedTimer = useCallback(() => {
    try { localStorage.removeItem("proflow-focus-timer"); } catch { /* noop */ }
  }, []);

  // Sync remaining time from the stored end timestamp.
  const syncFromEndTime = useCallback((m: TimerMode, p: number, total: number, modeOverride?: TimerMode) => {
    if (!endTimeRef.current) return;
    const now = Date.now();
    const remainingMs = endTimeRef.current - now;
    if (remainingMs <= 0) {
      // Timer finished while we were away.
      setSecondsLeft(0);
    } else {
      setSecondsLeft(Math.ceil(remainingMs / 1000));
    }
  }, []);

  useEffect(() => {
    if (running) {
      // Record the absolute end time so the timer survives backgrounding.
      if (!endTimeRef.current) {
        endTimeRef.current = Date.now() + secondsLeft * 1000;
      }
      persistTimerState(endTimeRef.current, secondsLeft, mode, pomodoro, totalSeconds);
      intervalRef.current = setInterval(() => {
        if (!endTimeRef.current) return;
        const now = Date.now();
        const remainingMs = endTimeRef.current - now;
        if (remainingMs <= 0) {
          setSecondsLeft(0);
        } else {
          setSecondsLeft(Math.ceil(remainingMs / 1000));
        }
      }, 500); // 500ms for smoother countdown
    } else {
      endTimeRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  }, [running, mode, pomodoro, totalSeconds]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync timer when app/tab returns to foreground — handles background throttle.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && runningRef.current && endTimeRef.current) {
        syncFromEndTime(mode, pomodoro, totalSeconds);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [mode, pomodoro, totalSeconds, syncFromEndTime]);

  // Restore timer state on mount (if app was backgrounded mid-session).
  useEffect(() => {
    try {
      const raw = localStorage.getItem("proflow-focus-timer");
      if (raw) {
        const saved = JSON.parse(raw) as { endTime: number; secondsLeft: number; mode: string; pomodoro: number; total: number };
        if (saved.endTime && Date.now() < saved.endTime) {
          // Timer was still running when the app was backgrounded — resume it.
          endTimeRef.current = saved.endTime;
          setMode(saved.mode as TimerMode);
          setPomodoro(saved.pomodoro);
          setTotalSeconds(saved.total);
          setSecondsLeft(Math.ceil((saved.endTime - Date.now()) / 1000));
          setRunning(true);
        } else if (saved.endTime && saved.secondsLeft !== undefined) {
          // Timer expired while backgrounded — show final state.
          setMode(saved.mode as TimerMode);
          setPomodoro(saved.pomodoro);
          setTotalSeconds(saved.total);
          setSecondsLeft(0);
          clearPersistedTimer();
        }
      }
    } catch { /* noop */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startTimer = useCallback(() => {
    // When resuming from pause, recalculate the end time from the current remaining.
    endTimeRef.current = Date.now() + secondsLeft * 1000;
    persistTimerState(endTimeRef.current, secondsLeft, mode, pomodoro, totalSeconds);
    setRunning(true);
  }, [secondsLeft, mode, pomodoro, totalSeconds, persistTimerState]);

  const pauseTimer = useCallback(() => {
    endTimeRef.current = null;
    clearPersistedTimer();
    setRunning(false);
  }, [clearPersistedTimer]);

  const toggleTimer = useCallback(() => {
    if (runningRef.current) {
      pauseTimer();
    } else {
      startTimer();
    }
  }, [startTimer, pauseTimer]);

  const applyMode = useCallback((m: TimerMode) => {
    setMode(m)
    const total = (m === "focus" ? focusMinutes : breakMinutes) * 60
    setTotalSeconds(total)
    setSecondsLeft(total)
  }, [focusMinutes, breakMinutes])

  // Real focus tracking: every COMPLETED focus interval (timer ran down to
  // zero) counts toward the dashboard stats and the 7-day chart. Skipped or
  // stopped sessions don't count. Persisted via localStorage.
  const recordFocusSession = useCallback(() => {
    const key = todayKey()
    setFocusLog((prev) => {
      const existing = prev.find((e) => e.date === key)
      if (existing) {
        return prev.map((e) =>
          e.date === key ? { ...e, minutes: e.minutes + focusMinutes, sessions: e.sessions + 1 } : e,
        )
      }
      return [...prev, { date: key, minutes: focusMinutes, sessions: 1 }]
    })
    // Focus badges: this just-completed session pushes the lifetime total up by
    // one — award any milestone thresholds it crosses.
    checkFocusMilestones(totalFocusRef.current + 1)
    // The dopamine hit for finishing a focus session.
    addXp(25)
    celebrate({ big: true })
  }, [focusMinutes, setFocusLog, addXp, checkFocusMilestones])

  // Session end: chime / notify / auto-advance according to preferences.
  useEffect(() => {
    if (secondsLeft !== 0 || !running) return
    // Clear the persisted timer since the session finished.
    endTimeRef.current = null
    clearPersistedTimer()
    // A finished FOCUS interval is real focus time.
    if (mode === "focus") recordFocusSession()
    const prefOn = (id: string) => prefs.some((p) => p.id === id && p.on)
    if (prefOn("soundEnd")) playChime()
    if (prefOn("focusReminders")) {
      showNotification(
        mode === "focus" ? "Focus session complete" : "Break over",
        mode === "focus" ? "Great work — time for a break!" : "Ready for another focus session?",
      )
    }
    // Always auto-advance: focus → break → focus
    if (mode === "focus") setPomodoro((p) => (p >= totalPomodoros ? 1 : p + 1))
    applyMode(mode === "focus" ? "break" : "focus")
    setRunning(true)
  }, [secondsLeft, running, mode, prefs, applyMode, totalPomodoros, recordFocusSession, clearPersistedTimer])

  // When the timer is idle, reflect the configured durations immediately.
  useEffect(() => {
    if (running) return
    const desired = (mode === "focus" ? focusMinutes : breakMinutes) * 60
    if (totalSeconds !== desired) {
      setTotalSeconds(desired)
      setSecondsLeft(desired)
    }
  }, [focusMinutes, breakMinutes, mode, running, totalSeconds])

  const skipTimer = useCallback(() => {
    endTimeRef.current = null
    clearPersistedTimer()
    setRunning(false)
    if (mode === "focus") {
      setPomodoro((p) => (p >= totalPomodoros ? 1 : p + 1))
      applyMode("break")
    } else {
      applyMode("focus")
    }
  }, [mode, applyMode, clearPersistedTimer])

  const stopTimer = useCallback(() => {
    endTimeRef.current = null
    clearPersistedTimer()
    setRunning(false)
    applyMode("focus")
    setPomodoro(1)
  }, [applyMode, clearPersistedTimer])

  const resetTimer = useCallback(() => {
    endTimeRef.current = null
    clearPersistedTimer()
    setRunning(false)
    setSecondsLeft(totalSeconds)
  }, [totalSeconds, clearPersistedTimer])

  // Wipe every piece of local data — Settings → "Clear all data".
  // The source ships empty, so any lingering demo/test data lives in
  // localStorage; this removes it all and resets state to fresh defaults.
  const resetAllData = useCallback(() => {
    // 1) Remove every persisted key (tasks, habits, notes, settings, etc.).
    try {
      const doomed: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith("proflow-")) doomed.push(k)
      }
      doomed.forEach((k) => localStorage.removeItem(k))
    } catch {
      // storage unavailable — state reset below still applies for this session
    }
    // 2) Reset in-memory state to fresh defaults.
    setRawTasks([])
    setRawHabits([])
    setRawGoals([])
    setRawEvents([])
    setRawNotes([])
    setRawNoteHistory({})
    setRawNotifications([])
    setRawFocusLog([])
    // Gamification ledgers reset locally.
    setRawXpEvents([])
    xpRef.current = 0
    setXp(0)
    setRawShieldEvents([])
    shieldsRef.current = 0
    miniShieldsRef.current = {}
    setStreakShields(0)
    setRawLastHabitCheck("")
    shieldMilestoneRef.current = 0
    setRawLastShieldMilestone(0)
    setRawAchievements({})
    achievementsRef.current = {}
    setRawBestStreak(0)
    bestStreakRef.current = 0
    setTotalTasksDone(0)
    totalTasksRef.current = 0
    setRawRecurringLog([])
    totalFocusRef.current = 0
    setPendingBadges([])
    setRawUserName("You")
    setRawAvatarUrl("")
    setRawTheme("Purple")
    setRawColorMode("dark")
    setRawPrefs(defaultPrefs)
    setShowTour(false)
    setSessionCount(0)
    setRawFocusMinutes(DEFAULT_FOCUS_MINUTES)
    setRawBreakMinutes(DEFAULT_BREAK_MINUTES)
    setRawWeeklyFocusGoal(DEFAULT_WEEKLY_FOCUS_GOAL)
    setTotalSeconds(DEFAULT_FOCUS_MINUTES * 60)
    setSecondsLeft(DEFAULT_FOCUS_MINUTES * 60)
    setMode("focus")
    setPomodoro(1)
    setRunning(false)
    // Drop any OS reminders the Android plugin scheduled for old events.
    cancelAllReminders()
  }, [
    setRawTasks,
    setRawHabits,
    setRawGoals,
    setRawEvents,
    setRawNotes,
    setRawNotifications,
    setRawFocusLog,
    setRawXpEvents,
    setXp,
    setRawShieldEvents,
    setStreakShields,
    setRawLastHabitCheck,
    setRawLastShieldMilestone,
    setRawAchievements,
    setRawBestStreak,
    setTotalTasksDone,
    setRawRecurringLog,
    setPendingBadges,
    setRawUserName,
    setRawAvatarUrl,
    setRawTheme,
    setRawColorMode,
    setRawPrefs,
    setShowTour,
    setSessionCount,
    setRawFocusMinutes,
    setRawBreakMinutes,
    setRawWeeklyFocusGoal,
    setTotalSeconds,
    setSecondsLeft,
    setMode,
    setPomodoro,
    setRunning,
  ])

  const addTask = useCallback<Store["addTask"]>((t) => {
    setTasks((prev) => [
      {
        ...t,
        id: `t-${Date.now()}`,
        status: t.status ?? "todo",
      },
      ...prev,
    ])
  }, [])

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // Edit a task's details in place — status/completedAt are deliberately not
  // editable here (the checkbox owns status transitions and their rewards).
  const updateTask = useCallback<Store["updateTask"]>((id, updates) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)))
  }, [])

  const reorderTasks = useCallback((ids: string[]) => {
    setTasks((prev) => {
      const map = new Map(prev.map((t) => [t.id, t]))
      const reordered = ids.map((id) => map.get(id)).filter((t): t is Task => !!t)
      const remaining = prev.filter((t) => !ids.includes(t.id))
      return [...reordered, ...remaining]
    })
  }, [])

  const cycleTaskStatus = useCallback(
    (id: string) => {
      const t = tasks.find((x) => x.id === id)
      const next: TaskStatus = t
        ? t.status === "todo"
          ? "in-progress"
          : t.status === "in-progress"
            ? "done"
            : "todo"
        : "todo"
      // Reward + cheer only when a task is actually completed — and only the
      // first completion of the day, so done → todo → done can't farm XP.
      if (t && t.status !== "done" && next === "done" && t.completedAt !== todayKey()) {
        addXp(10)
        celebrate()
        // Every occurrence of a repeating task counts toward 10/50/100 tasks.
        if (!t.completedAt || t.recurring) checkTaskMilestones()
      }
      // A completed repeating task rolls forward to its next occurrence instead
      // of staying "done": same title/project/priority, due advanced a week or
      // a month. The XP reward above already fired for this occurrence, and the
      // completion is logged so it counts toward the lifetime counter + charts.
      if (t?.recurring && next === "done") {
        const nextDue = advanceRecurringDue(t)
        setRawRecurringLog((prev) => [...prev.slice(-999), todayKey()])
        setTasks((prev) =>
          prev.map((x) =>
            x.id === id
              ? { ...x, status: "todo", due: nextDue, overdue: false, completedAt: "" }
              : x,
          ),
        )
        showNotification(
          "ProFlow",
          `🔁 Completed — next occurrence ${nextDue} (${t.recurring === "weekly" ? "weekly" : "monthly"})`,
        )
        return
      }
      // Move completed task to completedTasks (with restore window) instead of
      // keeping it in the active list.
      if (next === "done") {
        const completed: CompletedTask = {
          ...tasks.find((x) => x.id === id)!,
          status: "done",
          overdue: false,
          completedAt: todayKey(),
          completedAtMs: Date.now(),
        }
        setCompletedTasks((prev) => [...prev, completed])
        setTasks((prev) => prev.filter((x) => x.id !== id))
        showNotification("ProFlow", "✅ Task completed — tap undo to restore within 24h")
      } else {
        setTasks((prev) =>
          prev.map((x) =>
            x.id === id
              ? {
                  ...x,
                  status: next,
                }
              : x,
          ),
        )
      }
    },
    [tasks, addXp, checkTaskMilestones, setCompletedTasks],
  )

  const setTaskStatus = useCallback(
    (id: string, status: TaskStatus) => {
      const t = tasks.find((x) => x.id === id)
      if (t && t.status !== "done" && status === "done" && t.completedAt !== todayKey()) {
        addXp(10)
        celebrate()
        if (!t.completedAt || t.recurring) checkTaskMilestones()
      }
      // Repeating task: completing rolls it forward instead of leaving it done.
      if (t?.recurring && status === "done") {
        const nextDue = advanceRecurringDue(t)
        setRawRecurringLog((prev) => [...prev.slice(-999), todayKey()])
        setTasks((prev) =>
          prev.map((x) =>
            x.id === id
              ? { ...x, status: "todo", due: nextDue, overdue: false, completedAt: "" }
              : x,
          ),
        )
        showNotification(
          "ProFlow",
          `🔁 Completed — next occurrence ${nextDue} (${t.recurring === "weekly" ? "weekly" : "monthly"})`,
        )
        return
      }
      // Move completed task to completedTasks (with restore window)
      if (status === "done") {
        const completed: CompletedTask = {
          ...t!,
          status: "done",
          overdue: false,
          completedAt: todayKey(),
          completedAtMs: Date.now(),
        }
        setCompletedTasks((prev) => [...prev, completed])
        setTasks((prev) => prev.filter((x) => x.id !== id))
        showNotification("ProFlow", "✅ Task completed — tap undo to restore within 24h")
        return
      }
      setTasks((prev) =>
        prev.map((x) =>
          x.id === id
            ? {
                ...x,
                status,
              }
            : x,
        ),
      )
    },
    [tasks, addXp, checkTaskMilestones, setCompletedTasks],
  )

  // Marking a habit done pays out once per day; unchecking is a FULL undo — the
  // day's XP is revoked through the same ledger (mirroring the +5) and the
  // streak credit removed, so an accidental check costs nothing. Check + uncheck
  // nets exactly 0 XP and 0 streak, so toggling can't farm either.
  const toggleHabit = useCallback(
    (id: string) => {
      const h = habits.find((x) => x.id === id)
      if (!h) return
      const today = todayKey()
      if (!h.doneToday) {
        // not-done → done: reward the first completion of the day.
        if (h.rewardedDay !== today) {
          addXp(5)
          celebrate()
          // Milestone: a habit just crossed 3/7/14 days.
          checkStreakMilestones(h.streak + 1)
          setHabits((prev) =>
            prev.map((x) =>
              x.id === id ? { ...x, doneToday: true, streak: x.streak + 1, rewardedDay: today, completedDays: (x.completedDays||[]).includes(today) ? (x.completedDays||[]) : [...(x.completedDays||[]), today] } : x,
            ),
          )
        } else {
          // Safety net: day already paid (can't normally happen after an undo,
          // which clears rewardedDay) — just re-tick without re-paying.
          setHabits((prev) => prev.map((x) => (x.id === id ? { ...x, doneToday: true } : x)))
        }
      } else {
        // done → not-done: full undo — revoke the XP granted today (if any) so
        // a mistaken check doesn't leave a permanent +5. Unique ledger event;
        // the display cache re-derives from the ledger so the balance drops.
        if (h.rewardedDay === today) {
          xpRef.current -= 5
          const stamp = Date.now()
          const rand = Math.random().toString(36).slice(2, 8)
          setXpEvents((prev) => [...prev, { id: `revoke-${stamp}-${rand}`, amount: -5 }])
          setXp(Math.max(0, xpRef.current))
        }          setHabits((prev) =>
            prev.map((x) =>
              x.id === id
                ? { ...x, doneToday: false, streak: Math.max(0, x.streak - 1), rewardedDay: "", completedDays: (x.completedDays||[]).filter((d) => d !== today) }
                : x,
            ),
          )
      }
    },
    [habits, addXp, checkStreakMilestones, setXp, setXpEvents],
  )

  const addHabit = useCallback<Store["addHabit"]>((name, week, reminderEnabled, reminderTime) => {
    setHabits((prev) => [
      {
        id: `h-${Date.now()}`, name, streak: 0, doneToday: false,
        week: week ?? [true, true, true, true, true, true, false],
        shields: 0, rewardedDay: "", completedDays: [],
        reminderEnabled: reminderEnabled ?? false,
        reminderTime: reminderTime ?? "09:00",
      },
      ...prev,
    ])
  }, [])

  // Edit a habit's name / weekly schedule. Streak & doneToday are preserved —
  // only the schedule and label change, so a rename never costs progress.
  const updateHabit = useCallback<Store["updateHabit"]>((id, updates) => {
    setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, ...updates } : h)))
  }, [])

  // Deleting a habit refunds the XP spent on its mini shields through the
  // same xpEvents ledger (the authoritative source), instead of silently
  // eating the spend. `miniShieldsRef` makes this race-safe: a double-tap on
  // the delete button sees the count zeroed synchronously after the first
  // refund, so the shields can't be cashed in twice.
  const deleteHabit = useCallback(
    (id: string) => {
      const owned = miniShieldsRef.current[id] ?? 0
      const refund = owned * HABIT_SHIELD_PRICE
      if (refund > 0) {
        miniShieldsRef.current = { ...miniShieldsRef.current, [id]: 0 }
        xpRef.current += refund
        const stamp = Date.now()
        const rand = Math.random().toString(36).slice(2, 8)
        setXpEvents((prev) => [...prev, { id: `refund-${stamp}-${rand}`, amount: refund }])
        setXp(Math.max(0, xpRef.current))
        const name = habits.find((x) => x.id === id)?.name
        showNotification("ProFlow", `💸 ${refund} XP refunded for ${owned} mini shield${owned > 1 ? "s" : ""} on "${name ?? "habit"}"`)
      }
      setHabits((prev) => prev.filter((h) => h.id !== id))
    },
    [habits, setHabits, setXp, setXpEvents],
  )

  const addGoal = useCallback<Store["addGoal"]>((name, progress) => {
    setGoals((prev) => [
      {
        id: `g-${Date.now()}`,
        name,
        progress: progress ?? 0,
        status: "on-track",
      },
      ...prev,
    ])
  }, [])

  const updateGoal = useCallback((id: string, updates: Partial<Goal>) => {
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== id) return g
        const progress = updates.progress ?? g.progress
        return { ...g, ...updates, status: progress >= 50 ? "on-track" : "at-risk" }
      }),
    )
  }, [])

  const deleteGoal = useCallback((id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id))
  }, [])

  const addNote = useCallback<Store["addNote"]>((n) => {
    const id = `n-${Date.now()}`
    setNotes((prev) => [{ id, updated: "just now", pinned: false, attachments: [], ...n }, ...prev])
    return id
  }, [])

  // Snapshot the note's current text fields BEFORE an update overwrites them,
  // so every save is recoverable. Deduplicates consecutive identical saves and
  // caps storage: 15 versions per note, 300 snapshots total across all notes.
  const snapshotNote = useCallback((cur: Note) => {
    setRawNoteHistory((prev) => {
      const prevList = prev[cur.id] ?? []
      const last = prevList[prevList.length - 1]
      if (last && last.title === cur.title && last.body === cur.body && last.tag === cur.tag) return prev
      const fresh: NoteVersion = {
        id: `v-${Date.now()}`,
        title: cur.title,
        body: cur.body,
        tag: cur.tag,
        at: Date.now(),
      }
      // next's first prevList.length entries mirror prev[cur.id] — keep that
      // mapping so the global trim below can filter it without resurrecting
      // entries it just dropped for the note being saved.
      const next = [...prevList, fresh].slice(-15)
      const total = Object.values(prev).reduce((acc, l) => acc + l.length, 0)
      if (total > 300) {
        // Drop the oldest snapshots across all notes until under the cap.
        const all: { noteId: string; idx: number; at: number }[] = []
        for (const [noteId, l] of Object.entries(prev)) l.forEach((v, idx) => all.push({ noteId, idx, at: v.at }))
        all.sort((a, b) => a.at - b.at)
        const drop = new Set<string>()
        for (let over = total - 300, i = 0; over > 0 && i < all.length; i++, over--) drop.add(`${all[i].noteId}:${all[i].idx}`)
        const trimmed: Record<string, NoteVersion[]> = {}
        for (const [noteId, l] of Object.entries(prev)) {
          const kept = l.filter((_v, idx) => !drop.has(`${noteId}:${idx}`))
          if (kept.length) trimmed[noteId] = kept
        }
        const keptNext = next.filter((_v, idx) => idx >= prevList.length || !drop.has(`${cur.id}:${idx}`))
        return { ...trimmed, [cur.id]: keptNext }
      }
      return { ...prev, [cur.id]: next }
    })
  }, [])

  // Edit an existing note — snapshot the current version, then apply the
  // editable fields and mark it fresh.
  const updateNote = useCallback<Store["updateNote"]>((id, updates) => {
    const cur = notes.find((n) => n.id === id)
    if (cur) snapshotNote(cur)
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...updates, updated: "just now" } : n)))
  }, [notes, snapshotNote])

  // Restore a past version. The CURRENT version is snapshotted first, so a
  // restore is itself reversible from the history list.
  const restoreNoteVersion = useCallback((id: string, v: NoteVersion) => {
    const cur = notes.find((n) => n.id === id)
    if (cur) snapshotNote(cur)
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, title: v.title, body: v.body, tag: v.tag, updated: "just now" } : n)),
    )
  }, [notes, snapshotNote])

  const deleteNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id))
    // A deleted note's history is orphaned — drop it to avoid a leak.
    setRawNoteHistory((prev) => {
      const { [id]: _removed, ...rest } = prev
      return rest
    })
  }, [])

  const addEvent = useCallback((e: Omit<EventItem, "id">) => {
    setEvents((prev) => [{ id: `e-${Date.now()}`, ...e }, ...prev])
  }, [])

  const updateEvent = useCallback((id: string, updates: Partial<EventItem>) => {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)))
  }, [])

  const deleteEvent = useCallback((id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id))
  }, [])

  const markRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }, [])

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [])

  const deleteNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const clearNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  // ── Checklists ──────────────────────────────────────────
  const addChecklist = useCallback(
    (name: string, icon = "📝", color = "#9CA3AF") => {
      const id = `cl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const list: Checklist = {
        id, name, icon, color, pinned: false, items: [],
        createdAt: new Date().toISOString(),
      }
      setChecklists((prev) => [list, ...prev])
      return id
    },
    [setChecklists],
  )

  const updateChecklist = useCallback(
    (id: string, updates: Partial<Pick<Checklist, "name" | "icon" | "color" | "pinned" | "recurring" | "archived">>) => {
      setChecklists((prev) => prev.map((cl) => (cl.id === id ? { ...cl, ...updates } : cl)))
    },
    [setChecklists],
  )

  const deleteChecklist = useCallback(
    (id: string) => setChecklists((prev) => prev.filter((cl) => cl.id !== id)),
    [setChecklists],
  )

  const importChecklistFromTemplate = useCallback(
    (templateId: string) => {
      // Lazy import to avoid circular dep — templates are a pure data module
      const { CHECKLIST_TEMPLATES } = require("./checklist-templates")
      const tpl = CHECKLIST_TEMPLATES.find((t: any) => t.id === templateId)
      if (!tpl) return ""
      const now = new Date().toISOString()
      const items: ChecklistItem[] = tpl.items.map((item: any, i: number) => ({
        id: `cli-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        title: item.title,
        done: false,
        priority: (item.priority ?? "medium") as Priority,
        due: "",
        notes: "",
        subtasks: (item.subtasks ?? []).map((st: string, j: number) => ({
          id: `st-${Date.now()}-${i}-${j}-${Math.random().toString(36).slice(2, 6)}`,
          title: st,
          done: false,
        })),
        createdAt: now,
        order: i,
      }))
      const id = `cl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const list: Checklist = {
        id, name: tpl.name, icon: tpl.icon, color: tpl.color,
        pinned: false, items, createdAt: now,
      }
      setChecklists((prev) => [list, ...prev])
      return id
    },
    [setChecklists],
  )

  const addChecklistItem = useCallback(
    (listId: string, title: string, priority: Priority = "medium") => {
      const item: ChecklistItem = {
        id: `cli-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title, done: false, priority, due: "", notes: "", subtasks: [],
        createdAt: new Date().toISOString(), order: Date.now(),
      }
      setChecklists((prev) => prev.map((cl) =>
        cl.id === listId ? { ...cl, items: [...cl.items, item] } : cl,
      ))
    },
    [setChecklists],
  )

  const updateChecklistItem = useCallback(
    (listId: string, itemId: string, updates: Partial<Pick<ChecklistItem, "title" | "done" | "priority" | "due" | "notes"> & { subtasks?: SubTask[] }>) => {
      setChecklists((prev) => prev.map((cl) => {
        if (cl.id !== listId) return cl
        return {
          ...cl,
          items: cl.items.map((it) => {
            if (it.id !== itemId) return it
            const next = { ...it, ...updates }
            // Auto-set completedAt when toggling done
            if (updates.done === true && !it.done) next.completedAt = new Date().toISOString()
            if (updates.done === false) next.completedAt = undefined
            return next
          }),
        }
      }))
    },
    [setChecklists],
  )

  const deleteChecklistItem = useCallback(
    (listId: string, itemId: string) => {
      setChecklists((prev) => prev.map((cl) =>
        cl.id === listId ? { ...cl, items: cl.items.filter((it) => it.id !== itemId) } : cl,
      ))
    },
    [setChecklists],
  )

  const toggleChecklistItem = useCallback(
    (listId: string, itemId: string) => {
      const cl = checklists.find((c) => c.id === listId)
      const item = cl?.items.find((it) => it.id === itemId)
      const wasDone = item?.done ?? false
      setChecklists((prev) => prev.map((c) => {
        if (c.id !== listId) return c
        return {
          ...c,
          items: c.items.map((it) => {
            if (it.id !== itemId) return it
            const done = !it.done
            return {
              ...it, done,
              completedAt: done ? new Date().toISOString() : undefined,
            }
          }),
        }
      }))
      if (!wasDone) {
        addXp(5)
        celebrate()
        checkTaskMilestones()
      }
    },
    [setChecklists, checklists, addXp, checkTaskMilestones],
  )

  const reorderChecklistItems = useCallback(
    (listId: string, itemIds: string[]) => {
      setChecklists((prev) => prev.map((cl) => {
        if (cl.id !== listId) return cl
        const map = new Map(cl.items.map((it) => [it.id, it]))
        return {
          ...cl,
          items: itemIds.map((id, i) => ({ ...map.get(id)!, order: i })).filter(Boolean),
        }
      }))
    },
    [setChecklists],
  )

  const bulkToggleChecklistItems = useCallback(
    (listId: string, itemIds: string[], done: boolean) => {
      const now = new Date().toISOString()
      setChecklists((prev) => prev.map((cl) => {
        if (cl.id !== listId) return cl
        return {
          ...cl,
          items: cl.items.map((it) => {
            if (!itemIds.includes(it.id)) return it
            return { ...it, done, completedAt: done ? now : undefined }
          }),
        }
      }))
    },
    [setChecklists],
  )

  const clearCompletedItems = useCallback(
    (listId: string) => {
      setChecklists((prev) => prev.map((cl) =>
        cl.id === listId ? { ...cl, items: cl.items.filter((it) => !it.done) } : cl,
      ))
    },
    [setChecklists],
  )

  const duplicateChecklist = useCallback(
    (listId: string) => {
      setChecklists((prev) => {
        const src = prev.find((cl) => cl.id === listId)
        if (!src) return prev
        const now = new Date().toISOString()
        const id = `cl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const dup: Checklist = {
          ...src,
          id,
          name: `${src.name} (copy)`,
          pinned: false,
          createdAt: now,
          items: src.items.map((it, i) => ({
            ...it,
            id: `cli-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
            done: false,
            completedAt: undefined,
            createdAt: now,
            subtasks: it.subtasks.map((st, j) => ({
              ...st,
              id: `st-${Date.now()}-${i}-${j}-${Math.random().toString(36).slice(2, 6)}`,
              done: false,
            })),
          })),
        }
        return [dup, ...prev]
      })
    },
    [setChecklists],
  )

  const value = useMemo<Store>(() => ({
      view,
      setView,
      search,
      setSearch,      tasks,
      completedTasks,
      projects,
      addTask, deleteTask, restoreTask, reorderTasks, cycleTaskStatus, setTaskStatus, updateTask, habits,
      addHabit,
      deleteHabit,
      toggleHabit,
      updateHabit,
      goals,
      addGoal,
      updateGoal,
      deleteGoal,
      events,
      addEvent,
      updateEvent,
      deleteEvent,
      notes,
      addNote,
      updateNote,
      deleteNote,
      noteHistory,
      restoreNoteVersion,
      notifications,
      markRead,
      markAllRead,
      deleteNotification,
      clearNotifications,
      userName,
      setUserName,
      avatarUrl,
      setAvatarUrl,
      theme,
      setTheme,
      colorMode,
      setColorMode,
      prefs,
      togglePref,
      showTour,
      dismissTour,
      startTour,
      sessionCount,
      resetAllData,
      focusMode,
      toggleFocusMode,
      sidebarOpen,
      toggleSidebar,
      closeSidebar,
      secondsLeft,
      totalSeconds,
      running,
      mode,
      pomodoro,
      totalPomodoros,
      sessionLabel,
      focusMinutes,
      breakMinutes,
      focusLog,
      recordFocusSession,
      xp,
      addXp,
      streakShields,
      buyShield,
      buyHabitShield,
      undoLastShieldUse,
      achievements,
      bestStreak,
      totalTasksDone,
      recurringLog,
      pendingBadges,
      dismissBadge,
    setFocusMinutes,
    setBreakMinutes,
    weeklyFocusGoal,
    setWeeklyFocusGoal,
    startTimer,
    pauseTimer,
    toggleTimer,
    skipTimer,
    stopTimer,
    resetTimer,
    checklists, addChecklist, updateChecklist, deleteChecklist, importChecklistFromTemplate,
    addChecklistItem, updateChecklistItem, deleteChecklistItem, toggleChecklistItem,
    reorderChecklistItems, bulkToggleChecklistItems, clearCompletedItems, duplicateChecklist,
  }),
    [
      view, search, tasks, completedTasks, projects, addTask, deleteTask, restoreTask, reorderTasks, cycleTaskStatus, setTaskStatus, updateTask, habits,
      addHabit, deleteHabit, toggleHabit, updateHabit, goals, addGoal, updateGoal, deleteGoal, events, addEvent, updateEvent, deleteEvent,
      notes, addNote, updateNote, deleteNote, notifications, markRead, markAllRead, deleteNotification, clearNotifications,
      focusMode, toggleFocusMode, sidebarOpen, toggleSidebar, closeSidebar, userName, setUserName, avatarUrl, setAvatarUrl,
      theme, setTheme, colorMode, setColorMode, prefs, togglePref, showTour, dismissTour, startTour, sessionCount, resetAllData,
      secondsLeft, totalSeconds, running, mode, pomodoro, sessionLabel,
      focusMinutes, breakMinutes, weeklyFocusGoal, setWeeklyFocusGoal, focusLog, recordFocusSession, xp, addXp,
      streakShields, buyShield, buyHabitShield,
      achievements, bestStreak, totalTasksDone, recurringLog, pendingBadges, dismissBadge,      setFocusMinutes,
      setBreakMinutes,
      startTimer, pauseTimer, toggleTimer, skipTimer, stopTimer, resetTimer,
      weeklyFocusGoal, setWeeklyFocusGoal,
      checklists, addChecklist, updateChecklist, deleteChecklist, importChecklistFromTemplate,
      addChecklistItem, updateChecklistItem, deleteChecklistItem, toggleChecklistItem,
      reorderChecklistItems, bulkToggleChecklistItems, clearCompletedItems, duplicateChecklist,
    ],
  )

  // Push today's data to native Android widgets on every relevant change
  useEffect(() => {
    const today = todayKey()
    const pending = tasks
      .filter((t) => t.status !== "done")
      .map((t) => t.title)
      .join("\n")
    updateWidgets({
      tasksDone: completedTasks.filter((t) => t.completedAt === today).length + recurringLog.filter((d) => d === today).length,
      habitsDone: habits.filter((h) => h.doneToday).length,
      focusMinutes: focusLog.find((e) => e.date === today)?.minutes ?? 0,
      streak: bestStreak,
      pendingTasks: pending,
    })
    // Push habit list for interactive habits widget (id|name|done|streak)
    const todayIdx = (new Date().getDay() + 6) % 7
    const habitsData = habits
      .filter((h) => h.week?.[todayIdx])
      .map((h) => `${h.id}|${h.name}|${h.doneToday}|${h.streak}`)
      .join("\n")
    updateHabitWidget(habitsData)
    // Push task list for interactive tasks widget (id|title|done|priority)
    const tasksData = tasks
      .map((t) => `${t.id}|${t.title}|${t.status === "done"}|${t.priority}`)
      .join("\n")
    updateTaskWidget(tasksData)
  }, [tasks, completedTasks, habits, focusLog, bestStreak, recurringLog])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error("useStore must be used within ProFlowProvider")
  return ctx
}

export function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}
