"use client"

import { useMemo, useState } from "react"
import { Check, FolderPlus, Plus, Search, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { DragSortContainer, DragSortItem } from "../drag-sort"
import { TaskRow } from "../task-row"
import { CaptureDialog } from "../capture-dialog"
import { useStore, type Task, type TaskStatus } from "../store"
import { PageHeader } from "../ui"

const statusFilters: { id: TaskStatus | "all" | "recently-completed"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "todo", label: "To Do" },
  { id: "in-progress", label: "In Progress" },
  { id: "recently-completed", label: "Recently done" },
]

// Accent tokens (globals.css) — the same family the calendar uses for events.
const PROJECT_DOT_COLORS = ["primary", "info", "focus", "success", "danger"]

/** Deterministic accent color for a project name — stable across renders/devices. */
function projectColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return PROJECT_DOT_COLORS[Math.abs(h) % PROJECT_DOT_COLORS.length]
}

export function TasksView({
  onCapture,
  onNewProject,
}: {
  onCapture: () => void
  onNewProject: (name: string) => void
}) {
  const { tasks, completedTasks, projects, search, setSearch, cycleTaskStatus, deleteTask, reorderTasks, restoreTask } = useStore()
  const [status, setStatus] = useState<TaskStatus | "all" | "recently-completed">("all")
  // The task currently being edited — opens the capture dialog in edit mode.
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  // "all" shows every task; "" is the Inbox (tasks without a project); any other
  // value is a specific project tab. Tasks are never mixed across tabs.
  const [projectTab, setProjectTab] = useState<string>("all")

  const counts = {
    all: tasks.length,
    todo: tasks.filter((t) => t.status === "todo").length,
    "in-progress": tasks.filter((t) => t.status === "in-progress").length,
    "recently-completed": completedTasks.length,
  } as Record<string, number>

  const tabs = useMemo(() => {
    // "No project" is the home for standalone tasks (project === ""). It's
    // labeled this way rather than "Inbox" so it can never collide with a
    // project the user literally names "Inbox".
    const list: { id: string; label: string; count: number; color?: string }[] = [
      { id: "all", label: "All", count: tasks.length },
      {
        id: "",
        label: "No project",
        count: tasks.filter((t) => !t.project).length,
        color: "muted-foreground",
      },
      ...projects.map((p) => ({
        id: p,
        label: p,
        count: tasks.filter((t) => t.project === p).length,
        color: projectColor(p),
      })),
    ]
    // Keep the bar tidy: hide empty tabs (All always stays).
    return list.filter((t) => t.id === "all" || t.count > 0)
  }, [tasks, projects])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    // "recently-completed" shows completed tasks from the restore pool
    if (status === "recently-completed") {
      return completedTasks.filter((t) => {
        if (projectTab !== "all") {
          if (projectTab === "" && t.project) return false
          if (projectTab !== "" && t.project !== projectTab) return false
        }
        if (q && !`${t.title} ${t.project}`.toLowerCase().includes(q)) return false
        return true
      })
    }
    return tasks.filter((t) => {
      if (status !== "all" && t.status !== status) return false
      if (projectTab === "all") {
        // no project filter — everything
      } else if (projectTab === "") {
        if (t.project) return false // Inbox: only tasks without a project
      } else if (t.project !== projectTab) {
        return false // specific project tab
      }
      if (q && !`${t.title} ${t.project}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [tasks, completedTasks, status, projectTab, search])

  // On a single tab (Inbox or one project) show a flat list; on "All" group by
  // project so each project is still its own section.
  const single = projectTab !== "all"

  const grouped = useMemo(() => {
    if (single) return null
    const map = new Map<string, Task[]>()
    for (const p of projects) map.set(p, [])
    map.set("", []) // Inbox group for tasks without a project
    for (const t of filtered) {
      if (!map.has(t.project)) map.set(t.project, [])
      map.get(t.project)!.push(t)
    }
    return Array.from(map.entries())
      .filter(([, list]) => list.length > 0)
      .map(([proj, list]) => ({
        project: proj === "" ? "No project" : proj,
        color: proj === "" ? "muted-foreground" : projectColor(proj),
        tasks: list,
      }))
  }, [filtered, projects, single])

  const emptyState = (
    <div className="rounded-2xl border border-dashed border-border p-12 text-center">
      <p className="text-sm text-muted-foreground">No tasks match your filters.</p>
    </div>
  )

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <PageHeader
        title="Tasks & Projects"
        subtitle={`${counts.todo + counts["in-progress"]} active · ${counts["recently-completed"]} recently done · ${tasks.filter((t) => t.overdue).length} overdue`}
      >
        <div className="flex items-center gap-2">
          <Button
            size="lg"
            variant="outline"
            onClick={() => onNewProject(search.trim())}
            className="gap-1.5"
          >
            <FolderPlus className="size-4" /> New project
          </Button>
          <Button size="lg" onClick={onCapture} className="gap-1.5">
            <Plus className="size-4" /> Add task
          </Button>
        </div>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter tasks..."
            className="h-10 w-full rounded-xl border border-input bg-secondary/50 pr-3 pl-9 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>
        <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
          {statusFilters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatus(f.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                status === f.id ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
              <span className="text-xs text-muted-foreground">{counts[f.id]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Project tabs — one tab per project so tasks never mix */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setProjectTab(t.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              projectTab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.color && (
              // The ring keeps a primary-colored dot visible when its tab is
              // active (the active tab background is also bg-primary).
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full ring-1 ring-background/70"
                style={{ backgroundColor: `var(--${t.color})` }}
              />
            )}
            {t.label}
            <span
              className={cn(
                "text-xs",
                projectTab === t.id ? "text-primary-foreground/70" : "text-muted-foreground",
              )}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Recently completed view — restore button instead of toggle/delete */}
      {status === "recently-completed" ? (
        filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <p className="text-sm text-muted-foreground">No recently completed tasks.</p>
            <p className="mt-1 text-xs text-muted-foreground/60">Completed tasks auto-delete after 24 hours.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((t) => {
              const ct = t as import("../store").CompletedTask
              const hoursAgo = Math.round((Date.now() - ct.completedAtMs) / (1000 * 60 * 60))
              const remaining = Math.max(0, 24 - hoursAgo)
              return (
                <div
                  key={t.id}
                  className="group flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 opacity-70 transition-colors hover:opacity-100"
                >
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-md border border-success bg-success text-success-foreground">
                    <Check className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium line-through text-muted-foreground">{t.title}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground/60">
                      {t.project && `${t.project} · `}{remaining}h until auto-delete
                    </span>
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => restoreTask(t.id)}
                    className="gap-1.5 text-xs"
                  >
                    <Undo2 className="size-3.5" /> Restore
                  </Button>
                </div>
              )
            })}
          </div>
        )
      ) : single ? (
        filtered.length === 0 ? (
          emptyState
        ) : (
          <TaskGroup
            project={projectTab === "" ? "No project" : projectTab}
            color={projectTab === "" ? "muted-foreground" : projectColor(projectTab)}
            tasks={filtered}
            onToggle={(id) => cycleTaskStatus(id)}
            onDelete={(id) => deleteTask(id)}
            onEdit={(t) => setEditingTask(t)}
            onReorder={(ids) => reorderTasks(ids)}
          />
        )
      ) : !grouped || grouped.length === 0 ? (
        emptyState
      ) : (
        <div className="flex flex-col gap-6">
          {grouped.map((g) => (
            <TaskGroup
              key={g.project}
              project={g.project}
              color={g.color}
              tasks={g.tasks}
              onToggle={(id) => cycleTaskStatus(id)}
              onDelete={(id) => deleteTask(id)}
              onEdit={(t) => setEditingTask(t)}
              onReorder={(ids) => reorderTasks(ids)}
            />
          ))}
        </div>
      )}

      <CaptureDialog
        open={!!editingTask}
        editing={editingTask}
        onClose={() => setEditingTask(null)}
      />
    </div>
  )
}

function TaskGroup({
  project,
  color,
  tasks,
  onToggle,
  onDelete,
  onEdit,
  onReorder,
}: {
  project: string
  color?: string
  tasks: Task[]
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onEdit: (t: Task) => void
  onReorder: (ids: string[]) => void
}) {
  const taskIds = tasks.map((t) => t.id)
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        {color && (
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full ring-1 ring-background/70"
            style={{ backgroundColor: `var(--${color})` }}
          />
        )}
        <h2 className="text-sm font-semibold text-foreground">{project}</h2>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
          {tasks.length}
        </span>
      </div>
      <DragSortContainer ids={taskIds} onReorder={onReorder} className="flex flex-col gap-2">
        {tasks.map((t) => (
          <DragSortItem key={t.id} id={t.id}>
            <TaskRow
              task={t}
              dragHandle
              onToggle={() => onToggle(t.id)}
              onDelete={() => onDelete(t.id)}
              onEdit={() => onEdit(t)}
            />
          </DragSortItem>
        ))}
      </DragSortContainer>
    </section>
  )
}
