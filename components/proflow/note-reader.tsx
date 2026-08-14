"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft,
  Download,
  History,
  Link2,
  Mic,
  Paperclip,
  Pencil,
  Pin,
  PinOff,
  Printer,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Modal } from "./modal"
import { useStore, type Note, type NoteAttachment } from "./store"
import { isCapacitor } from "@/lib/lan-sync"
import { formatBytes, saveAttachmentAndNotify } from "@/lib/attachments"
import { extractWikiLinks, renderMarkdown } from "@/lib/markdown"
import { formatDuration } from "@/lib/voice"
import { showNotification } from "@/lib/notify"

function relativeTime(at: number): string {
  const diff = Date.now() - at
  if (diff < 60_000) return "just now"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return new Date(at).toLocaleDateString()
}

/**
 * Full-screen note reader — opens when you click a note. Renders the markdown
 * body (including clickable [[wiki links]]), displays attachments properly
 * (full-size images, downloadable file chips, audio players for voice notes),
 * and offers Edit / Pin / Delete / Print / version history. Sits below the
 * modal layer (z-40 vs z-50), so dialogs open over it and the reader stays in
 * place behind them.
 */
export function NoteReader({
  note,
  onClose,
  onEdit,
  onDelete,
  onTogglePin,
  onNavigate,
}: {
  note: Note
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onTogglePin: () => void
  /** Jump to another note (wiki links / backlinks). */
  onNavigate: (n: Note) => void
}) {
  const { notes, noteHistory, restoreNoteVersion } = useStore()
  const [historyOpen, setHistoryOpen] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  // Navigating between notes (wiki links / backlinks) starts at the top of the
  // new note instead of keeping the previous scroll position.
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 })
  }, [note.id])

  // Escape closes the topmost layer — the history dialog if it's up, else the
  // reader. Page scroll is locked while the reader is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (historyOpen) {
        setHistoryOpen(false)
        setConfirmId(null)
      } else {
        onClose()
      }
    }
    window.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [onClose, historyOpen])

  const attachments = note.attachments ?? []
  const images = attachments.filter((a) => a.kind === "image")
  const files = attachments.filter((a) => a.kind === "file")
  const voices = attachments.filter((a) => a.kind === "voice")
  const words = note.body.trim() ? note.body.trim().split(/\s+/).length : 0
  const versions = noteHistory[note.id] ?? []

  // Wiki links: outgoing [[titles]] in this note + backlinks (notes that link
  // back here). Resolution is by exact title, case-insensitive.
  const outTitles = useMemo(() => extractWikiLinks(note.body), [note.body])
  const linked = useMemo(() => {
    const titleKey = (t: string) => t.trim().toLowerCase()
    const out = outTitles.map((title) => ({
      title,
      target: notes.find((n) => n.id !== note.id && titleKey(n.title) === titleKey(title)) ?? null,
    }))
    const back = notes.filter(
      (o) =>
        o.id !== note.id &&
        extractWikiLinks(o.body).some((t) => titleKey(t) === titleKey(note.title)),
    )
    return { out, back }
  }, [notes, note.id, note.body, note.title, outTitles])

  // Android: native save to Downloads (the WebView ignores anchor downloads).
  const fileClick = (e: React.MouseEvent, a: NoteAttachment) => {
    if (isCapacitor()) {
      e.preventDefault()
      saveAttachmentAndNotify(a)
    }
  }

  // Clicking a rendered [[wiki link]] jumps to the linked note.
  const onProseClick = (e: React.SyntheticEvent) => {
    const el = (e.target as HTMLElement).closest?.(".pf-wiki")
    if (!el) return
    const title = el.getAttribute("data-note-title")
    if (!title) return
    const target = notes.find((n) => n.title.trim().toLowerCase() === title.trim().toLowerCase())
    if (target) onNavigate(target)
    else showNotification("ProFlow", `No note named "${title}" yet — create one and it'll link automatically`)
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      {/* Reader header */}
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-1.5 border-b border-border bg-background/95 px-4 py-2.5 backdrop-blur">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to notes"
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Notes
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          aria-label="Print or save as PDF"
          title="Print / Save as PDF"
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Printer className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => setHistoryOpen(true)}
          aria-label="Version history"
          title="Version history"
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <History className="size-4" />
        </button>

        <span className="ml-auto flex items-center gap-2">
          <span className="rounded-md bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
            {note.tag}
          </span>
          {note.pinned && (
            <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
              <Pin className="size-3.5 fill-primary text-primary" />
              Pinned
            </span>
          )}
          <button
            type="button"
            onClick={onTogglePin}
            aria-label={note.pinned ? "Unpin note" : "Pin note"}
            title={note.pinned ? "Unpin" : "Pin to top"}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {note.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
          </button>
        </span>

        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete note"
          title="Delete note"
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-danger/15 hover:text-danger"
        >
          <Trash2 className="size-4" />
        </button>
        <Button onClick={onEdit} className="gap-1.5">
          <Pencil className="size-4" />
          Edit
        </Button>
      </header>

      {/* Reader body — pf-print-area is the print/PDF viewport */}
      <div
        ref={bodyRef}
        className="pf-print-area mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-5 py-8 sm:px-8"
      >
        <h1 className="text-3xl font-bold tracking-tight text-balance">{note.title}</h1>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Updated {note.updated} · {words} {words === 1 ? "word" : "words"}
        </p>

        <div
          className="pf-prose mt-6 cursor-text text-[15px] text-foreground/90"
          onClick={onProseClick}
          onKeyDown={(e) => {
            if (e.key === "Enter") onProseClick(e)
          }}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(note.body || "*No content yet.*") }}
        />

        {/* Wiki links: outbound + backlinks */}
        {(linked.out.length > 0 || linked.back.length > 0) && (
          <section className="mt-8 border-t border-border pt-5">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              <Link2 className="size-4" />
              Linked notes
            </h2>

            {linked.out.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground">
                  Links in this note ({linked.out.length})
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {linked.out.map(({ title, target }) =>
                    target ? (
                      <button
                        key={title}
                        type="button"
                        onClick={() => onNavigate(target)}
                        className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                      >
                        {title}
                      </button>
                    ) : (
                      <button
                        key={title}
                        type="button"
                        onClick={() =>
                          showNotification("ProFlow", `No note named "${title}" yet — create one to link it`)
                        }
                        className="rounded-full border border-dashed border-border px-2.5 py-1 text-xs font-medium text-muted-foreground"
                      >
                        {title} · missing
                      </button>
                    ),
                  )}
                </div>
              </div>
            )}

            {linked.back.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground">
                  Backlinks — notes that link here ({linked.back.length})
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {linked.back.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => onNavigate(o)}
                      className="rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-xs font-medium transition-colors hover:bg-secondary"
                    >
                      {o.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {attachments.length > 0 && (
          <section className="mt-8 border-t border-border pt-6">
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              Attachments ({attachments.length})
            </h2>

            {images.length > 0 && (
              <div className="mt-4 flex flex-col gap-4">
                {images.map((a) => (
                  <figure key={a.id}>
                    <img src={a.dataUrl} alt={a.name} className="w-full rounded-xl border border-border" />
                    <figcaption className="mt-1 text-xs text-muted-foreground">
                      {a.name} · {formatBytes(a.size)}
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}

            {files.length > 0 && (
              <div className="mt-4 flex flex-col gap-2">
                {files.map((a) => (
                  <a
                    key={a.id}
                    href={a.dataUrl}
                    download={a.name}
                    onClick={(e) => fileClick(e, a)}
                    title={`Save ${a.name}`}
                    className="flex items-center gap-2.5 rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-sm transition-colors hover:bg-secondary"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Paperclip className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium text-foreground">{a.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(a.size)}</span>
                    <Download className="size-4 shrink-0 text-muted-foreground" />
                  </a>
                ))}
              </div>
            )}

            {voices.length > 0 && (
              <div className="mt-4 flex flex-col gap-2">
                {voices.map((a) => (
                  <div
                    key={a.id}
                    className="flex flex-col gap-1.5 rounded-xl border border-border bg-secondary/40 p-3"
                  >
                    <div className="flex items-center gap-2.5 text-sm">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Mic className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium text-foreground">{a.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {a.durationMs ? formatDuration(a.durationMs) : ""} · {formatBytes(a.size)}
                      </span>
                    </div>
                    <audio controls src={a.dataUrl} preload="metadata" className="h-9 w-full" />
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Version history dialog */}
      <Modal
        open={historyOpen}
        onClose={() => {
          setHistoryOpen(false)
          setConfirmId(null)
        }}
        title="Version history"
        description={`${versions.length} saved ${versions.length === 1 ? "version" : "versions"} — snapshots are taken on every save (last 15 per note). Restoring is undoable.`}
      >
        {versions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No past versions yet. Save this note, then edits will be snapshotted here.
          </p>
        ) : (
          <div className="flex max-h-96 flex-col gap-2 overflow-y-auto pr-1">
            {[...versions]
              .sort((a, b) => b.at - a.at)
              .map((v) => {
                const vWords = v.body.trim() ? v.body.trim().split(/\s+/).length : 0
                return (
                  <div
                    key={v.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-secondary/40 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{v.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {relativeTime(v.at)} · {vWords} {vWords === 1 ? "word" : "words"}
                      </p>
                    </div>
                    <Button
                      variant={confirmId === v.id ? "destructive" : "ghost"}
                      size="sm"
                      onClick={() => {
                        if (confirmId === v.id) {
                          restoreNoteVersion(note.id, v)
                          setHistoryOpen(false)
                          setConfirmId(null)
                          showNotification("ProFlow", "↩️ Version restored")
                        } else {
                          setConfirmId(v.id)
                        }
                      }}
                    >
                      {confirmId === v.id ? "Restore now?" : "Restore"}
                    </Button>
                  </div>
                )
              })}
          </div>
        )}
      </Modal>
    </div>
  )
}
