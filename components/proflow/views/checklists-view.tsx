"use client"

import { useMemo, useState } from "react"
import {
  Archive,
  Check,
  CheckSquare,
  ChevronRight,
  Clock,
  Copy,
  GripVertical,
  MoreHorizontal,
  Pin,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useStore, type Checklist, type ChecklistItem } from "../store"
import { PageHeader, Card, ProgressBar } from "../ui"
import { CHECKLIST_TEMPLATES, CHECKLIST_CATEGORIES } from "../checklist-templates"
import { ChecklistDialog } from "../checklist-dialog"
import { ChecklistDetail } from "../checklist-detail"

type SortBy = "name" | "date" | "progress" | "items"

export function ChecklistsView() {
  const {
    checklists,
    deleteChecklist,
    updateChecklist,
    addChecklist,
    importChecklistFromTemplate,
    toggleChecklistItem,
    deleteChecklistItem,
    duplicateChecklist,
  } = useStore()

  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState<SortBy>("date")
  const [showTemplates, setShowTemplates] = useState(false)
  const [templateCategory, setTemplateCategory] = useState("All")
  const [openListId, setOpenListId] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ listId: string; x: number; y: number } | null>(null)

  const q = search.trim().toLowerCase()

  const activeLists = useMemo(() => {
    let lists = checklists.filter((cl) => !cl.archived)
    if (q) lists = lists.filter((cl) => cl.name.toLowerCase().includes(q))
    // Sort: pinned first, then by sort option
    const sorted = [...lists].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name)
        case "progress":
          const pA = a.items.length ? a.items.filter((i) => i.done).length / a.items.length : 0
          const pB = b.items.length ? b.items.filter((i) => i.done).length / b.items.length : 0
          return pB - pA
        case "items":
          return b.items.length - a.items.length
        case "date":
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
    })
    return sorted
  }, [checklists, q, sortBy])

  const archivedLists = useMemo(() => {
    return checklists.filter((cl) => cl.archived)
  }, [checklists])

  const templateGallery = useMemo(() => {
    let filtered = CHECKLIST_TEMPLATES
    if (templateCategory !== "All") {
      filtered = filtered.filter((t) => t.category === templateCategory)
    }
    return filtered
  }, [templateCategory])

  const openList = openListId ? checklists.find((cl) => cl.id === openListId) ?? null : null

  if (openList) {
    return (
      <ChecklistDetail
        list={openList}
        onBack={() => setOpenListId(null)}
        onRename={(name) => updateChecklist(openList.id, { name })}
        onTogglePin={() => updateChecklist(openList.id, { pinned: !openList.pinned })}
        onDelete={() => { deleteChecklist(openList.id); setOpenListId(null) }}
        onDuplicate={() => { duplicateChecklist(openList.id) }}
        onArchive={() => { updateChecklist(openList.id, { archived: true }); setOpenListId(null) }}
      />
    )
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <PageHeader
        title="Checklists"
        subtitle={`${activeLists.length} active · ${archivedLists.length} archived`}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowTemplates(true)}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Plus className="size-4" /> From template
          </button>
          <button
            type="button"
            onClick={() => setShowCreateDialog(true)}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
          >
            <Plus className="size-4" /> New list
          </button>
        </div>
      </PageHeader>

      {/* Search + Sort */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search checklists..."
            className="h-10 w-full rounded-xl border border-input bg-secondary/50 pr-3 pl-9 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>
        <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
          {(["date", "name", "progress", "items"] as SortBy[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSortBy(s)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors",
                sortBy === s ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s === "date" ? "Newest" : s}
            </button>
          ))}
        </div>
      </div>

      {/* Active Checklists Grid */}
      {activeLists.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <CheckSquare className="mx-auto size-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium text-foreground">No checklists yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create one from scratch or start with a template.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => setShowTemplates(true)}
              className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Browse templates
            </button>
            <button
              type="button"
              onClick={() => setShowCreateDialog(true)}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
            >
              Create blank list
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {activeLists.map((cl) => (
            <ChecklistCard
              key={cl.id}
              list={cl}
              onClick={() => setOpenListId(cl.id)}
              onToggleItem={toggleChecklistItem}
              onContextMenu={(e) => {
                e.preventDefault()
                setContextMenu({ listId: cl.id, x: e.clientX, y: e.clientY })
              }}
            />
          ))}
        </div>
      )}

      {/* Archived section */}
      {archivedLists.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <Archive className="size-4" />
            Archived ({archivedLists.length})
            <ChevronRight className={cn("size-4 transition-transform", showArchived && "rotate-90")} />
          </button>
          {showArchived && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 opacity-60">
              {archivedLists.map((cl) => (
                <ChecklistCard
                  key={cl.id}
                  list={cl}
                  onClick={() => setOpenListId(cl.id)}
              onToggleItem={toggleChecklistItem}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setContextMenu({ listId: cl.id, x: e.clientX, y: e.clientY })
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 min-w-44 rounded-xl border border-border bg-card p-1 shadow-lg"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <ContextMenuItem
              icon={<Pin className="size-3.5" />}
              label={checklists.find((c) => c.id === contextMenu.listId)?.pinned ? "Unpin" : "Pin to top"}
              onClick={() => {
                const cl = checklists.find((c) => c.id === contextMenu.listId)
                if (cl) updateChecklist(cl.id, { pinned: !cl.pinned })
                setContextMenu(null)
              }}
            />
            <ContextMenuItem
              icon={<Copy className="size-3.5" />}
              label="Duplicate"
              onClick={() => { duplicateChecklist(contextMenu.listId); setContextMenu(null) }}
            />
            <ContextMenuItem
              icon={<Archive className="size-3.5" />}
              label="Archive"
              onClick={() => { updateChecklist(contextMenu.listId, { archived: true }); setContextMenu(null) }}
            />
            <ContextMenuItem
              icon={<Trash2 className="size-3.5" />}
              label="Delete"
              danger
              onClick={() => { deleteChecklist(contextMenu.listId); setContextMenu(null) }}
            />
          </div>
        </>
      )}

      {/* Template Gallery Modal */}
      {showTemplates && (
        <TemplateGallery
          templates={templateGallery}
          categories={CHECKLIST_CATEGORIES}
          selectedCategory={templateCategory}
          onSelectCategory={setTemplateCategory}
          onSelect={(templateId) => {
            const id = importChecklistFromTemplate(templateId)
            setShowTemplates(false)
            if (id) setOpenListId(id)
          }}
          onClose={() => setShowTemplates(false)}
        />
      )}

      {/* Create Dialog */}
      {showCreateDialog && (
        <ChecklistDialog
          onClose={() => setShowCreateDialog(false)}
          onCreate={(name, icon, color) => {
            const id = addChecklist(name, icon, color)
            setShowCreateDialog(false)
            setOpenListId(id)
          }}
        />
      )}
    </div>
  )
}

// ── Checklist Card ──────────────────────────────────────
function ChecklistCard({
  list,
  onClick,
  onToggleItem,
  onContextMenu,
}: {
  list: Checklist
  onClick: () => void
  onToggleItem: (listId: string, itemId: string) => void
  onContextMenu: (e: React.MouseEvent) => void
}) {
  const total = list.items.length
  const done = list.items.filter((i) => i.done).length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const overdue = list.items.filter((i) => !i.done && i.due && i.due < new Date().toISOString().slice(0, 10)).length

  return (
    <div
      className="group cursor-pointer"
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
    <Card
      className="transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl text-lg" style={{ backgroundColor: list.color + "20" }}>
          {list.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-foreground">{list.name}</h3>
            {list.pinned && <Pin className="size-3 shrink-0 fill-primary text-primary" />}
            {list.recurring && (
              <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary capitalize">
                {list.recurring}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {total === 0 ? "Empty" : `${done}/${total} done`}
            {overdue > 0 && (
              <span className="ml-1.5 text-danger">· {overdue} overdue</span>
            )}
          </p>
        </div>
        <span className="text-lg font-bold tabular-nums text-muted-foreground">{pct}%</span>
      </div>
      {total > 0 && (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, backgroundColor: list.color }}
            />
          </div>
        </div>
      )}
      {(() => {
        const previewItems = [
          ...list.items.filter(i => i.done).slice(0, 1),
          ...list.items.filter(i => !i.done).slice(0, 4),
        ].slice(0, 5)
        return previewItems.length > 0 ? (
          <div className="mt-3 space-y-1">
            {previewItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={(e) => { e.stopPropagation(); onToggleItem(list.id, item.id); }}
                className="flex w-full items-center gap-2 rounded-lg px-1.5 py-0.5 text-left text-xs transition-colors hover:bg-secondary/80"
              >
                <span className={cn(
                  "flex size-3.5 shrink-0 items-center justify-center rounded border transition-colors",
                  item.done ? "border-success bg-success text-success-foreground" : "border-muted-foreground/50 text-transparent hover:border-primary",
                )}>
                  {item.done && <Check className="size-3" />}
                </span>
                <span className={cn("truncate text-muted-foreground", item.done && "line-through text-muted-foreground/50")}>
                  {item.title}
                </span>
              </button>
            ))}
            {list.items.length > previewItems.length && (
              <button type="button" onClick={onClick} className="w-full px-1.5 pt-1 text-left text-xs text-muted-foreground/60 hover:text-foreground">
                +{list.items.length - previewItems.length} more
              </button>
            )}
          </div>
        ) : null
      })()}
    </Card>
    </div>
  )
}

// ── Context Menu Item ──────────────────────────────────────
function ContextMenuItem({
  icon,
  label,
  danger,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        danger
          ? "text-danger hover:bg-danger/10"
          : "text-foreground hover:bg-secondary",
      )}
    >
      {icon}
      {label}
    </button>
  )
}

// ── Template Gallery ──────────────────────────────────────
function TemplateGallery({
  templates,
  categories,
  selectedCategory,
  onSelectCategory,
  onSelect,
  onClose,
}: {
  templates: typeof CHECKLIST_TEMPLATES
  categories: string[]
  selectedCategory: string
  onSelectCategory: (cat: string) => void
  onSelect: (templateId: string) => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-2xl border border-border bg-background">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Template Gallery</h2>
            <p className="text-sm text-muted-foreground">Start with a pre-built checklist</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Category filter */}
        <div className="flex gap-1 overflow-x-auto border-b border-border px-6 py-3">
          {["All", ...categories].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => onSelectCategory(cat)}
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                selectedCategory === cat
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Templates grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => onSelect(tpl.id)}
                className="flex flex-col items-start gap-2 rounded-xl border border-border p-4 text-left transition-all hover:border-primary/40 hover:shadow-md"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{tpl.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{tpl.name}</p>
                    <p className="text-xs text-muted-foreground">{tpl.category}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {tpl.items.length} items{tpl.items.some((i) => i.subtasks?.length) ? " · with subtasks" : ""}
                </p>
                <div className="flex flex-wrap gap-1">
                  {tpl.items.slice(0, 4).map((item, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {item.title}
                    </span>
                  ))}
                  {tpl.items.length > 4 && (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                      +{tpl.items.length - 4}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
