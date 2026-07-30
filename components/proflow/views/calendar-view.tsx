"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Modal } from "../modal"
import { useStore, type EventItem } from "../store"
import { Card, PageHeader } from "../ui"

// ── Constants ──────────────────────────────────────────────
const HOUR_HEIGHT = 60
const START_HOUR = 6
const END_HOUR = 23
const TOTAL_HOURS = END_HOUR - START_HOUR
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

const colorStyles: Record<string, string> = {
  primary: "border-l-primary bg-primary/15 text-primary hover:bg-primary/20",
  info: "border-l-info bg-info/15 text-info hover:bg-info/20",
  focus: "border-l-focus bg-focus/15 text-focus hover:bg-focus/20",
  success: "border-l-success bg-success/15 text-success hover:bg-success/20",
}

// ── Helpers ────────────────────────────────────────────────
function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function dayOfWeek(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00")
  return (d.getDay() + 6) % 7 // Monday=0 … Sunday=6
}

function parseDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function addDays(date: Date, n: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function getWeekDays(date: Date) {
  const monday = addDays(date, -((date.getDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

function getMonthGrid(date: Date) {
  const year = date.getFullYear()
  const month = date.getMonth()
  const first = new Date(year, month, 1)
  // shift so Monday is index 0
  const startPadding = ((first.getDay() + 6) % 7)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (Date | null)[] = []
  for (let i = 0; i < startPadding; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  // pad to complete the last row
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" })
}

function hourLabel(h: number) {
  if (h === 0) return "12 AM"
  if (h < 12) return `${h} AM`
  if (h === 12) return "12 PM"
  return `${h - 12} PM`
}

function formatTimeFromEvent(e: EventItem) {
  const start = `${e.startHour % 12 || 12}:${String(e.startMin).padStart(2, "0")} ${e.startHour < 12 ? "AM" : "PM"}`
  const end = `${e.endHour % 12 || 12}:${String(e.endMin).padStart(2, "0")} ${e.endHour < 12 ? "AM" : "PM"}`
  return `${start} – ${end}`
}

function eventTop(e: EventItem) {
  return (e.startHour - START_HOUR) * HOUR_HEIGHT + (e.startMin / 60) * HOUR_HEIGHT
}

function eventHeight(e: EventItem) {
  return (e.endHour - e.startHour) * HOUR_HEIGHT + ((e.endMin - e.startMin) / 60) * HOUR_HEIGHT
}

function isToday(dateStr: string) {
  return dateStr === todayStr()
}

// ── Component ──────────────────────────────────────────────
export function CalendarView() {
  const { events, addEvent, updateEvent, deleteEvent } = useStore()

  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  })
  const [viewMode, setViewMode] = useState<"month" | "week">("week")
  const [creating, setCreating] = useState<{
    day: number
    date: string
    hour: number
    min: number
  } | null>(null)
  const [editing, setEditing] = useState<string | null>(null)

  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate])
  const weekDateStrs = useMemo(() => weekDays.map(formatDate), [weekDays])

  const monthCells = useMemo(() => getMonthGrid(currentDate), [currentDate])

  // Week-based events: those whose date falls in the current week
  const weekEvents = useMemo(
    () => events.filter((e) => e.hasBlock && weekDateStrs.includes(e.date)),
    [events, weekDateStrs],
  )
  const listEvents = useMemo(
    () => events.filter((e) => !e.hasBlock && weekDateStrs.includes(e.date)),
    [events, weekDateStrs],
  )

  // ── Navigation ──────────────────────────────────────
  const goToday = useCallback(() => {
    const now = new Date()
    setCurrentDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()))
  }, [])

  const goPrev = useCallback(() => {
    setCurrentDate((d) => {
      const next = new Date(d)
      if (viewMode === "month") {
        next.setMonth(next.getMonth() - 1)
      } else {
        next.setDate(next.getDate() - 7)
      }
      return next
    })
  }, [viewMode])

  const goNext = useCallback(() => {
    setCurrentDate((d) => {
      const next = new Date(d)
      if (viewMode === "month") {
        next.setMonth(next.getMonth() + 1)
      } else {
        next.setDate(next.getDate() + 7)
      }
      return next
    })
  }, [viewMode])

  // ── Create event ────────────────────────────────────
  const createSubmit = useCallback(
    (title: string, color: string) => {
      if (!creating || !title.trim()) return
      const startHour = creating.hour
      const startMin = Math.floor(creating.min / 15) * 15
      let endHour = startHour + 1
      let endMin = startMin
      if (endHour >= 24) {
        endHour = 23
        endMin = 45
      }
      const timeStr = `${startHour % 12 || 12}:${String(startMin).padStart(2, "0")} ${startHour < 12 ? "AM" : "PM"}`
      const dayIdx = dayOfWeek(creating.date)
      addEvent({
        title: title.trim(),
        time: timeStr,
        day: dayIdx,
        date: creating.date,
        color,
        hasBlock: true,
        startHour,
        startMin,
        endHour,
        endMin,
      })
      setCreating(null)
    },
    [creating, addEvent],
  )

  const editSubmit = useCallback(
    (title: string, color: string) => {
      if (!editing || !title.trim()) return
      updateEvent(editing, { title: title.trim(), color })
      setEditing(null)
    },
    [editing, updateEvent],
  )

  // ── Mouse create from week grid ─────────────────────
  const handleSlotClick = useCallback(
    (dayIdx: number, hour: number) => {
      if (editing) return
      const dateStr = weekDateStrs[dayIdx]
      setCreating({ day: dayIdx, date: dateStr, hour, min: 0 })
    },
    [editing, weekDateStrs],
  )

  // ── Month cell click ────────────────────────────────
  const handleMonthDayClick = useCallback(
    (date: Date) => {
      setCurrentDate(date)
      setViewMode("week")
    },
    [],
  )

  // ── All-day events for a specific day ───────────────
  const eventsForDate = useCallback(
    (dateStr: string) =>
      events.filter((e) => e.date === dateStr),
    [events],
  )

  // ── Render ──────────────────────────────────────────
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6">
      {/* Header */}
      <PageHeader
        title={viewMode === "week" ? "Weekly Calendar" : "Monthly Calendar"}
        subtitle={`${viewMode === "week" ? weekEvents.length + listEvents.length : events.length} event${viewMode === "week" && weekEvents.length + listEvents.length !== 1 ? "s" : ""} this ${viewMode}`}
      >
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="mr-4 flex overflow-hidden rounded-lg border border-border">
            <button
              type="button"
              onClick={() => setViewMode("week")}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors",
                viewMode === "week"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => setViewMode("month")}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors",
                viewMode === "month"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              Month
            </button>
          </div>

          {/* Navigation */}
          <button
            type="button"
            onClick={goPrev}
            className="flex size-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
          >
            Today
          </button>
          <button
            type="button"
            onClick={goNext}
            className="flex size-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronRight className="size-4" />
          </button>

          <span className="ml-2 text-sm font-semibold">
            {viewMode === "week"
              ? `${weekDays[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${weekDays[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
              : monthLabel(currentDate)}
          </span>
        </div>
      </PageHeader>

      {/* ═══ Month View ═══ */}
      {viewMode === "month" && (
        <Card className="overflow-hidden p-0">
          {/* Day-of-week header */}
          <div className="grid grid-cols-7 border-b border-border">
            {DAY_LABELS.map((l) => (
              <div
                key={l}
                className="border-r border-border py-2 text-center text-xs font-semibold text-muted-foreground last:border-r-0"
              >
                {l}
              </div>
            ))}
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-7">
            {monthCells.map((cellDate, i) => {
              if (!cellDate) {
                return <div key={`empty-${i}`} className="min-h-[100px] border-b border-r border-border/30 bg-muted/10" />
              }
              const ds = formatDate(cellDate)
              const dayEvents = eventsForDate(ds)
              const isToday_ = isToday(ds)
              const isCurrentMonth =
                cellDate.getMonth() === currentDate.getMonth()

              return (
                <div
                  key={ds}
                  onClick={() => handleMonthDayClick(cellDate)}
                  className={cn(
                    "min-h-[100px] cursor-pointer border-b border-r border-border/30 p-1.5 transition-colors hover:bg-accent/30",
                    !isCurrentMonth && "opacity-40",
                    isToday_ && "bg-primary/[0.04]",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-7 items-center justify-center rounded-full text-sm",
                      isToday_
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "text-foreground",
                    )}
                  >
                    {cellDate.getDate()}
                  </span>
                  <div className="mt-1 flex flex-col gap-0.5">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <div
                        key={ev.id}
                        className={cn(
                          "truncate rounded px-1 py-0.5 text-[10px] leading-tight",
                          colorStyles[ev.color] ?? colorStyles.primary,
                        )}
                      >
                        {ev.hasBlock && (
                          <span className="mr-1 font-medium">
                            {ev.startHour % 12 || 12}
                            {ev.startHour < 12 ? "a" : "p"}
                          </span>
                        )}
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="px-1 text-[10px] text-muted-foreground">
                        +{dayEvents.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* ═══ Week View ═══ */}
      {viewMode === "week" && (
        <>
          {/* Time-grid week view */}
          <div id="calendar-grid">
          <Card className="overflow-hidden p-0">
            {/* Day headers */}
            <div className="sticky top-0 z-10 grid grid-cols-[60px_repeat(7,1fr)] divide-x divide-border bg-card">
              <div className="flex items-center justify-center border-b border-border py-3" />
              {weekDays.map((d, i) => {
                const ds = weekDateStrs[i]
                const isToday_ = isToday(ds)
                return (
                  <div
                    key={ds}
                    className={cn(
                      "flex flex-col items-center gap-0.5 border-b border-border py-3",
                      isToday_ && "bg-primary/5",
                    )}
                  >
                    <span className="text-xs text-muted-foreground">
                      {DAY_LABELS[i]}
                    </span>
                    <span
                      className={cn(
                        "flex size-8 items-center justify-center rounded-full text-sm font-semibold",
                        isToday_
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground",
                      )}
                    >
                      {d.getDate()}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Scrollable time grid */}
            <div
              className="overflow-y-auto"
              style={{ maxHeight: "calc(100vh - 320px)" }}
            >
              <div
                className="grid"
                style={{
                  gridTemplateColumns: "60px repeat(7, 1fr)",
                  height: TOTAL_HOURS * HOUR_HEIGHT,
                }}
              >
                {/* Hour labels */}
                <div className="relative border-r border-border">
                  {Array.from({ length: TOTAL_HOURS }).map((_, i) => {
                    const h = START_HOUR + i
                    return (
                      <div
                        key={h}
                        className="absolute left-0 right-0 flex items-start justify-end pr-2"
                        style={{ top: i * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                      >
                        <span className="-mt-2 text-[10px] text-muted-foreground">
                          {hourLabel(h)}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Day columns */}
                {weekDays.map((_, dayIdx) => {
                  const ds = weekDateStrs[dayIdx]
                  const isToday_ = isToday(ds)
                  return (
                    <div key={ds} className="relative border-r border-border">
                      {/* Hour slot backgrounds & click targets */}
                      {Array.from({ length: TOTAL_HOURS }).map((_, i) => {
                        const h = START_HOUR + i
                        return (
                          <div
                            key={`${ds}-${h}`}
                            className={cn(
                              "absolute left-0 right-0 cursor-pointer border-b border-border/40 transition-colors hover:bg-accent/30",
                              isToday_ && "bg-primary/[0.02]",
                            )}
                            style={{
                              top: i * HOUR_HEIGHT,
                              height: HOUR_HEIGHT,
                            }}
                            onClick={() => handleSlotClick(dayIdx, h)}
                          />
                        )
                      })}

                      {/* Half-hour dashed lines */}
                      {Array.from({ length: TOTAL_HOURS }).map((_, i) => (
                        <div
                          key={`line-${ds}-${i}`}
                          className="absolute left-1 right-1 border-t border-dashed border-border/20"
                          style={{
                            top: i * HOUR_HEIGHT + HOUR_HEIGHT / 2,
                          }}
                        />
                      ))}

                      {/* Time-block events */}
                      {weekEvents
                        .filter((e) => e.date === ds)
                        .map((e) => (
                          <EventBlock
                            key={e.id}
                            event={e}
                            weekDateStrs={weekDateStrs}
                            onResize={(newEndHour, newEndMin) =>
                              updateEvent(e.id, {
                                endHour: newEndHour,
                                endMin: newEndMin,
                              })
                            }
                            onMove={(newDate, newStartHour, newStartMin) => {
                              const duration = e.endHour * 60 + e.endMin - (e.startHour * 60 + e.startMin)
                              let newEndMin2 = newStartMin + duration
                              let newEndHour2 = newStartHour + Math.floor(newEndMin2 / 60)
                              newEndMin2 = newEndMin2 % 60
                              if (newEndHour2 >= 24) { newEndHour2 = 23; newEndMin2 = 45 }
                              const newDayIdx = dayOfWeek(newDate)
                              const newTimeStr = `${newStartHour % 12 || 12}:${String(newStartMin).padStart(2, "0")} ${newStartHour < 12 ? "AM" : "PM"}`
                              updateEvent(e.id, {
                                date: newDate,
                                day: newDayIdx,
                                startHour: newStartHour,
                                startMin: newStartMin,
                                endHour: newEndHour2,
                                endMin: newEndMin2,
                                time: newTimeStr,
                              })
                            }}
                            onDelete={() => deleteEvent(e.id)}
                            onEdit={() => setEditing(e.id)}
                          />
                        ))}
                    </div>
                  )
                })}
              </div>
            </div>
          </Card>
          </div>

          {/* Non-block events */}
          {listEvents.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold">Other events</h2>
              <div className="flex flex-col gap-2">
                {listEvents.map((e) => {
                  const d = parseDate(e.date)
                  const dayLabel = DAY_LABELS[(d.getDay() + 6) % 7]
                  return (
                    <div
                      key={e.id}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
                    >
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: `var(--${e.color})` }}
                      />
                      <span className="text-sm font-medium">{e.title}</span>
                      <span className="ml-auto text-sm text-muted-foreground">
                        {dayLabel} {d.getDate()} · {e.time}
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteEvent(e.id)}
                        className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-danger/15 hover:text-danger"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Create event modal */}
          <Modal
            open={!!creating}
            onClose={() => setCreating(null)}
            title="New time block"
            description={
              creating
                ? (() => {
                    const d = parseDate(creating.date)
                    return `${DAY_LABELS[(d.getDay() + 6) % 7]} ${d.getDate()} at ${hourLabel(creating.hour)}`
                  })()
                : ""
            }
          >
            <QuickEventForm
              onSubmit={createSubmit}
              onCancel={() => setCreating(null)}
              placeholder="e.g. Deep work session"
            />
          </Modal>
        </>
      )}

      {/* Edit event modal (shared) */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Edit event"
        description="Update the event title"
      >
        <QuickEventForm
          onSubmit={editSubmit}
          onCancel={() => setEditing(null)}
          placeholder={
            editing
              ? events.find((e) => e.id === editing)?.title ?? "Event title"
              : "Event title"
          }
          initialValue={
            editing ? events.find((e) => e.id === editing)?.title ?? "" : ""
          }
          initialColor={
            editing ? events.find((e) => e.id === editing)?.color ?? "primary" : undefined
          }
        />
      </Modal>
    </div>
  )
}

// ── EventBlock ──────────────────────────────────────────────
function EventBlock({
  event,
  weekDateStrs,
  onResize,
  onMove,
  onDelete,
  onEdit,
}: {
  event: EventItem
  weekDateStrs: string[]
  onResize: (endHour: number, endMin: number) => void
  onMove: (date: string, startHour: number, startMin: number) => void
  onDelete: () => void
  onEdit: () => void
}) {
  const [resizing, setResizing] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const resizeRef = useRef({
    active: false,
    startY: 0,
    startHour: 0,
    startMin: 0,
    eventStartMin: 0,
  })
  const dragRef = useRef({
    active: false,
    startMouseY: 0,
    startMouseX: 0,
    startHour: 0,
    startMin: 0,
    startDate: "",
  })

  const handleResizeMove = useCallback(
    (ev: MouseEvent) => {
      const r = resizeRef.current
      if (!r.active) return
      const dy = ev.clientY - r.startY
      const deltaSlots = Math.round(dy / (HOUR_HEIGHT / 4))
      const absoluteStartMin = r.eventStartMin
      const minEnd = absoluteStartMin + 30
      let newEndMin = r.startHour * 60 + r.startMin + deltaSlots * 15
      newEndMin = Math.max(minEnd, Math.min(23 * 60 + 45, newEndMin))
      onResize(Math.floor(newEndMin / 60), newEndMin % 60)
    },
    [onResize],
  )

  const handleResizeUp = useCallback(() => {
    resizeRef.current.active = false
    setResizing(false)
  }, [])

  const handleDragMove = useCallback(
    (ev: MouseEvent) => {
      const d = dragRef.current
      if (!d.active) return
      const dy = ev.clientY - d.startMouseY
      const dx = ev.clientX - d.startMouseX
      setDragOffset({ x: dx, y: dy })
    },
    [],
  )

  const handleDragUp = useCallback(
    (ev: MouseEvent) => {
      const d = dragRef.current
      if (!d.active) return
      d.active = false
      setDragging(false)
      setDragOffset({ x: 0, y: 0 })

      // Compute new time slot from mouse position
      const dy = ev.clientY - d.startMouseY
      const deltaSlots = Math.round(dy / (HOUR_HEIGHT / 4)) // 15-min slots
      const baseMin = d.startHour * 60 + d.startMin
      let newMin = Math.max(START_HOUR * 60, Math.min(23 * 60 + 45, baseMin + deltaSlots * 15))
      const newHour = Math.floor(newMin / 60)
      const newMin2 = newMin % 60

      // Compute which day column the mouse is over
      const grid = document.getElementById("calendar-grid")
      if (!grid) return
      const rect = grid.getBoundingClientRect()
      const colWidth = (rect.width - 60) / 7
      const relX = ev.clientX - rect.left - 60
      let colIdx = Math.floor(relX / colWidth)
      colIdx = Math.max(0, Math.min(6, colIdx))
      const newDate = weekDateStrs[colIdx]

      onMove(newDate, newHour, newMin2)
    },
    [onMove, weekDateStrs],
  )

  // ── Listeners ────────────────────────────────────────
  useEffect(() => {
    if (resizing) {
      window.addEventListener("mousemove", handleResizeMove)
      window.addEventListener("mouseup", handleResizeUp)
      return () => {
        window.removeEventListener("mousemove", handleResizeMove)
        window.removeEventListener("mouseup", handleResizeUp)
      }
    }
  }, [resizing, handleResizeMove, handleResizeUp])

  useEffect(() => {
    if (dragging) {
      window.addEventListener("mousemove", handleDragMove)
      window.addEventListener("mouseup", handleDragUp)
      return () => {
        window.removeEventListener("mousemove", handleDragMove)
        window.removeEventListener("mouseup", handleDragUp)
      }
    }
  }, [dragging, handleDragMove, handleDragUp])

  const onBodyMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Ignore resize handle clicks
      if ((e.target as HTMLElement).closest(".resize-handle")) return
      e.preventDefault()
      dragRef.current = {
        active: true,
        startMouseY: e.clientY,
        startMouseX: e.clientX,
        startHour: event.startHour,
        startMin: event.startMin,
        startDate: event.date,
      }
      setDragging(true)
    },
    [event],
  )

  const onResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      resizeRef.current = {
        active: true,
        startY: e.clientY,
        startHour: event.endHour,
        startMin: event.endMin,
        eventStartMin: event.startHour * 60 + event.startMin,
      }
      setResizing(true)
    },
    [event],
  )

  const top = eventTop(event)
  const height = Math.max(eventHeight(event), 20)
  const style = colorStyles[event.color] ?? colorStyles.primary

  return (
    <div
      className={cn(
        "absolute left-1 right-1 z-10 overflow-hidden rounded-md border-l-[3px] px-2 py-1 text-left text-xs shadow-sm transition-shadow hover:shadow-md",
        style,
        resizing && "shadow-lg ring-2 ring-primary/40",
        dragging && "z-50 ring-2 ring-primary/50 shadow-xl opacity-90",
      )}
      style={{
        top: dragging ? top + dragOffset.y : top,
        height,
        minHeight: 24,
        cursor: dragging ? "grabbing" : "grab",
        transition: dragging ? "none" : undefined,
      }}
      onMouseDown={onBodyMouseDown}
      onDoubleClick={onEdit}
    >
      <p className="truncate text-[11px] font-semibold leading-tight">
        {event.title}
      </p>
      <p className="flex items-center gap-1 truncate text-[10px] opacity-80">
        <Clock className="size-2.5 shrink-0" />
        {formatTimeFromEvent(event)}
      </p>

      {/* Delete button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        className="absolute right-1 top-1 flex size-4 items-center justify-center rounded text-current opacity-0 transition-opacity hover:opacity-100"
      >
        <Trash2 className="size-3" />
      </button>

      {/* Resize handle */}
      <div
        className="resize-handle absolute bottom-0 left-0 right-0 z-20 flex cursor-s-resize items-center justify-center py-0.5 opacity-0 transition-opacity hover:opacity-100"
        onMouseDown={onResizeMouseDown}
      >
        <div className="h-0.5 w-6 rounded-full bg-current" />
      </div>
    </div>
  )
}

// ── QuickEventForm ──────────────────────────────────────────
const colorSwatches = [
  { id: "primary", label: "Purple", ring: "ring-primary", bg: "bg-primary" },
  { id: "info", label: "Blue", ring: "ring-info", bg: "bg-info" },
  { id: "focus", label: "Green", ring: "ring-focus", bg: "bg-focus" },
  { id: "success", label: "Teal", ring: "ring-success", bg: "bg-success" },
]

function QuickEventForm({
  onSubmit,
  onCancel,
  placeholder,
  initialValue,
  initialColor,
}: {
  onSubmit: (title: string, color: string) => void
  onCancel: () => void
  placeholder: string
  initialValue?: string
  initialColor?: string
}) {
  const [title, setTitle] = useState(initialValue ?? "")
  const [selectedColor, setSelectedColor] = useState(initialColor ?? "primary")
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(title, selectedColor)
      }}
      className="flex flex-col gap-4"
    >
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={placeholder}
        className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
      />

      {/* Color picker */}
      <div>
        <p className="mb-2 text-xs font-semibold text-muted-foreground">
          Color
        </p>
        <div className="flex gap-2">
          {colorSwatches.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedColor(c.id)}
              title={c.label}
              className={cn(
                "size-7 rounded-full transition-all",
                c.bg,
                selectedColor === c.id
                  ? "ring-2 ring-offset-2 ring-offset-background scale-110"
                  : "opacity-60 hover:opacity-100",
              )}
            />
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="lg" disabled={!title.trim()}>
          Save
        </Button>
      </div>
    </form>
  )
}
