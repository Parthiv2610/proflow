"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft,
  Bold,
  Check,
  Code2,
  Eye,
  FileUp,
  Heading1,
  ImagePlus,
  Italic,
  List,
  ListChecks,
  Mic,
  Minus,
  NotebookPen,
  Paperclip,
  Pin,
  Plus,
  Search,
  Square,
  Trash2,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Modal } from "../modal"
import { useStore, type Note, type NoteAttachment } from "../store"
import { renderMarkdown } from "@/lib/markdown"
import { isCapacitor } from "@/lib/lan-sync"
import { formatBytes, saveAttachmentAndNotify } from "@/lib/attachments"
import {
  MAX_VOICE_SECONDS,
  cancelVoiceRecording,
  formatDuration,
  startVoiceRecording,
  stopVoiceRecording,
  voiceSupported,
} from "@/lib/voice"
import { NoteReader } from "../note-reader"

const DEFAULT_TAGS = ["Design", "Planning", "Meetings", "Personal", "Engineering"]

// OneNote-style defaults for notes without an explicit notebook/section.
const DEFAULT_NOTEBOOK = "Personal"
const DEFAULT_SECTION = "General"

// localStorage holds roughly 5 MB total, and attachments are stored as base64
// data URLs — keep each attachment small enough that a few notes don't blow
// the quota. Images render inline; other files appear as downloadable chips.
const MAX_ATTACHMENT_BYTES = 2.5 * 1024 * 1024

const inputCls =
  "h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"

// The inline canvas's editable fields (title/body/tag/attachments plus the
// OneNote hierarchy it belongs to). Unsaved changes live here until Save.
type Draft = {
  title: string
  body: string
  tag: string
  pinned: boolean
  attachments: NoteAttachment[]
  notebook: string
  section: string
}

const blankDraft = (): Draft => ({
  title: "",
  body: "",
  tag: DEFAULT_TAGS[0],
  pinned: false,
  attachments: [],
  notebook: DEFAULT_NOTEBOOK,
  section: DEFAULT_SECTION,
})

const fromNote = (n: Note): Draft => ({
  title: n.title,
  body: n.body,
  tag: n.tag,
  pinned: !!n.pinned,
  attachments: n.attachments ?? [],
  notebook: n.notebook?.trim() || DEFAULT_NOTEBOOK,
  section: n.section?.trim() || DEFAULT_SECTION,
})

/** One-line excerpt for the page list (markdown markers stripped). */
const excerpt = (n: Note) =>
  n.body
    .replace(/[#*`>_\-[\]]/g, "")
    .trim()
    .slice(0, 60) || "No content"

export function NotesView() {
  const { notes, addNote, updateNote, deleteNote } = useStore()

  // ── OneNote hierarchy (derived from notes, like projects from tasks) ──
  const notebooks = useMemo(
    () => Array.from(new Set(notes.map((n) => n.notebook?.trim() || DEFAULT_NOTEBOOK))),
    [notes],
  )
  const sectionsOf = useMemo(
    () => (nb: string) =>
      Array.from(
        new Set(
          notes
            .filter((n) => (n.notebook?.trim() || DEFAULT_NOTEBOOK) === nb)
            .map((n) => n.section?.trim() || DEFAULT_SECTION),
        ),
      ),
    [notes],
  )
  const [activeNotebook, setActiveNotebook] = useState(DEFAULT_NOTEBOOK)
  const [activeSection, setActiveSection] = useState(DEFAULT_SECTION)
  // The effective notebook/section always exist, even with no notes yet.
  const effNotebook = notebooks.includes(activeNotebook) ? activeNotebook : notebooks[0] ?? DEFAULT_NOTEBOOK
  const effSections = useMemo(() => sectionsOf(effNotebook), [sectionsOf, effNotebook])
  const effSection = effSections.includes(activeSection) ? activeSection : effSections[0] ?? DEFAULT_SECTION

  // Page-list search
  const [query, setQuery] = useState("")

  // Inline canvas state — one draft for the currently open page.
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(blankDraft)
  const [dirty, setDirty] = useState(false)
  const dirtyRef = useRef(false)
  const currentIdRef = useRef<string | null>(null)
  // Refs keep the unmount auto-save from reading stale closures.
  const saveRef = useRef<() => void>(() => {})

  // Full-screen reader (wiki links, history, print).
  const [reading, setReading] = useState<Note | null>(null)
  // Mobile: show either the page list or the canvas.
  const [mobilePane, setMobilePane] = useState<"list" | "canvas">("list")
  // New notebook / section modal
  const [newModalOpen, setNewModalOpen] = useState(false)
  const [newModalKind, setNewModalKind] = useState<"notebook" | "section">("section")
  const [newName, setNewName] = useState("")

  // Editor helpers (same as the old modal editor, now inline)
  const [preview, setPreview] = useState(false)
  const [attachError, setAttachError] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [recSeconds, setRecSeconds] = useState(0)
  const recordingRef = useRef(false)
  const recTimerRef = useRef<number | null>(null)
  const recStartRef = useRef(0)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const allTags = useMemo(() => {
    const fromNotes = notes.map((n) => n.tag).filter(Boolean)
    return Array.from(new Set([...DEFAULT_TAGS, ...fromNotes]))
  }, [notes])

  // Pages visible in the current notebook + section (pinned first).
  const viewNotes = useMemo(() => {
    const q = query.trim().toLowerCase()
    return notes
      .filter((n) => {
        if ((n.notebook?.trim() || DEFAULT_NOTEBOOK) !== effNotebook) return false
        if ((n.section?.trim() || DEFAULT_SECTION) !== effSection) return false
        if (q && !`${n.title} ${n.body} ${n.tag}`.toLowerCase().includes(q)) return false
        return true
      })
      .sort((a, b) => (!!a.pinned === !!b.pinned ? 0 : a.pinned ? -1 : 1))
  }, [notes, query, effNotebook, effSection])
  const pinnedPages = viewNotes.filter((n) => n.pinned)
  const otherPages = viewNotes.filter((n) => !n.pinned)
  const currentNote = currentId ? notes.find((n) => n.id === currentId) : null

  const setDraftFn = (fn: (d: Draft) => Draft) => {
    setDraft(fn)
    dirtyRef.current = true
    setDirty(true)
  }
  const update = (patch: Partial<Draft>) => setDraftFn((d) => ({ ...d, ...patch }))

  // Persist the open page's draft (only if something actually changed, so
  // unchanged pages don't spam the version history).
  const saveCurrent = () => {
    if (!currentIdRef.current || !dirtyRef.current) return
    updateNote(currentIdRef.current, {
      title: draft.title.trim() || "Untitled page",
      body: draft.body.trim() || "No content yet.",
      tag: draft.tag.trim() || DEFAULT_TAGS[0],
      pinned: draft.pinned,
      attachments: draft.attachments,
      notebook: draft.notebook,
      section: draft.section,
    })
    dirtyRef.current = false
    setDirty(false)
  }
  saveRef.current = saveCurrent

  // Leaving the view (or the tab closing) must not lose unsaved text.
  useEffect(() => {
    return () => {
      if (dirtyRef.current && currentIdRef.current) saveRef.current()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Ctrl/Cmd+S saves the open page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault()
        saveRef.current()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // Stop any recording if the view unmounts mid-capture.
  useEffect(() => {
    return () => {
      if (recTimerRef.current) {
        clearInterval(recTimerRef.current)
        recTimerRef.current = null
      }
      if (recordingRef.current) cancelVoiceRecording()
    }
  }, [])

  const clearCanvas = () => {
    setCurrentId(null)
    currentIdRef.current = null
    setDraft(blankDraft())
    dirtyRef.current = false
    setDirty(false)
    setPreview(false)
    setMobilePane("list")
  }

  const openPage = (n: Note) => {
    saveCurrent()
    setCurrentId(n.id)
    currentIdRef.current = n.id
    setDraft(fromNote(n))
    dirtyRef.current = false
    setDirty(false)
    setPreview(false)
    setMobilePane("canvas")
  }

  // Creates a page (optionally in a brand-new notebook/section) and opens it.
  const createPage = (nb?: string, sec?: string) => {
    saveCurrent()
    const notebook = nb ?? effNotebook
    const section = sec ?? effSection
    if (nb) setActiveNotebook(nb)
    if (sec) setActiveSection(sec)
    const id = addNote({
      title: "Untitled page",
      body: "No content yet.",
      tag: DEFAULT_TAGS[0],
      notebook,
      section,
    })
    setCurrentId(id)
    currentIdRef.current = id
    setDraft({ ...blankDraft(), notebook, section })
    dirtyRef.current = false
    setDirty(false)
    setPreview(false)
    setMobilePane("canvas")
  }

  const switchNotebook = (nb: string) => {
    saveCurrent()
    setActiveNotebook(nb)
    setActiveSection(sectionsOf(nb)[0] ?? DEFAULT_SECTION)
    clearCanvas()
  }

  const switchSection = (sec: string) => {
    saveCurrent()
    setActiveSection(sec)
    clearCanvas()
  }

  const openNewModal = (kind: "notebook" | "section") => {
    setNewModalKind(kind)
    setNewName("")
    setNewModalOpen(true)
  }

  const confirmNew = (e: React.FormEvent) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    if (newModalKind === "notebook") createPage(name, DEFAULT_SECTION)
    else createPage(undefined, name)
    setNewModalOpen(false)
    setNewName("")
  }

  const deleteCurrent = () => {
    if (!currentIdRef.current) return
    deleteNote(currentIdRef.current)
    clearCanvas()
  }

  // ── Markdown editing helpers ──────────────────────────────
  const wrap = (before: string, after = before, placeholder = "text") => {
    const el = bodyRef.current
    if (!el) return
    const { selectionStart: s, selectionEnd: e } = el
    const sel = draft.body.slice(s, e) || placeholder
    update({ body: draft.body.slice(0, s) + before + sel + after + draft.body.slice(e) })
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(s + before.length, s + before.length + sel.length)
    })
  }

  const prefixLines = (prefix: string) => {
    const el = bodyRef.current
    if (!el) return
    const start = el.selectionStart
    const lineStart = draft.body.lastIndexOf("\n", start - 1) + 1
    const lineEndIdx = draft.body.indexOf("\n", start)
    const lineEnd = lineEndIdx === -1 ? draft.body.length : lineEndIdx
    const segment = draft.body.slice(lineStart, lineEnd)
    update({
      body:
        draft.body.slice(0, lineStart) +
        segment.split("\n").map((l) => prefix + l).join("\n") +
        draft.body.slice(lineEnd),
    })
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(lineStart + prefix.length, lineEnd + prefix.length)
    })
  }

  const insertDivider = () => {
    const el = bodyRef.current
    if (!el) return
    const s = el.selectionStart
    const before =
      draft.body.slice(0, s).endsWith("\n") || draft.body.slice(0, s).length === 0 ? "" : "\n"
    update({ body: draft.body.slice(0, s) + before + "\n---\n" + draft.body.slice(s) })
    requestAnimationFrame(() => {
      el.focus()
      const p = s + before.length + "\n---\n".length
      el.setSelectionRange(p, p)
    })
  }

  // ── Attachments & voice ───────────────────────────────────
  const addFiles = (files: FileList | null) => {
    if (!files) return
    setAttachError(null)
    for (const file of Array.from(files)) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setAttachError(`${file.name} is too large (max ${formatBytes(MAX_ATTACHMENT_BYTES)}).`)
        continue
      }
      const reader = new FileReader()
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string
        if (!dataUrl) return
        setDraftFn((d) => ({
          ...d,
          attachments: [
            ...d.attachments,
            {
              id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              name: file.name,
              kind: file.type.startsWith("image/") ? "image" : "file",
              mime: file.type || "application/octet-stream",
              dataUrl,
              size: file.size,
            },
          ],
        }))
      }
      reader.readAsDataURL(file)
    }
  }

  const removeAttachment = (id: string) =>
    setDraftFn((d) => ({ ...d, attachments: d.attachments.filter((a) => a.id !== id) }))

  const stopRecording = async () => {
    if (recTimerRef.current) {
      clearInterval(recTimerRef.current)
      recTimerRef.current = null
    }
    setRecording(false)
    recordingRef.current = false
    setRecSeconds(0)
    const rec = await stopVoiceRecording()
    if (!rec || rec.size === 0) return
    const ext = rec.mime.includes("mp4") ? "m4a" : "webm"
    const day = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })
    setDraftFn((d) => ({
      ...d,
      attachments: [
        ...d.attachments,
        {
          id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: `Voice note ${day}.${ext}`,
          kind: "voice",
          mime: rec.mime,
          dataUrl: rec.dataUrl,
          size: rec.size,
          durationMs: rec.durationMs,
        },
      ],
    }))
  }

  const toggleRecording = async () => {
    if (recordingRef.current) {
      await stopRecording()
      return
    }
    try {
      await startVoiceRecording()
      recordingRef.current = true
      setRecording(true)
      setRecSeconds(0)
      recStartRef.current = Date.now()
      recTimerRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - recStartRef.current) / 1000)
        setRecSeconds(elapsed)
        if (elapsed >= MAX_VOICE_SECONDS) stopRecording()
      }, 250)
    } catch {
      setAttachError("Microphone unavailable or permission denied.")
    }
  }

  /** Anchor click that routes Android to the native save path (shared helper). */
  const attachmentClick = (e: React.MouseEvent, a: NoteAttachment) => {
    if (isCapacitor()) {
      e.preventDefault()
      saveAttachmentAndNotify(a)
    }
  }

  const wordCount = draft.body.trim() ? draft.body.trim().split(/\s+/).length : 0

  // One page-list row (defined here so it can open the page / highlight it).
  const pageItem = (n: Note) => (
    <button
      key={n.id}
      type="button"
      onClick={() => openPage(n)}
      className={cn(
        "flex w-full flex-col gap-0.5 rounded-lg px-2.5 py-2 text-left transition-colors",
        currentId === n.id ? "bg-primary/10 text-foreground" : "hover:bg-secondary",
      )}
    >
      <span className="flex items-center gap-1.5">
        {n.pinned && <Pin className="size-3 shrink-0 fill-primary text-primary" />}
        <span className="truncate text-sm font-medium">{n.title}</span>
      </span>
      <span className="truncate text-[11px] text-muted-foreground">{excerpt(n)}</span>
    </button>
  )

  return (
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-3 p-3 lg:p-5">
      {/* ── Notebook + section tabs (OneNote chrome) ── */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="relative">
          <NotebookPen className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <select
            value={effNotebook}
            onChange={(e) => {
              if (e.target.value === "__new__") {
                openNewModal("notebook")
                return
              }
              switchNotebook(e.target.value)
            }}
            aria-label="Notebook"
            className="h-9 cursor-pointer rounded-lg border border-border bg-card pr-8 pl-8 text-sm font-semibold text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            {notebooks.map((nb) => (
              <option key={nb} value={nb}>
                {nb}
              </option>
            ))}
            <option value="__new__">＋ New notebook…</option>
          </select>
        </div>

        <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
          {effSections.map((sec) => (
            <button
              key={sec}
              type="button"
              onClick={() => switchSection(sec)}
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                effSection === sec
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              {sec}
            </button>
          ))}
          <button
            type="button"
            onClick={() => openNewModal("section")}
            aria-label="New section"
            title="New section"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Plus className="size-4" />
          </button>
        </div>
      </div>

      {/* ── Body: page list + canvas ── */}
      <div className="flex min-h-0 flex-1 gap-3">
        {/* Page list (left) */}
        <aside
          className={cn(
            "min-h-0 w-full flex-col overflow-hidden rounded-xl border border-border bg-card lg:flex lg:w-72",
            mobilePane === "list" ? "flex" : "hidden",
          )}
        >
          <div className="shrink-0 space-y-2 border-b border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Pages
              </span>
              <button
                type="button"
                onClick={() => createPage()}
                className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Plus className="size-3.5" /> New page
              </button>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search pages..."
                className="h-9 w-full rounded-lg border border-input bg-background pr-3 pl-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {viewNotes.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <NotebookPen className="size-6 text-muted-foreground/50" />
                <p className="text-sm font-medium text-foreground">No pages here</p>
                <p className="text-xs text-muted-foreground">Create a page to get started.</p>
              </div>
            ) : (
              <>
                {pinnedPages.length > 0 && (
                  <div className="mb-1">
                    <p className="px-2.5 py-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                      Pinned
                    </p>
                    {pinnedPages.map(pageItem)}
                  </div>
                )}
                <p className="px-2.5 py-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Pages
                </p>
                {otherPages.map(pageItem)}
              </>
            )}
          </div>
        </aside>

        {/* Canvas (right) */}
        <section
          className={cn(
            "min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card lg:flex",
            mobilePane === "canvas" ? "flex" : "hidden",
          )}
        >
          {currentId === null ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <NotebookPen className="size-8 text-muted-foreground/40" />
              <div>
                <p className="font-medium text-foreground">Select a page</p>
                <p className="text-sm text-muted-foreground">Pick a page from the list, or create a new one.</p>
              </div>
              <Button size="sm" onClick={() => createPage()} className="gap-1.5">
                <Plus className="size-3.5" /> Add page
              </Button>
            </div>
          ) : (
            <>
              {/* Canvas header */}
              <header className="flex shrink-0 items-start gap-2 border-b border-border p-3 sm:p-4">
                <button
                  type="button"
                  onClick={() => setMobilePane("list")}
                  aria-label="Back to pages"
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
                >
                  <ArrowLeft className="size-4" />
                </button>
                <input
                  value={draft.title}
                  onChange={(e) => update({ title: e.target.value })}
                  placeholder="Page title"
                  className="min-w-0 flex-1 bg-transparent text-xl font-semibold text-foreground outline-none placeholder:text-muted-foreground/40 sm:text-2xl"
                />
                <div className="flex shrink-0 items-center gap-2">
                  {currentNote && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setReading(currentNote)}
                      className="gap-1.5"
                      title="Open in reader (wiki links, history, print)"
                    >
                      <Eye className="size-3.5" /> Read
                    </Button>
                  )}
                  <Button size="sm" onClick={saveCurrent} disabled={!dirty} className="gap-1.5">
                    <Check className="size-3.5" />
                    {dirty ? "Save" : "Saved"}
                  </Button>
                </div>
              </header>

              {/* Formatting toolbar */}
              <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border p-2">
                <ToolButton label="Bold" onClick={() => wrap("**")}>
                  <Bold className="size-4" />
                </ToolButton>
                <ToolButton label="Italic" onClick={() => wrap("*")}>
                  <Italic className="size-4" />
                </ToolButton>
                <ToolButton label="Inline code" onClick={() => wrap("`")}>
                  <Code2 className="size-4" />
                </ToolButton>
                <span className="mx-1 h-5 w-px bg-border" aria-hidden />
                <ToolButton label="Heading" onClick={() => prefixLines("# ")}>
                  <Heading1 className="size-4" />
                </ToolButton>
                <ToolButton label="Bullet list" onClick={() => prefixLines("- ")}>
                  <List className="size-4" />
                </ToolButton>
                <ToolButton label="Checklist" onClick={() => prefixLines("- [ ] ")}>
                  <ListChecks className="size-4" />
                </ToolButton>
                <ToolButton label="Divider" onClick={insertDivider}>
                  <Minus className="size-4" />
                </ToolButton>
                <span className="mx-1 h-5 w-px bg-border" aria-hidden />
                <ToolButton label="Add image" onClick={() => imageInputRef.current?.click()}>
                  <ImagePlus className="size-4" />
                </ToolButton>
                <ToolButton label="Attach file" onClick={() => fileInputRef.current?.click()}>
                  <FileUp className="size-4" />
                </ToolButton>
                <span className="flex-1" />
                <button
                  type="button"
                  onClick={() => setPreview((p) => !p)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                    preview ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Eye className="size-3.5" />
                  {preview ? "Editing" : "Preview"}
                </button>
              </div>

              {/* Body — editable canvas content */}
              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
                {preview ? (
                  <div
                    className="pf-prose rounded-lg border border-input bg-secondary/20 px-3 py-2 text-sm"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(draft.body || "*Nothing to preview yet.*") }}
                  />
                ) : (
                  <textarea
                    ref={bodyRef}
                    value={draft.body}
                    onChange={(e) => update({ body: e.target.value })}
                    placeholder="Write something... # heading, **bold**, - [ ] todo, attach images and files"
                    rows={14}
                    className="h-full min-h-64 w-full resize-none bg-transparent font-mono text-[13px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/40"
                  />
                )}

                {/* Attachments */}
                <div className="mt-4 flex flex-col gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Attachments ({draft.attachments.length})
                  </span>
                  {draft.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {draft.attachments.map((a) =>
                        a.kind === "image" ? (
                          <div key={a.id} className="group/att relative">
                            <img
                              src={a.dataUrl}
                              alt={a.name}
                              title={`${a.name} · ${formatBytes(a.size)}`}
                              className="h-20 w-20 rounded-lg border border-border object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => removeAttachment(a.id)}
                              aria-label={`Remove ${a.name}`}
                              className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-danger text-danger-foreground opacity-0 shadow transition-opacity group-hover/att:opacity-100"
                            >
                              <X className="size-3" />
                            </button>
                          </div>
                        ) : a.kind === "voice" ? (
                          <span
                            key={a.id}
                            className="group/att flex w-full flex-col gap-1.5 rounded-lg border border-border bg-secondary/40 p-2 text-xs text-muted-foreground"
                          >
                            <span className="flex items-center gap-1.5">
                              <Mic className="size-3.5 shrink-0 text-primary" />
                              <span className="min-w-0 flex-1 truncate">{a.name}</span>
                              {a.durationMs ? (
                                <span className="shrink-0 text-[10px]">{formatDuration(a.durationMs)}</span>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => removeAttachment(a.id)}
                                aria-label={`Remove ${a.name}`}
                                className="flex size-5 shrink-0 items-center justify-center rounded-md hover:bg-danger/15 hover:text-danger"
                              >
                                <X className="size-3" />
                              </button>
                            </span>
                            <audio controls src={a.dataUrl} preload="metadata" className="h-8 w-full" />
                          </span>
                        ) : (
                          <span
                            key={a.id}
                            className="group/att flex items-center gap-1.5 rounded-lg border border-border bg-secondary/40 py-1 pr-1 pl-2 text-xs text-muted-foreground"
                          >
                            <Paperclip className="size-3.5 shrink-0" />
                            <a
                              href={a.dataUrl}
                              download={a.name}
                              onClick={(e) => attachmentClick(e, a)}
                              className="max-w-40 truncate hover:text-foreground"
                            >
                              {a.name}
                            </a>
                            <span className="shrink-0 text-[10px]">({formatBytes(a.size)})</span>
                            <button
                              type="button"
                              onClick={() => removeAttachment(a.id)}
                              aria-label={`Remove ${a.name}`}
                              className="flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-danger/15 hover:text-danger"
                            >
                              <X className="size-3" />
                            </button>
                          </span>
                        ),
                      )}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = "" }} />
                    <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = "" }} />
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                    >
                      <ImagePlus className="size-3.5" /> Add images
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                    >
                      <FileUp className="size-3.5" /> Attach file
                    </button>
                    {voiceSupported() && (
                      <button
                        type="button"
                        onClick={toggleRecording}
                        className={cn(
                          "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                          recording
                            ? "animate-pulse border-danger/40 bg-danger/15 text-danger"
                            : "border-border text-foreground hover:bg-accent",
                        )}
                      >
                        {recording ? <Square className="size-3.5 fill-current" /> : <Mic className="size-3.5" />}
                        {recording ? `Stop · ${formatDuration(recSeconds * 1000)} / ${MAX_VOICE_SECONDS}s` : "Voice note"}
                      </button>
                    )}
                  </div>
                  {attachError && (
                    <p className="rounded-lg border border-danger/30 bg-danger/5 p-2 text-xs text-danger">
                      {attachError}
                    </p>
                  )}
                </div>
              </div>

              {/* Page settings: tag, home (notebook/section), pin, word count, delete */}
              <footer className="shrink-0 space-y-3 border-t border-border p-3 sm:p-4">
                <div className="flex flex-wrap items-center gap-2">
                  {allTags.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => update({ tag: t })}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                        draft.tag === t
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-input text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {t}
                    </button>
                  ))}
                  <input
                    value={draft.tag}
                    onChange={(e) => update({ tag: e.target.value })}
                    placeholder="Custom tag"
                    className="h-8 min-w-28 flex-1 rounded-full border border-input bg-background px-3 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={draft.notebook}
                      onChange={(e) => {
                        if (e.target.value === "__new__") {
                          openNewModal("notebook")
                          return
                        }
                        update({ notebook: e.target.value, section: sectionsOf(e.target.value)[0] ?? DEFAULT_SECTION })
                      }}
                      aria-label="Move to notebook"
                      className={cn(inputCls, "cursor-pointer")}
                    >
                      {notebooks.map((nb) => (
                        <option key={nb} value={nb}>
                          {nb}
                        </option>
                      ))}
                      <option value="__new__">＋ New notebook…</option>
                    </select>
                    <select
                      value={draft.section}
                      onChange={(e) => {
                        if (e.target.value === "__new__") {
                          openNewModal("section")
                          return
                        }
                        update({ section: e.target.value })
                      }}
                      aria-label="Move to section"
                      className={cn(inputCls, "cursor-pointer")}
                    >
                      {sectionsOf(draft.notebook).map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                      <option value="__new__">＋ New section…</option>
                    </select>
                    <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={draft.pinned}
                        onChange={(e) => update({ pinned: e.target.checked })}
                        className="size-3.5 accent-[var(--primary)]"
                      />
                      Pin
                    </label>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {wordCount} {wordCount === 1 ? "word" : "words"}
                    </span>
                    <button
                      type="button"
                      onClick={deleteCurrent}
                      aria-label="Delete page"
                      className="flex items-center gap-1.5 rounded-lg border border-danger/30 px-2.5 py-1.5 text-xs font-medium text-danger transition-colors hover:bg-danger/10"
                    >
                      <Trash2 className="size-3.5" /> Delete
                    </button>
                  </div>
                </div>
              </footer>
            </>
          )}
        </section>
      </div>

      {/* New notebook / section */}
      <Modal
        open={newModalOpen}
        onClose={() => setNewModalOpen(false)}
        title={newModalKind === "notebook" ? "New notebook" : "New section"}
        description={
          newModalKind === "notebook"
            ? "A fresh notebook with a General section — first page included."
            : `A new section in ${effNotebook}.`
        }
      >
        <form onSubmit={confirmNew} className="flex flex-col gap-4">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={newModalKind === "notebook" ? "Notebook name" : "Section name"}
            className={inputCls}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setNewModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="lg">
              {newModalKind === "notebook" ? "Create notebook" : "Create section"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Full-screen reader — wiki links, history, print. The canvas is the
          editor, so "Edit" from the reader just closes it. */}
      {(() => {
        const live = reading ? notes.find((n) => n.id === reading.id) : null
        if (!live) return null
        return (
          <NoteReader
            note={live}
            onClose={() => setReading(null)}
            onEdit={() => setReading(null)}
            onDelete={() => {
              deleteNote(live.id)
              setReading(null)
              if (live.id === currentIdRef.current) clearCanvas()
            }}
            onTogglePin={() => updateNote(live.id, { pinned: !live.pinned })}
            onNavigate={(n) => setReading(n)}
          />
        )
      })()}
    </div>
  )
}

function ToolButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  )
}
