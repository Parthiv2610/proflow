"use client"

import { useState } from "react"
import { NotebookPen, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Modal } from "../modal"
import { useStore } from "../store"
import { Card, PageHeader } from "../ui"

const tags = ["Design", "Planning", "Meetings", "Personal", "Engineering"]

export function NotesView() {
  const { notes, addNote, deleteNote } = useStore()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [tag, setTag] = useState(tags[0])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    addNote({ title: title.trim(), body: body.trim() || "No content yet.", tag })
    setTitle("")
    setBody("")
    setTag(tags[0])
    setOpen(false)
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <PageHeader title="Notes & Docs" subtitle={`${notes.length} notes in your workspace`}>
        <Button size="lg" onClick={() => setOpen(true)} className="gap-1.5">
          <Plus className="size-4" /> New note
        </Button>
      </PageHeader>

      {notes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <NotebookPen className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">No notes yet. Create your first one.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((n) => (
            <Card key={n.id} className="group flex flex-col">
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">{n.tag}</span>
                <button
                  type="button"
                  onClick={() => deleteNote(n.id)}
                  aria-label={`Delete note ${n.title}`}
                  className="flex size-7 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all hover:bg-danger/15 hover:text-danger group-hover:opacity-100"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              <h3 className="mt-3 font-semibold text-balance">{n.title}</h3>
              <p className="mt-1 line-clamp-4 flex-1 text-sm text-muted-foreground">{n.body}</p>
              <p className="mt-4 text-xs text-muted-foreground">Updated {n.updated}</p>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New note" description="Capture an idea, doc, or meeting note.">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title"
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write something..."
            rows={4}
            className="resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTag(t)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  tag === t ? "border-primary bg-primary/15 text-primary" : "border-input text-muted-foreground hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="lg">
              Save note
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
