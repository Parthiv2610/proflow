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
import {
  buildCapLanInfo,
  clearPasscode,
  detectLan,
  getStoredEnabled,
  lanPull,
  lanPushSnapshot,
  setStoredEnabled,
  setStoredLaptopUrl,
  storePasscode,
  type LanInfo,
  type SyncSnapshot,
} from "@/lib/lan-sync"

export type View =
  | "dashboard"
  | "tasks"
  | "calendar"
  | "notes"
  | "habits"
  | "focus"
  | "notifications"
  | "settings"

export type TaskStatus = "todo" | "in-progress" | "done"
export type Priority = "low" | "medium" | "high"

export type Task = {
  id: string
  title: string
  project: string
  category: string
  priority: Priority
  status: TaskStatus
  due: string
  overdue?: boolean
}

export type Habit = {
  id: string
  name: string
  streak: number
  doneToday: boolean
  week: boolean[]
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

export type Note = {
  id: string
  title: string
  body: string
  tag: string
  updated: string
}

export type AppNotification = {
  id: string
  title: string
  desc: string
  time: string
  read: boolean
  type: "task" | "event" | "habit" | "system"
}

type TimerMode = "focus" | "break"

export type Pref = { id: string; label: string; desc: string; on: boolean }

// Sensible, real preference defaults (each one is wired to actual behavior).
export const defaultPrefs: Pref[] = [
  { id: "desktopNotif", label: "Desktop notifications", desc: "Show an OS notification when tasks are overdue or you have events today.", on: true },
  { id: "focusReminders", label: "Focus session reminders", desc: "Nudge me when a focus session ends.", on: true },
  { id: "soundEnd", label: "Sound when timer ends", desc: "Play a chime when the timer finishes a session.", on: true },
  { id: "autoBreaks", label: "Auto-start breaks", desc: "Begin the break timer automatically after focus.", on: false },
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
  Green: {
    primary: "oklch(0.68 0.16 155)",
    fg: "oklch(0.2 0.02 155)",
    accent: "oklch(0.3 0.05 155)",
  },
  Amber: {
    primary: "oklch(0.76 0.15 70)",
    fg: "oklch(0.2 0.02 70)",
    accent: "oklch(0.35 0.06 70)",
  },
}

type Store = {
  view: View
  setView: (v: View) => void

  search: string
  setSearch: (s: string) => void

  tasks: Task[]
  projects: string[]
  addTask: (t: Omit<Task, "id" | "status"> & { status?: TaskStatus }) => void
  deleteTask: (id: string) => void
  reorderTasks: (ids: string[]) => void
  cycleTaskStatus: (id: string) => void
  setTaskStatus: (id: string, status: TaskStatus) => void

  habits: Habit[]
  addHabit: (name: string, week?: boolean[]) => void
  deleteHabit: (id: string) => void
  toggleHabit: (id: string) => void

  goals: Goal[]
  addGoal: (name: string, progress?: number) => void
  updateGoal: (id: string, updates: Partial<Goal>) => void
  deleteGoal: (id: string) => void
  events: EventItem[]
  addEvent: (e: Omit<EventItem, "id">) => void
  updateEvent: (id: string, updates: Partial<EventItem>) => void
  deleteEvent: (id: string) => void
  notes: Note[]
  addNote: (n: Pick<Note, "title" | "body" | "tag">) => void
  deleteNote: (id: string) => void

  notifications: AppNotification[]
  markRead: (id: string) => void
  markAllRead: () => void

  userName: string
  setUserName: (n: string) => void
  avatarUrl: string
  setAvatarUrl: (url: string) => void

  theme: string
  setTheme: (t: string) => void
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

  // LAN sync (phone ↔ laptop over Wi-Fi, no account)
  lanInfo: LanInfo | null
  lanAuthed: boolean
  lanOnline: boolean
  lanBusy: boolean
  lanError: string | null
  lastSyncedAt: number | null
  lanGateOpen: boolean
  enableLan: () => Promise<void>
  disableLan: () => Promise<void>
  regenLanPasscode: () => Promise<void>
  submitLanPasscode: (code: string) => Promise<"ok" | "wrong-code" | "unreachable">
  disconnectPhone: () => void
  openLanGate: () => void
  closeLanGate: () => void
  connectToLaptop: (url: string) => Promise<"ok" | "wrong-code" | "unreachable">

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
  setFocusMinutes: (n: number) => void
  setBreakMinutes: (n: number) => void
  startTimer: () => void
  pauseTimer: () => void
  toggleTimer: () => void
  skipTimer: () => void
  stopTimer: () => void
  resetTimer: () => void
}

const StoreContext = createContext<Store | null>(null)

const DEFAULT_FOCUS_MINUTES = 25
const DEFAULT_BREAK_MINUTES = 5

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
  const [habits, setRawHabits] = useLocalStorage<Habit[]>("habits", initialHabits)
  const [goals, setRawGoals] = useLocalStorage<Goal[]>("goals", initialGoals)
  const [events, setRawEvents] = useLocalStorage<EventItem[]>("events", initialEvents)
  const [notes, setRawNotes] = useLocalStorage<Note[]>("notes", initialNotes)
  const [notifications, setRawNotifications] = useLocalStorage<AppNotification[]>("notifications", initialNotifications)

  // user name
  const [userName, setRawUserName] = useLocalStorage("userName", "You")

  // ── LAN sync plumbing (version-bumping setters) ────────────────
  const versionsRef = useRef<Record<string, number>>({})
  const lastPushedRef = useRef<Record<string, number>>({})
  const appliedKeysRef = useRef<Set<string>>(new Set())
  const applyingRemoteRef = useRef(false)
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const snapRef = useRef<SyncSnapshot>({ collections: {} })
  const prevReachableRef = useRef(false)

  // Local mutations bump that collection's version (remote applies don't),
  // which is what makes merges last-write-wins *per collection*.
  const wrapSetter =
    <T,>(key: string, setter: React.Dispatch<React.SetStateAction<T>>) =>
    (u: React.SetStateAction<T>) => {
      if (!applyingRemoteRef.current) versionsRef.current[key] = Date.now()
      setter(u)
    }

  const setTasks = wrapSetter<Task[]>("tasks", setRawTasks)
  const setHabits = wrapSetter<Habit[]>("habits", setRawHabits)
  const setGoals = wrapSetter<Goal[]>("goals", setRawGoals)
  const setEvents = wrapSetter<EventItem[]>("events", setRawEvents)
  const setNotes = wrapSetter<Note[]>("notes", setRawNotes)
  const setNotifications = wrapSetter<AppNotification[]>("notifications", setRawNotifications)
  const setUserName = wrapSetter<string>("userName", setRawUserName)
  const [avatarUrl, setAvatarUrl] = useLocalStorage("avatarUrl", "")

  // theme + preferences (persisted, applied live)
  const [theme, setTheme] = useLocalStorage("settings-theme", "Purple")
  const [prefs, setPrefs] = useLocalStorage<Pref[]>("settings-prefs-v2", defaultPrefs)
  const togglePref = useCallback((id: string) => {
    setPrefs((prev) => prev.map((p) => (p.id === id ? { ...p, on: !p.on } : p)))
  }, [])

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

  // Desktop notifications — once per day, summarize overdue tasks + today's events.
  const notifiedDayRef = useRef("")
  useEffect(() => {
    if (!prefs.some((p) => p.id === "desktopNotif" && p.on)) return
    const d = new Date()
    const dayKey = d.toDateString()
    if (notifiedDayRef.current === dayKey) return
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    const overdue = tasks.filter((t) => t.overdue && t.status !== "done").length
    const eventsToday = events.filter((e) => e.date === today).length
    if (overdue === 0 && eventsToday === 0) return
    notifiedDayRef.current = dayKey
    const bits: string[] = []
    if (overdue > 0) bits.push(`${overdue} overdue task${overdue > 1 ? "s" : ""}`)
    if (eventsToday > 0) bits.push(`${eventsToday} event${eventsToday > 1 ? "s" : ""} today`)
    showNotification("ProFlow", bits.join(" · "))
  }, [prefs, tasks, events])

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

  // ── LAN sync (phone ↔ laptop over Wi-Fi, no account) ───────────
  const [lanInfo, setLanInfo] = useState<LanInfo | null>(null)
  const [lanAuthed, setLanAuthed] = useState(false)
  const [lanOnline, setLanOnline] = useState(false)
  const [lanBusy, setLanBusy] = useState(false)
  const [lanGateOpen, setLanGateOpen] = useState(false)
  const [lanError, setLanError] = useState<string | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)

  const lanActive = useMemo(
    () =>
      lanInfo?.mode === "electron"
        ? !!lanInfo.enabled
        : lanInfo?.mode === "phone" || lanInfo?.mode === "cap"
          ? lanAuthed
          : false,
    [lanInfo, lanAuthed],
  )

  // Live snapshot of everything syncable.
  useEffect(() => {
    snapRef.current = {
      collections: {
        tasks: { v: versionsRef.current.tasks ?? 0, items: tasks },
        habits: { v: versionsRef.current.habits ?? 0, items: habits },
        goals: { v: versionsRef.current.goals ?? 0, items: goals },
        events: { v: versionsRef.current.events ?? 0, items: events },
        notes: { v: versionsRef.current.notes ?? 0, items: notes },
        notifications: { v: versionsRef.current.notifications ?? 0, items: notifications },
        userName: { v: versionsRef.current.userName ?? 0, items: userName },
      },
    }
  }, [tasks, habits, goals, events, notes, notifications, userName])

  // Merge a remote snapshot — per-collection last-write-wins.
  // Uses the RAW setters; version bumps happen explicitly here.
  const applyRemote = useCallback(
    (snap: SyncSnapshot | null | undefined): boolean => {
      const cols = snap?.collections ?? {}
      let applied = false
      const apply = <T,>(key: string, items: unknown, setter: (v: T) => void) => {
        const v = cols[key]?.v ?? 0
        if (v > (versionsRef.current[key] ?? 0)) {
          versionsRef.current[key] = v
          appliedKeysRef.current.add(key)
          // Only set when something is actually applied — a stale flag would
          // swallow the version bump of the next genuine local edit.
          applyingRemoteRef.current = true
          applied = true
          setter(items as T)
        }
      }
      apply<Task[]>("tasks", cols.tasks?.items, setRawTasks)
      apply<Habit[]>("habits", cols.habits?.items, setRawHabits)
      apply<Goal[]>("goals", cols.goals?.items, setRawGoals)
      apply<EventItem[]>("events", cols.events?.items, setRawEvents)
      apply<Note[]>("notes", cols.notes?.items, setRawNotes)
      apply<AppNotification[]>("notifications", cols.notifications?.items, setRawNotifications)
      apply<string>("userName", cols.userName?.items, setRawUserName)
      return applied
    },
    [
      setRawTasks,
      setRawHabits,
      setRawGoals,
      setRawEvents,
      setRawNotes,
      setRawNotifications,
      setRawUserName,
    ],
  )

  // Actions
  const enableLan = useCallback(async () => {
    const api = (window as any).electronAPI
    if (!api?.lanSetEnabled) return
    setLanBusy(true)
    try {
      const status = await api.lanSetEnabled(true)
      setStoredEnabled(!!status.enabled)
      setLanError(status.error ? String(status.error) : null)
      setLanInfo((prev) =>
        prev
          ? {
              ...prev,
              enabled: status.enabled,
              url: status.url,
              ip: status.ip,
              port: status.port,
              passcode: status.passcode,
            }
          : prev,
      )
    } finally {
      setLanBusy(false)
    }
  }, [])

  const disableLan = useCallback(async () => {
    const api = (window as any).electronAPI
    if (!api?.lanSetEnabled) return
    setLanBusy(true)
    try {
      const status = await api.lanSetEnabled(false)
      setStoredEnabled(false)
      setLanError(null)
      setLanInfo((prev) => (prev ? { ...prev, enabled: false, url: null } : prev))
    } finally {
      setLanBusy(false)
    }
  }, [])

  const regenLanPasscode = useCallback(async () => {
    const api = (window as any).electronAPI
    if (!api?.lanRegenPasscode) return
    const status = await api.lanRegenPasscode()
    setLanInfo((prev) => (prev ? { ...prev, passcode: status.passcode } : prev))
  }, [])

  const submitLanPasscode = useCallback(
    async (code: string): Promise<"ok" | "wrong-code" | "unreachable"> => {
      storePasscode(code.trim())
      const { authed, reachable } = await lanPull()
      setLanAuthed(authed)
      if (authed) {
        setLanGateOpen(false)
        return "ok"
      }
      return reachable ? "wrong-code" : "unreachable"
    },
    [],
  )

  const disconnectPhone = useCallback(() => {
    clearPasscode()
    setStoredLaptopUrl("")
    setLanAuthed(false)
    setLanOnline(false)
    setLanInfo((prev) =>
      prev && prev.mode === "cap"
        ? { ...prev, enabled: false, url: null, ip: null, passcode: null }
        : prev,
    )
  }, [])

  // Android APK: point the app at a specific laptop's LAN URL.
  const connectToLaptop = useCallback(
    async (url: string): Promise<"ok" | "wrong-code" | "unreachable"> => {
      setStoredLaptopUrl(url)
      setLanInfo(buildCapLanInfo(url))
      const { authed, reachable } = await lanPull()
      setLanAuthed(authed)
      if (authed) {
        setLanGateOpen(false)
        return "ok"
      }
      return reachable ? "wrong-code" : "unreachable"
    },
    [],
  )

  const openLanGate = useCallback(() => setLanGateOpen(true), [])
  const closeLanGate = useCallback(() => setLanGateOpen(false), [])

  // Push the current snapshot over whichever transport is active.
  const doPushNow = useCallback(async () => {
    const pushedVersions = { ...versionsRef.current }
    let ok = false
    try {
      if (lanInfo?.mode === "electron") {
        const api = (window as any).electronAPI
        ok = api?.lanPush ? await api.lanPush(snapRef.current) : false
      } else if (lanInfo?.mode === "phone" || lanInfo?.mode === "cap") {
        ok = await lanPushSnapshot(snapRef.current)
      }
    } catch {
      ok = false
    }
    if (ok) {
      lastPushedRef.current = pushedVersions
      setLastSyncedAt(Date.now())
    }
    return ok
  }, [lanInfo?.mode])

  // Debounced push whenever local data changes (echo-safe).
  useEffect(() => {
    if (!lanActive) return
    if (applyingRemoteRef.current) {
      applyingRemoteRef.current = false
      for (const k of appliedKeysRef.current) lastPushedRef.current[k] = versionsRef.current[k]
      appliedKeysRef.current = new Set()
    }
    const pending = Object.keys(versionsRef.current).some(
      (k) => versionsRef.current[k] !== (lastPushedRef.current[k] ?? 0),
    )
    if (!pending) return
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current)
    pushTimerRef.current = setTimeout(() => doPushNow(), 700)
  }, [tasks, habits, goals, events, notes, notifications, userName, lanActive, doPushNow])

  // Phone: poll the laptop every few seconds.
  const phonePoll = useCallback(async () => {
    const { snap, authed, reachable } = await lanPull()
    setLanOnline(reachable)
    if (!authed) {
      setLanAuthed(false)
      prevReachableRef.current = false
      return
    }
    if (snap) {
      const applied = applyRemote(snap)
      if (applied) setLastSyncedAt(Date.now())
    }
    // Reconnected — upload any edits made while the laptop was offline.
    if (reachable && !prevReachableRef.current) {
      doPushNow()
    }
    prevReachableRef.current = reachable
  }, [applyRemote, doPushNow])

  // (Re)wire the transport when the active mode changes.
  useEffect(() => {
    if (lanInfo?.mode === "electron") {
      setLanOnline(true)
      if (lanInfo.enabled) {
        const unsub = (window as any).electronAPI?.onLanRemote?.(applyRemote)
        const t = setTimeout(() => doPushNow(), 600) // teach the server our full state
        return () => {
          unsub?.()
          clearTimeout(t)
        }
      }
      return
    }
    if (lanInfo?.mode === "phone" || lanInfo?.mode === "cap") {
      if (lanAuthed) {
        // The first poll already performs the catch-up push (prevReachableRef
        // starts false), so no extra timer is needed here.
        phonePoll()
        const interval = setInterval(phonePoll, 2500)
        return () => clearInterval(interval)
      }
      return
    }
  }, [lanInfo?.mode, lanInfo?.enabled, lanAuthed, applyRemote, doPushNow, phonePoll])

  // Detect the mode once on mount.
  useEffect(() => {
    let cancelled = false
    detectLan().then((info) => {
      if (cancelled || !info) return
      setLanInfo(info)
      if (info.mode === "electron") {
        if (getStoredEnabled() && !info.enabled) enableLan()
      } else if (info.mode === "phone" || (info.mode === "cap" && info.url)) {
        // Phone is always served by the laptop; the APK only connects once a
        // laptop URL is configured — so don't pop the passcode gate on a fresh
        // install before the user has linked a laptop.
        lanPull().then(({ authed }) => {
          if (cancelled) return
          setLanAuthed(authed)
          if (!authed) setLanGateOpen(true)
        })
      }
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // timer
  const [focusMinutes, setFocusMinutes] = useLocalStorage("focusMinutes", DEFAULT_FOCUS_MINUTES)
  const [breakMinutes, setBreakMinutes] = useLocalStorage("breakMinutes", DEFAULT_BREAK_MINUTES)
  const [mode, setMode] = useState<TimerMode>("focus")
  const [totalSeconds, setTotalSeconds] = useState(DEFAULT_FOCUS_MINUTES * 60)
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_FOCUS_MINUTES * 60)
  const [running, setRunning] = useState(false)
  const [pomodoro, setPomodoro] = useState(3)
  const totalPomodoros = 4
  const sessionLabel = "ProFlow Redesign"
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((s) => (s > 0 ? s - 1 : 0))
      }, 1000)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [running])

  const startTimer = useCallback(() => setRunning(true), [])
  const pauseTimer = useCallback(() => setRunning(false), [])
  const toggleTimer = useCallback(() => setRunning((r) => !r), [])

  const applyMode = useCallback((m: TimerMode) => {
    setMode(m)
    const total = (m === "focus" ? focusMinutes : breakMinutes) * 60
    setTotalSeconds(total)
    setSecondsLeft(total)
  }, [focusMinutes, breakMinutes])

  // Session end: chime / notify / auto-advance according to preferences.
  useEffect(() => {
    if (secondsLeft !== 0 || !running) return
    const prefOn = (id: string) => prefs.some((p) => p.id === id && p.on)
    if (prefOn("soundEnd")) playChime()
    if (prefOn("focusReminders")) {
      showNotification(
        mode === "focus" ? "Focus session complete" : "Break over",
        mode === "focus" ? "Great work — time for a break!" : "Ready for another deep-work session?",
      )
    }
    if (prefOn("autoBreaks")) {
      // Auto-advance to the next phase and keep running
      if (mode === "focus") setPomodoro((p) => (p >= totalPomodoros ? 1 : p + 1))
      applyMode(mode === "focus" ? "break" : "focus")
      setRunning(true)
    } else {
      setRunning(false)
    }
  }, [secondsLeft, running, mode, prefs, applyMode, totalPomodoros])

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
    setRunning(false)
    if (mode === "focus") {
      setPomodoro((p) => (p >= totalPomodoros ? 1 : p + 1))
      applyMode("break")
    } else {
      applyMode("focus")
    }
  }, [mode, applyMode])

  const stopTimer = useCallback(() => {
    setRunning(false)
    applyMode("focus")
    setPomodoro(1)
  }, [applyMode])

  const resetTimer = useCallback(() => {
    setRunning(false)
    setSecondsLeft(totalSeconds)
  }, [totalSeconds])

  // Wipe every piece of local data — Settings → "Clear all data".
  // The source ships empty, so any lingering demo/test data lives in
  // localStorage; this removes it all and resets state to fresh defaults.
  const resetAllData = useCallback(() => {
    // 1) Remove every persisted key (tasks, habits, notes, LAN code, etc.).
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
    setRawNotifications([])
    setRawUserName("You")
    setAvatarUrl("")
    setTheme("Purple")
    setPrefs(defaultPrefs)
    setShowTour(false)
    setSessionCount(0)
    setFocusMinutes(DEFAULT_FOCUS_MINUTES)
    setBreakMinutes(DEFAULT_BREAK_MINUTES)
    setTotalSeconds(DEFAULT_FOCUS_MINUTES * 60)
    setSecondsLeft(DEFAULT_FOCUS_MINUTES * 60)
    setMode("focus")
    setPomodoro(1)
    setRunning(false)
    // 3) Tear down LAN sync fully — server, passcode, authed state, stored laptop URL.
    disableLan()
    disconnectPhone()
    setLanGateOpen(false)
    setLastSyncedAt(null)
  }, [
    setRawTasks,
    setRawHabits,
    setRawGoals,
    setRawEvents,
    setRawNotes,
    setRawNotifications,
    setRawUserName,
    setAvatarUrl,
    setTheme,
    setPrefs,
    setShowTour,
    setSessionCount,
    setFocusMinutes,
    setBreakMinutes,
    setTotalSeconds,
    setSecondsLeft,
    setMode,
    setPomodoro,
    setRunning,
    disableLan,
    disconnectPhone,
    setLanGateOpen,
    setLastSyncedAt,
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

  const reorderTasks = useCallback((ids: string[]) => {
    setTasks((prev) => {
      const map = new Map(prev.map((t) => [t.id, t]))
      const reordered = ids.map((id) => map.get(id)).filter((t): t is Task => !!t)
      const remaining = prev.filter((t) => !ids.includes(t.id))
      return [...reordered, ...remaining]
    })
  }, [])

  const cycleTaskStatus = useCallback((id: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t
        const next: TaskStatus =
          t.status === "todo" ? "in-progress" : t.status === "in-progress" ? "done" : "todo"
        return { ...t, status: next, overdue: next === "done" ? false : t.overdue }
      }),
    )
  }, [])

  const setTaskStatus = useCallback((id: string, status: TaskStatus) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status, overdue: status === "done" ? false : t.overdue } : t)),
    )
  }, [])

  const toggleHabit = useCallback((id: string) => {
    setHabits((prev) =>
      prev.map((h) =>
        h.id === id
          ? { ...h, doneToday: !h.doneToday, streak: h.doneToday ? Math.max(0, h.streak - 1) : h.streak + 1 }
          : h,
      ),
    )
  }, [])

  const addHabit = useCallback<Store["addHabit"]>((name, week) => {
    setHabits((prev) => [
      { id: `h-${Date.now()}`, name, streak: 0, doneToday: false, week: week ?? [true, true, true, true, true, true, false] },
      ...prev,
    ])
  }, [])

  const deleteHabit = useCallback((id: string) => {
    setHabits((prev) => prev.filter((h) => h.id !== id))
  }, [])

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
    setNotes((prev) => [
      { id: `n-${Date.now()}`, updated: "just now", ...n },
      ...prev,
    ])
  }, [])

  const deleteNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id))
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

  const value = useMemo<Store>(
    () => ({
      view,
      setView,
      search,
      setSearch,
      tasks,
      projects: ["ProFlow Redesign", "Platform", "Personal"],
      addTask,
      deleteTask,
      reorderTasks,
      cycleTaskStatus,
      setTaskStatus,
      habits,
      addHabit,
      deleteHabit,
      toggleHabit,
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
      deleteNote,
      notifications,
      markRead,
      markAllRead,
      userName,
      setUserName,
      avatarUrl,
      setAvatarUrl,
      theme,
      setTheme,
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
      lanInfo,
      lanAuthed,
      lanOnline,
      lanBusy,
      lanError,
      lastSyncedAt,
      lanGateOpen,
      enableLan,
      disableLan,
      regenLanPasscode,
      submitLanPasscode,
      disconnectPhone,
      openLanGate,
      closeLanGate,
      connectToLaptop,
      secondsLeft,
      totalSeconds,
      running,
      mode,
      pomodoro,
      totalPomodoros,
      sessionLabel,
      focusMinutes,
      breakMinutes,
      setFocusMinutes,
      setBreakMinutes,
      startTimer,
      pauseTimer,
      toggleTimer,
      skipTimer,
      stopTimer,
      resetTimer,
    }),
    [
      view, search, tasks, addTask, deleteTask, reorderTasks, cycleTaskStatus, setTaskStatus, habits, addHabit,
      deleteHabit, toggleHabit, goals, addGoal, updateGoal, deleteGoal, events, addEvent, updateEvent, deleteEvent,
      notes, addNote, deleteNote, notifications, markRead, markAllRead,
      focusMode, toggleFocusMode, userName, setUserName, avatarUrl, setAvatarUrl,
      theme, setTheme, prefs, togglePref, showTour, dismissTour, startTour, sessionCount, resetAllData,
      lanInfo, lanAuthed, lanOnline, lanBusy, lanError, lastSyncedAt, lanGateOpen,
      enableLan, disableLan, regenLanPasscode, submitLanPasscode, disconnectPhone, openLanGate, closeLanGate,
      secondsLeft, totalSeconds, running, mode, pomodoro, sessionLabel,
      focusMinutes, breakMinutes, setFocusMinutes, setBreakMinutes,
      startTimer, pauseTimer, toggleTimer, skipTimer, stopTimer, resetTimer,
    ],
  )

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
