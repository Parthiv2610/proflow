"use client"

import { useCallback, useMemo, useState } from "react"
import { Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { DragSortContainer, DragSortItem } from "../drag-sort"
import { TaskRow } from "../task-row"
import { useStore, type Task, type TaskStatus } from "../store"
import { PageHeader } from "../ui"

const statusFilters: { id: TaskStatus | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "todo", label: "To Do" },
  { id: "in-progress", label: "In Progress" },
  { id: "done", label: "Done" },
]

export function TasksView({ onCapture }: { onCapture: () => void }) {
  const { tasks, projects, search, setSearch, cycleTaskStatus, deleteTask, reorderTasks } = useStore()
  const [status, setStatus] = useState<TaskStatus | "all">("all")
  const [project, setProject] = useState<string | "all">("all")

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tasks.filter((t) => {
      if (status !== "all" && t.status !== status) return false
      if (project !== "all" && t.project !== project) return false
      if (q && !`${t.title} ${t.project} ${t.category}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [tasks, status, project, search])

  const grouped = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const p of projects) map.set(p, [])
    for (const t of filtered) {
      if (!map.has(t.project)) map.set(t.project, [])
      map.get(t.project)!.push(t)
    }
    return Array.from(map.entries()).filter(([, list]) => list.length > 0)
  }, [filtered, projects])

  const counts = {
    all: tasks.length,
    todo: tasks.filter((t) => t.status === "todo").length,
    "in-progress": tasks.filter((t) => t.status === "in-progress").length,
    done: tasks.filter((t) => t.status === "done").length,
  } as Record<string, number>

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <PageHeader
        title="Tasks & Projects"
        subtitle={`${counts.todo + counts["in-progress"]} active · ${counts.done} completed · ${tasks.filter((t) => t.overdue && t.status !== "done").length} overdue`}
      >
        <Button size="lg" onClick={onCapture} className="gap-1.5">
          <Plus className="size-4" /> Add task
        </Button>
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

      <div className="flex flex-wrap gap-2">
        <ProjectChip active={project === "all"} onClick={() => setProject("all")}>
          All projects
        </ProjectChip>
        {projects.map((p) => (
          <ProjectChip key={p} active={project === p} onClick={() => setProject(p)}>
            {p}
          </ProjectChip>
        ))}
      </div>

      {grouped.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <p className="text-sm text-muted-foreground">No tasks match your filters.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {grouped.map(([proj, list]) => (
            <TaskGroup
              key={proj}
              project={proj}
              tasks={list}
              onToggle={(id) => cycleTaskStatus(id)}
              onDelete={(id) => deleteTask(id)}
              onReorder={(ids) => reorderTasks(ids)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TaskGroup({
  project,
  tasks,
  onToggle,
  onDelete,
  onReorder,
}: {
  project: string
  tasks: Task[]
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onReorder: (ids: string[]) => void
}) {
  const taskIds = tasks.map((t) => t.id)
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
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
            />
          </DragSortItem>
        ))}
      </DragSortContainer>
    </section>
  )
}

function ProjectChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary/15 text-primary"
          : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

