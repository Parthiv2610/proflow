"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import {
  ArrowLeft,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Clock,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  SortAsc,
  SortDesc,
  Trash2,
  Undo2,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useStore, type Checklist, type ChecklistItem, type SubTask, type Priority } from "./store"
import { Card, ProgressBar } from "./ui"

type ItemSort = "manual" | "priority" | "due" | "alpha"
type FilterStatus = "all" | "pending" | "done"

export function ChecklistDetail({
  list,
  onBack,
  onRename,
  onTogglePin,
  onDelete,
  onDuplicate,
  onArchive,
}: {
  list: Checklist
  onBack: () => void
  onRename: (name: string) => void
  onTogglePin: () => void
  onDelete: () => void
  onDuplicate: () => void
  onArchive: () => void
}) {
  const {
    addChecklistItem,
    updateChecklistItem,
    deleteChecklistItem,
    toggleChecklistItem,
    reorderChecklistItems,
    bulkToggleChecklistItems,
    clearCompletedItems,
  } = useStore()

  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<ItemSort>("manual")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all")
  const [newItemTitle, setNewItemTitle] = useState("")
  const [newItemPriority, setNewItemPriority] = useState<Priority>("medium")
  const [editingListName, setEditingListName] = useState(false)
  const [listName, setListName] = useState(list.name)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [contextMenu, setContextMenu] = useState<{ itemId: string; x: number; y: number } | null>(null)
  const [editingItem, setEditingItem] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editNotes, setEditNotes] = useState("")
  const [editDue, setEditDue] = useState("")
  const [editPriority, setEditPriority] = useState<Priority>("medium")
  const [newSubtaskInputs, setNewSubtaskInputs] = useState<Record<string, string>>({})
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [bulkMode, setBulkMode] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const q = search.trim().toLowerCase()
  const total = list.items.length
  const done = list.items.filter((i) => i.done).length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  const filteredItems = useMemo(() => {
    let items = [...list.items]
    // Filter by search
    if (q) {
      items = items.filter(
        (it) =>
          it.title.toLowerCase().includes(q) ||
          it.notes.toLowerCase().includes(q) ||
          it.subtasks.some((st) => st.title.toLowerCase().includes(q)),
      )
    }
    // Filter by status
    if (filterStatus === "pending") items = items.filter((it) => !it.done)
    if (filterStatus === "done") items = items.filter((it) => it.done)
    // Sort
    if (sort !== "manual") {
      items.sort((a, b) => {
        let cmp = 0
        if (sort === "priority") {
          const p: Record<string, number> = { high: 3, medium: 2, low: 1 }
          cmp = (p[a.priority] ?? 0) - (p[b.priority] ?? 0)
        } else if (sort === "due") {
          cmp = (a.due || "zzz").localeCompare(b.due || "zzz")
        } else if (sort === "alpha") {
          cmp = a.title.localeCompare(b.title)
        }
        return sortDir === "desc" ? -cmp : cmp
      })
    }
    return items
  }, [list.items, q, sort, sortDir, filterStatus])

  const handleAddItem = useCallback(() => {
    const title = newItemTitle.trim()
    if (!title) return
    addChecklistItem(list.id, title, newItemPriority)
    setNewItemTitle("")
    inputRef.current?.focus()
  }, [list.id, newItemTitle, newItemPriority, addChecklistItem])

  const handleRenameList = useCallback(() => {
    const name = listName.trim()
    if (name && name !== list.name) onRename(name)
    setEditingListName(false)
  }, [listName, list.name, onRename])

  const toggleExpand = useCallback((itemId: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }, [])

  const addSubtask = useCallback(
    (itemId: string) => {
      const title = (newSubtaskInputs[itemId] || "").trim()
      if (!title) return
      const item = list.items.find((i) => i.id === itemId)
      if (!item) return
      const newSt: SubTask = {
        id: `st-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title,
        done: false,
      }
      updateChecklistItem(list.id, itemId, { subtasks: [...item.subtasks, newSt] })
      setNewSubtaskInputs((prev) => ({ ...prev, [itemId]: "" }))
    },
    [list.id, list.items, newSubtaskInputs, updateChecklistItem],
  )

  const toggleSubtask = useCallback(
    (itemId: string, subtaskId: string) => {
      const item = list.items.find((i) => i.id === itemId)
      if (!item) return
      updateChecklistItem(list.id, itemId, {
        subtasks: item.subtasks.map((st) => (st.id === subtaskId ? { ...st, done: !st.done } : st)),
      })
    },
    [list.id, list.items, updateChecklistItem],
  )

  const deleteSubtask = useCallback(
    (itemId: string, subtaskId: string) => {
      const item = list.items.find((i) => i.id === itemId)
      if (!item) return
      updateChecklistItem(list.id, itemId, {
        subtasks: item.subtasks.filter((st) => st.id !== subtaskId),
      })
    },
    [list.id, list.items, updateChecklistItem],
  )

  const saveItemEdits = useCallback(
    (itemId: string) => {
      updateChecklistItem(list.id, itemId, {
        title: editTitle.trim() || undefined,
        notes: editNotes,
        due: editDue,
        priority: editPriority,
      })
      setEditingItem(null)
    },
    [list.id, editTitle, editNotes, editDue, editPriority, updateChecklistItem],
  )

  const startEditItem = useCallback(
    (item: ChecklistItem) => {
      setEditingItem(item.id)
      setEditTitle(item.title)
      setEditNotes(item.notes)
      setEditDue(item.due)
      setEditPriority(item.priority)
    },
    [],
  )

  const toggleBulkSelect = useCallback(
    (itemId: string) => {
      setSelectedItems((prev) => {
        const next = new Set(prev)
        if (next.has(itemId)) next.delete(itemId)
        else next.add(itemId)
        return next
      })
    },
    [],
  )

  const selectedCount = selectedItems.size

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <ArrowLeft className="size-5" />
        </button>
        <span className="text-2xl">{list.icon}</span>
        {editingListName ? (
          <input
            autoFocus
            value={listName}
            onChange={(e) => setListName(e.target.value)}
            onBlur={handleRenameList}
            onKeyDown={(e) => e.key === "Enter" && handleRenameList()}
            className="min-w-0 flex-1 bg-transparent text-xl font-bold text-foreground outline-none border-b border-primary"
          />
        ) : (
          <h1
            className="min-w-0 flex-1 cursor-pointer truncate text-xl font-bold text-foreground hover:underline"
            onClick={() => { setEditingListName(true); setListName(list.name) }}
          >
            {list.name}
          </h1>
        )}
        <div className="flex items-center gap-1">
          {bulkMode ? (
            <>
              <span className="mr-2 text-sm text-muted-foreground">{selectedCount} selected</span>
              <button
                type="button"
                onClick={() => { bulkToggleChecklistItems(list.id, [...selectedItems], true); setSelectedItems(new Set()); setBulkMode(false) }}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-success hover:bg-success/10"
              >
                Check all
              </button>
              <button
                type="button"
                onClick={() => { bulkToggleChecklistItems(list.id, [...selectedItems], false); setSelectedItems(new Set()); setBulkMode(false) }}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-secondary"
              >
                Uncheck all
              </button>
              <button
                type="button"
                onClick={() => {
                  bulkToggleChecklistItems(
                    list.id,
                    [...selectedItems],
                    false,
                  )
                  // Delete selected
                  selectedItems.forEach((id) => deleteChecklistItem(list.id, id))
                  setSelectedItems(new Set())
                  setBulkMode(false)
                }}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger/10"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => { setBulkMode(false); setSelectedItems(new Set()) }}
                className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"
              >
                <X className="size-4" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onTogglePin}
                className={cn("rounded-lg p-2 transition-colors", list.pinned ? "text-primary" : "text-muted-foreground hover:bg-secondary")}
                title={list.pinned ? "Unpin" : "Pin to top"}
              >
                <svg className="size-4" viewBox="0 0 24 24" fill={list.pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setBulkMode(true)}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                title="Select items"
              >
                <CheckSquare className="size-4" />
              </button>
              {done > 0 && (
                <button
                  type="button"
                  onClick={() => clearCompletedItems(list.id)}
                  className="rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  Clear done ({done})
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">
            {total === 0 ? "No items" : `${done} of ${total} done`}
          </span>
          <span className="text-sm font-bold tabular-nums text-muted-foreground">{pct}%</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: list.color }}
          />
        </div>
      </div>

      {/* Add item input */}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          value={newItemTitle}
          onChange={(e) => setNewItemTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
          placeholder="Add an item..."
          className="h-10 flex-1 rounded-xl border border-input bg-secondary/50 px-4 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
        />
        <select
          value={newItemPriority}
          onChange={(e) => setNewItemPriority(e.target.value as Priority)}
          className="h-10 rounded-xl border border-input bg-secondary/50 px-3 text-sm text-muted-foreground outline-none"
        >
          <option value="low">Low</option>
          <option value="medium">Med</option>
          <option value="high">High</option>
        </select>
        <button
          type="button"
          onClick={handleAddItem}
          disabled={!newItemTitle.trim()}
          className="flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-50"
        >
          <Plus className="size-4" /> Add
        </button>
      </div>

      {/* Filters + Sort */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-40 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items..."
            className="h-9 w-full rounded-lg border border-input bg-secondary/50 pr-3 pl-9 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>
        <div className="flex gap-1 rounded-lg border border-border bg-card p-0.5">
          {(["all", "pending", "done"] as FilterStatus[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilterStatus(f)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                filterStatus === f ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-lg border border-border bg-card p-0.5">
          {(["manual", "priority", "due", "alpha"] as ItemSort[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                if (sort === s) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
                else { setSort(s); setSortDir("asc") }
              }}
              className={cn(
                "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                sort === s ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s === "manual" ? "Order" : s}
              {sort === s && (sortDir === "asc" ? <SortAsc className="size-3" /> : <SortDesc className="size-3" />)}
            </button>
          ))}
        </div>
      </div>

      {/* Items list */}
      <div className="space-y-2">
        {filteredItems.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">
              {total === 0 ? "No items yet. Add one above." : "No items match your filter."}
            </p>
          </div>
        )}
        {filteredItems.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            listId={list.id}
            expanded={expandedItems.has(item.id)}
            onToggleExpand={() => toggleExpand(item.id)}
            onToggle={() => toggleChecklistItem(list.id, item.id)}
            onDelete={() => deleteChecklistItem(list.id, item.id)}
            onStartEdit={() => startEditItem(item)}
            isEditing={editingItem === item.id}
            editTitle={editTitle}
            setEditTitle={setEditTitle}
            editNotes={editNotes}
            setEditNotes={setEditNotes}
            editDue={editDue}
            setEditDue={setEditDue}
            editPriority={editPriority}
            setEditPriority={setEditPriority}
            onSaveEdits={() => saveItemEdits(item.id)}
            onCancelEdit={() => setEditingItem(null)}
            onAddSubtask={addSubtask}
            onToggleSubtask={toggleSubtask}
            onDeleteSubtask={deleteSubtask}
            subtaskInput={newSubtaskInputs[item.id] || ""}
            setSubtaskInput={(v) => setNewSubtaskInputs((prev) => ({ ...prev, [item.id]: v }))}
            bulkMode={bulkMode}
            selected={selectedItems.has(item.id)}
            onToggleBulk={() => toggleBulkSelect(item.id)}
            onContextMenu={(e) => { e.preventDefault(); setContextMenu({ itemId: item.id, x: e.clientX, y: e.clientY }) }}
          />
        ))}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 min-w-40 rounded-xl border border-border bg-card p-1 shadow-lg"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              type="button"
              onClick={() => {
                const item = list.items.find((i) => i.id === contextMenu.itemId)
                if (item) startEditItem(item)
                setContextMenu(null)
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-secondary"
            >
              <Pencil className="size-3.5" /> Edit
            </button>
            <button
              type="button"
              onClick={() => {
                const item = list.items.find((i) => i.id === contextMenu.itemId)
                if (item) toggleChecklistItem(list.id, item.id)
                setContextMenu(null)
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-secondary"
            >
              <Check className="size-3.5" /> Toggle
            </button>
            <button
              type="button"
              onClick={() => {
                deleteChecklistItem(list.id, contextMenu.itemId)
                setContextMenu(null)
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger hover:bg-danger/10"
            >
              <Trash2 className="size-3.5" /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Item Row ──────────────────────────────────────────────
function ItemRow({
  item,
  listId,
  expanded,
  onToggleExpand,
  onToggle,
  onDelete,
  onStartEdit,
  isEditing,
  editTitle,
  setEditTitle,
  editNotes,
  setEditNotes,
  editDue,
  setEditDue,
  editPriority,
  setEditPriority,
  onSaveEdits,
  onCancelEdit,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  subtaskInput,
  setSubtaskInput,
  bulkMode,
  selected,
  onToggleBulk,
  onContextMenu,
}: {
  item: ChecklistItem
  listId: string
  expanded: boolean
  onToggleExpand: () => void
  onToggle: () => void
  onDelete: () => void
  onStartEdit: () => void
  isEditing: boolean
  editTitle: string
  setEditTitle: (v: string) => void
  editNotes: string
  setEditNotes: (v: string) => void
  editDue: string
  setEditDue: (v: string) => void
  editPriority: Priority
  setEditPriority: (v: Priority) => void
  onSaveEdits: () => void
  onCancelEdit: () => void
  onAddSubtask: (itemId: string) => void
  onToggleSubtask: (itemId: string, subtaskId: string) => void
  onDeleteSubtask: (itemId: string, subtaskId: string) => void
  subtaskInput: string
  setSubtaskInput: (v: string) => void
  bulkMode: boolean
  selected: boolean
  onToggleBulk: () => void
  onContextMenu: (e: React.MouseEvent) => void
}) {
  const subDone = item.subtasks.filter((s) => s.done).length
  const subTotal = item.subtasks.length
  const hasSubtasks = subTotal > 0
  const isOverdue = !item.done && item.due && item.due < new Date().toISOString().slice(0, 10)

  if (isEditing) {
    return (
      <div className="rounded-xl border border-primary bg-card p-4">
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSaveEdits()}
            className="flex-1 rounded-lg border border-input bg-secondary/50 px-3 py-1.5 text-sm outline-none focus:border-ring"
          />
          <select
            value={editPriority}
            onChange={(e) => setEditPriority(e.target.value as Priority)}
            className="rounded-lg border border-input bg-secondary/50 px-2 py-1.5 text-xs"
          >
            <option value="low">Low</option>
            <option value="medium">Med</option>
            <option value="high">High</option>
          </select>
        </div>
        <input
          type="date"
          value={editDue}
          onChange={(e) => setEditDue(e.target.value)}
          className="mt-2 w-full rounded-lg border border-input bg-secondary/50 px-3 py-1.5 text-sm outline-none"
        />
        <textarea
          value={editNotes}
          onChange={(e) => setEditNotes(e.target.value)}
          placeholder="Add notes..."
          rows={2}
          className="mt-2 w-full resize-none rounded-lg border border-input bg-secondary/50 px-3 py-1.5 text-sm outline-none focus:border-ring"
        />
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onCancelEdit} className="rounded-lg px-3 py-1 text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
          <button type="button" onClick={onSaveEdits} className="rounded-lg bg-primary px-3 py-1 text-sm font-medium text-primary-foreground hover:opacity-90">Save</button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "group rounded-xl border border-border bg-card transition-all hover:border-primary/30",
        item.done && "opacity-60",
        selected && "ring-2 ring-primary/40",
      )}
      onContextMenu={onContextMenu}
    >
      {/* Main row */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        {bulkMode ? (
          <button
            type="button"
            onClick={onToggleBulk}
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-muted-foreground/50 text-transparent",
            )}
          >
            {selected && <Check className="size-3" />}
          </button>
        ) : (
          <button
            type="button"
            onClick={onToggle}
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
              item.done
                ? "border-success bg-success text-success-foreground"
                : "border-muted-foreground/50 text-transparent hover:border-primary",
            )}
          >
            {item.done && <Check className="size-3" />}
          </button>
        )}

        {hasSubtasks && (
          <button type="button" onClick={onToggleExpand} className="shrink-0 text-muted-foreground">
            {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={cn("text-sm", item.done && "line-through text-muted-foreground")}>{item.title}</span>
            {item.priority === "high" && <span className="rounded bg-danger/20 px-1.5 py-0.5 text-[10px] font-medium text-danger">High</span>}
            {item.priority === "low" && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Low</span>}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {hasSubtasks && (
              <span className="flex items-center gap-1">
                <CheckSquare className="size-3" />
                {subDone}/{subTotal}
              </span>
            )}
            {item.due && (
              <span className={cn("flex items-center gap-1", isOverdue && "text-danger font-medium")}>
                <Clock className="size-3" />
                {item.due}
              </span>
            )}
            {item.notes && <span className="italic">Notes</span>}
          </div>
        </div>

        {!bulkMode && (
          <button
            type="button"
            onClick={onStartEdit}
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground/50 opacity-0 transition-opacity hover:bg-secondary hover:text-foreground group-hover:opacity-100"
          >
            <Pencil className="size-3.5" />
          </button>
        )}
        {!bulkMode && (
          <button
            type="button"
            onClick={onDelete}
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground/50 opacity-0 transition-opacity hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>

      {/* Notes */}
      {!expanded && item.notes && (
        <div className="px-3 pb-2">
          <p className="text-xs text-muted-foreground line-clamp-1 italic">{item.notes}</p>
        </div>
      )}

      {/* Expanded: subtasks + notes */}
      {expanded && (
        <div className="border-t border-border px-3 py-2.5">
          {item.notes && (
            <p className="mb-2 text-xs text-muted-foreground">{item.notes}</p>
          )}
          {item.subtasks.map((st) => (
            <div key={st.id} className="flex items-center gap-2 py-1">
              <button
                type="button"
                onClick={() => onToggleSubtask(item.id, st.id)}
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
                  st.done
                    ? "border-success bg-success text-success-foreground"
                    : "border-muted-foreground/50 text-transparent hover:border-primary",
                )}
              >
                {st.done && <Check className="size-2.5" />}
              </button>
              <span className={cn("text-xs", st.done && "line-through text-muted-foreground")}>{st.title}</span>
              <button
                type="button"
                onClick={() => onDeleteSubtask(item.id, st.id)}
                className="ml-auto shrink-0 rounded p-0.5 text-muted-foreground/50 opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2 mt-2">
            <input
              value={subtaskInput}
              onChange={(e) => setSubtaskInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onAddSubtask(item.id)}
              placeholder="Add subtask..."
              className="h-7 flex-1 rounded border border-input bg-secondary/50 px-2 text-xs outline-none focus:border-ring"
            />
            <button
              type="button"
              onClick={() => onAddSubtask(item.id)}
              disabled={!subtaskInput.trim()}
              className="rounded bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
