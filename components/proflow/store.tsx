"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useLocalStorage } from "@/lib/use-local-storage"

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

  showTour: boolean
  dismissTour: () => void
  sessionCount: number

  // focus mode
  focusMode: boolean
  toggleFocusMode: () => void

  // timer
  secondsLeft: number
  totalSeconds: number
  running: boolean
  mode: TimerMode
  pomodoro: number
  totalPomodoros: number
  sessionLabel: string
  startTimer: () => void
  pauseTimer: () => void
  toggleTimer: () => void
  skipTimer: () => void
  stopTimer: () => void
  resetTimer: () => void
}

const StoreContext = createContext<Store | null>(null)

const FOCUS_SECONDS = 25 * 60
const BREAK_SECONDS = 5 * 60

const initialTasks: Task[] = []

const initialHabits: Habit[] = []

const initialGoals: Goal[] = []

const initialEvents: EventItem[] = []

const initialNotes: Note[] = []

const initialNotifications: AppNotification[] = []

export function ProFlowProvider({ children }: { children: React.ReactNode }) {
  const [view, setView] = useState<View>("dashboard")
  const [search, setSearch] = useState("")
  const [tasks, setTasks] = useLocalStorage<Task[]>("tasks", initialTasks)
  const [habits, setHabits] = useLocalStorage<Habit[]>("habits", initialHabits)
  const [goals, setGoals] = useLocalStorage<Goal[]>("goals", initialGoals)
  const [events, setEvents] = useLocalStorage<EventItem[]>("events", initialEvents)
  const [notes, setNotes] = useLocalStorage<Note[]>("notes", initialNotes)
  const [notifications, setNotifications] = useLocalStorage<AppNotification[]>("notifications", initialNotifications)

  // user name
  const [userName, setUserName] = useLocalStorage("userName", "You")
  const [avatarUrl, setAvatarUrl] = useLocalStorage("avatarUrl", "")

  // welcome tour
  const [showTour, setShowTour] = useLocalStorage("showTour", true)
  const dismissTour = useCallback(() => setShowTour(false), [])

  // onboarding tooltips — session counter (increments on mount, caps at 5)
  const [sessionCount, setSessionCount] = useLocalStorage("sessionCount", 0)
  useEffect(() => {
    setSessionCount((prev) => Math.min(prev + 1, 5))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // focus mode
  const [focusMode, setFocusMode] = useState(false)
  const toggleFocusMode = useCallback(() => setFocusMode((prev) => !prev), [])

  // timer
  const [mode, setMode] = useState<TimerMode>("focus")
  const [totalSeconds, setTotalSeconds] = useState(FOCUS_SECONDS)
  const [secondsLeft, setSecondsLeft] = useState(14 * 60 + 4)
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

  useEffect(() => {
    if (secondsLeft === 0 && running) {
      setRunning(false)
    }
  }, [secondsLeft, running])

  const startTimer = useCallback(() => setRunning(true), [])
  const pauseTimer = useCallback(() => setRunning(false), [])
  const toggleTimer = useCallback(() => setRunning((r) => !r), [])

  const applyMode = useCallback((m: TimerMode) => {
    setMode(m)
    const total = m === "focus" ? FOCUS_SECONDS : BREAK_SECONDS
    setTotalSeconds(total)
    setSecondsLeft(total)
  }, [])

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
      showTour,
      dismissTour,
      sessionCount,
      focusMode,
      toggleFocusMode,
      secondsLeft,
      totalSeconds,
      running,
      mode,
      pomodoro,
      totalPomodoros,
      sessionLabel,
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
      focusMode, toggleFocusMode, userName, setUserName, avatarUrl, setAvatarUrl, showTour, dismissTour, sessionCount,
      secondsLeft, totalSeconds, running, mode, pomodoro, sessionLabel,
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
