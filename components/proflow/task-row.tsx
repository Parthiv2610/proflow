"use client"

import { Check, Circle, Clock, Pencil, Repeat, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Task } from "./store"
import { PriorityBadge } from "./ui"
import { DragHandle } from "./drag-sort"

export function TaskRow({
  task,
  onToggle,
  onDelete,
  dragHandle,
  onEdit,
}: {
  task: Task
  onToggle: () => void
  onDelete: () => void
  dragHandle?: boolean
  /** When provided, tapping the row body opens the task editor. */
  onEdit?: () => void
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-3 transition-colors hover:border-primary/40",
        task.status === "done" && "opacity-60",
      )}
    >
      {dragHandle && <DragHandle />}
      <button
        type="button"
        onClick={onToggle}
        aria-label={`Set status for ${task.title}, currently ${task.status}`}
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
          task.status === "done"
            ? "border-success bg-success text-success-foreground"
            : task.status === "in-progress"
              ? "border-focus text-focus"
              : "border-muted-foreground/50 text-transparent hover:border-primary",
        )}
      >
        {task.status === "done" ? (
          <Check className="size-3.5" />
        ) : task.status === "in-progress" ? (
          <Clock className="size-3" />
        ) : (
          <Circle className="size-2" />
        )}
      </button>

      <button
        type="button"
        onClick={onEdit}
        disabled={!onEdit}
        aria-label={`Edit ${task.title}`}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg text-left disabled:cursor-default"
      >
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate text-sm font-medium", task.status === "done" && "line-through")}>
            {task.title}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className={cn(task.due ? "" : "italic opacity-70", task.overdue && task.status !== "done" && "font-medium text-danger")}>
              {task.due || "No due date"}
            </span>
            {task.recurring && (
              <span className="inline-flex items-center gap-1 rounded-md bg-info/15 px-2 py-0.5 text-[11px] font-medium text-info capitalize">
                <Repeat className="size-3" />
                {task.recurring}
              </span>
            )}
          </span>
        </span>
        {onEdit && (
          <span className="shrink-0 rounded-lg p-1 text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 hover:text-primary">
            <Pencil className="size-3.5" />
          </span>
        )}
      </button>

      <PriorityBadge priority={task.priority} />

      <span
        className={cn(
          "hidden rounded-md px-2 py-0.5 text-[11px] font-medium capitalize sm:inline-block",
          task.status === "done"
            ? "bg-success/15 text-success"
            : task.status === "in-progress"
              ? "bg-focus/15 text-focus"
              : "bg-secondary text-muted-foreground",
        )}
      >
        {task.status === "in-progress" ? "In progress" : task.status}
      </span>

      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${task.title}`}
        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-danger/15 hover:text-danger"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  )
}
