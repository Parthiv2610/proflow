"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
  /** Taller/larger dialog (used by the note editor). */
  wide?: boolean
}) {
  // Height of the screen covered by the on-screen keyboard (mobile browsers).
  // The layout viewport doesn't shrink for the keyboard — only the visual
  // viewport does — so a `fixed inset-0` overlay leaves its lower fields
  // hidden behind the keys. Padding the overlay by the covered height keeps
  // every input reachable (the overlay scrolls). On desktop and in the
  // Capacitor app (adjustResize already shrinks the viewport) this is 0.
  const [kbInset, setKbInset] = useState(0)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"

    const vv = window.visualViewport
    const update = () => {
      if (!vv) return
      setKbInset(Math.max(0, (window.innerHeight || 0) - vv.height))
    }
    update()
    vv?.addEventListener("resize", update)
    vv?.addEventListener("scroll", update)
    window.addEventListener("resize", update)
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
      vv?.removeEventListener("resize", update)
      vv?.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-24 sm:pt-32"
      style={kbInset > 0 ? { paddingBottom: kbInset + 16 } : undefined}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative w-full rounded-2xl border border-border bg-card p-5 shadow-2xl ${
          wide ? "max-w-2xl" : "max-w-lg"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-card-foreground">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}
