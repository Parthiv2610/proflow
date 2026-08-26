"use client"

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { GripVertical } from "lucide-react"

type DragSortContext = {
  activeId: string | null
  overId: string | null
  onDragStart: (id: string) => void
  onDragOver: (id: string) => void
  onDragEnd: () => void
}

const Ctx = createContext<DragSortContext | null>(null)

function useDragSort() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useDragSort must be used within DragSortContainer")
  return ctx
}

export function DragSortContainer({
  ids,
  onReorder,
  children,
  className,
}: {
  ids: string[]
  onReorder: (ids: string[]) => void
  children: ReactNode
  className?: string
}) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const dragIndexRef = useRef<number>(-1)
  const overIdRef = useRef<string | null>(null)

  const onDragStart = useCallback(
    (id: string) => {
      dragIndexRef.current = ids.indexOf(id)
      overIdRef.current = id
      setActiveId(id)
      setOverId(id)
    },
    [ids],
  )

  const onDragOver = useCallback((id: string) => {
    overIdRef.current = id
    setOverId(id)
  }, [])

  const onDragEnd = useCallback(() => {
    const from = dragIndexRef.current
    const to = overIdRef.current ? ids.indexOf(overIdRef.current) : -1
    if (from >= 0 && to >= 0 && from !== to) {
      const next = [...ids]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      onReorder(next)
    }
    setActiveId(null)
    setOverId(null)
    overIdRef.current = null
    dragIndexRef.current = -1
  }, [ids, onReorder])

  return (
    <Ctx.Provider value={{ activeId, overId, onDragStart, onDragOver, onDragEnd }}>
      <div className={cn("flex flex-col", className)}>{children}</div>
    </Ctx.Provider>
  )
}

export function DragSortItem({
  id,
  children,
  className,
}: {
  id: string
  children: ReactNode
  className?: string
}) {
  const { activeId, overId, onDragStart, onDragOver, onDragEnd } = useDragSort()
  const isDragging = activeId === id
  const isOver = overId === id && activeId !== id

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move"
        e.dataTransfer.setData("text/plain", id)
        onDragStart(id)
      }}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = "move"
        onDragOver(id)
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "transition-all duration-150 relative",
        isDragging && "opacity-40",
        className,
      )}
      style={{
        ...(isOver ? { boxShadow: "0 -2px 0 0 var(--primary)" } : {}),
      }}
    >
      {children}
    </div>
  )
}

export function DragHandle({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex cursor-grab items-center justify-center text-muted-foreground opacity-0 transition-all hover:text-foreground group-hover:opacity-100",
        "active:cursor-grabbing",
        className,
      )}
      onMouseDown={(e) => e.stopPropagation()}
      aria-label="Drag to reorder"
    >
      <GripVertical className="size-3.5" />
    </span>
  )
}
