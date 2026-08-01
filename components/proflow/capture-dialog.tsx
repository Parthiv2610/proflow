"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Modal } from "./modal"
import { useStore, type Priority } from "./store"

const priorities: Priority[] = ["low", "medium", "high"]
const categories = ["Design", "Engineering", "Planning", "Admin", "Meetings"]

export function CaptureDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { projects, addTask } = useStore()
  const [title, setTitle] = useState("")
  const [project, setProject] = useState(projects[0] ?? "General")
  const [category, setCategory] = useState(categories[0])
  const [priority, setPriority] = useState<Priority>("medium")
  const [due, setDue] = useState("Today")

  // The dialog stays mounted (page.tsx always renders it) — re-sync the
  // default project every time it opens so it reflects projects created since.
  // The guard never overwrites a value the user is currently typing (e.g. a
  // LAN-sync push could add projects while the dialog is open).
  useEffect(() => {
    if (open) setProject((prev) => (projects.includes(prev) ? prev : projects[0] ?? "General"))
  }, [open, projects])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    addTask({ title: title.trim(), project, category, priority, due })
    setTitle("")
    setPriority("medium")
    setDue("Today")
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

        <div className="grid grid-cols-2 gap-3">
          <Field label="Project">
            {projects.length > 0 ? (
              <select
                value={project}
                onChange={(e) => setProject(e.target.value)}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                {projects.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            ) : (
              <input
                value={project}
                onChange={(e) => setProject(e.target.value)}
                placeholder="e.g. Personal, Work"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            )}
          </Field>
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
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Due">
            <input
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
            />
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
