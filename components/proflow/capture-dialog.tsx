"use client"

import { useEffect, useRef, useState } from "react"
import { CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Modal } from "./modal"
import { useStore, type Priority } from "./store"

const priorities: Priority[] = ["low", "medium", "high"]
const categories = ["Design", "Engineering", "Planning", "Admin", "Meetings"]
// Sentinel value used by the project select for "create a new project".
const NEW_PROJECT = "__new__"

export function CaptureDialog({
  open,
  onClose,
  initialProject,
}: {
  open: boolean
  onClose: () => void
  /** From the "New project" button — pre-fills the project name (may be ""). */
  initialProject?: string
}) {
  const { projects, addTask } = useStore()
  // "single" adds a standalone task with no project (lands in Inbox); "project"
  // attaches the task to an existing project or a brand-new one.
  const [mode, setMode] = useState<"single" | "project">("single")
  const [title, setTitle] = useState("")
  const [project, setProject] = useState(projects[0] ?? "")
  const [creatingProject, setCreatingProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [category, setCategory] = useState(categories[0])
  const [priority, setPriority] = useState<Priority>("medium")
  const [due, setDue] = useState("Today")
  const [dueDate, setDueDate] = useState("")
  const newProjectInputRef = useRef<HTMLInputElement>(null)

  // The dialog stays mounted (page.tsx always renders it) — re-sync state
  // every time it opens. The "New project" button pre-fills the project name
  // and jumps straight into project mode; otherwise just refresh the default
  // project select (never overwriting a value the user is currently typing).
  useEffect(() => {
    if (!open) return
    if (initialProject !== undefined) {
      setMode("project")
      setCreatingProject(true)
      setNewProjectName(initialProject)
    } else {
      setProject((prev) => (projects.includes(prev) ? prev : projects[0] ?? ""))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projects, initialProject])

  // Park focus on the project name field when creating a new project.
  useEffect(() => {
    if (open && creatingProject) newProjectInputRef.current?.focus()
  }, [open, creatingProject])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    const finalProject =
      mode === "single"
        ? ""
        : creatingProject
          ? newProjectName.trim()
          : project
    // In project mode we need an actual project name — fall back to single if
    // none was chosen (e.g. no projects exist yet and nothing was typed).
    if (mode === "project" && !finalProject) {
      setMode("single")
      setCreatingProject(false)
      return
    }
    addTask({ title: title.trim(), project: finalProject, category, priority, due })
    // Remember the project so the next open defaults to it — adding multiple
    // tasks to the same project is the whole point of the quick-create flow.
    if (mode === "project" && finalProject) setProject(finalProject)
    setTitle("")
    setPriority("medium")
    setDue("Today")
    setDueDate("")
    setNewProjectName("")
    setCreatingProject(false)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Capture a task" description="Quickly add something to your workspace.">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="capture-title" className="text-sm font-medium text-foreground">
            Title
          </label>
          <input
            id="capture-title"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to get done?"
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>

        {/* Single task vs project task */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">Add as</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode("single")}
              className={`h-10 rounded-lg border text-xs font-semibold transition-colors ${
                mode === "single"
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-input bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              Single task
            </button>
            <button
              type="button"
              onClick={() => setMode("project")}
              className={`h-10 rounded-lg border text-xs font-semibold transition-colors ${
                mode === "project"
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-input bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              Project task
            </button>
          </div>
        </div>

        {mode === "project" && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="capture-project" className="text-sm font-medium text-foreground">
              Project
            </label>
            <select
              id="capture-project"
              value={creatingProject ? NEW_PROJECT : project}
              onChange={(e) => {
                if (e.target.value === NEW_PROJECT) {
                  setCreatingProject(true)
                } else {
                  setCreatingProject(false)
                  setProject(e.target.value)
                }
              }}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              {projects.length > 0 ? (
                projects.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))
              ) : (
                <option value="" disabled>
                  No projects yet
                </option>
              )}
              <option value={NEW_PROJECT}>＋ New project…</option>
            </select>
            {creatingProject && (
              <input
                ref={newProjectInputRef}
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Project name"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Priority">
            <div className="flex gap-1.5">
              {priorities.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`h-10 flex-1 rounded-lg border text-xs font-medium capitalize transition-colors ${
                    priority === p
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-input bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </Field>
        </div>

        {/* Due — type a label or pick a date from the calendar */}
        <Field label="Due">
          <div className="flex gap-2">
            <input
              value={due}
              onChange={(e) => {
                setDue(e.target.value)
                setDueDate("")
              }}
              placeholder="e.g. Today, Aug 15"
              className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="date"
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value)
                  if (e.target.value) setDue(e.target.value)
                }}
                aria-label="Pick a due date"
                className="h-10 w-40 rounded-lg border border-input bg-background pl-9 pr-2 text-sm text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 [color-scheme:dark]"
              />
            </div>
          </div>
        </Field>

        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="lg">
            Add task
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
    </div>
  )
}
