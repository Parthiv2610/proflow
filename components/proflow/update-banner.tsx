"use client"

import { useEffect, useState } from "react"
import { ArrowDownToLine, Loader2, RefreshCw, Sparkles, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useUpdate } from "@/lib/use-update"

/**
 * Global update prompt — appears above the content on ANY view when a newer
 * build is available, so the user never needs to hunt through Settings.
 * Desktop: electron-updater handles download + silent install over the current
 * version (data kept). Android: the system installer takes over (same signature,
 * data kept). Dismissible; reappears next launch until updated.
 */
export function UpdateBanner() {
  const { isElectron, isCap, status, info, progress, errorMsg, check, download, install } =
    useUpdate()
  const [dismissed, setDismissed] = useState(false)

  // Desktop auto-checks in the main process at launch; the Android APK has no
  // equivalent, so check once when the app opens so the prompt appears on its
  // own — "upgrade option whenever the developer pushes new code".
  useEffect(() => {
    if (isCap) check()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCap])

  const show =
    !dismissed &&
    (isElectron || isCap) &&
    (status === "available" ||
      status === "downloading" ||
      status === "downloaded" ||
      status === "error")

  if (!show) return null

  const busy = status === "downloading"

  return (
    <div className="pointer-events-none fixed top-16 left-1/2 z-40 w-full max-w-md -translate-x-1/2 px-4">
      <div
        className={cn(
          "pointer-events-auto flex items-center gap-3 rounded-2xl border border-primary/30 bg-card/95 p-3 shadow-xl shadow-black/20 backdrop-blur-xl",
          "animate-in fade-in slide-in-from-top-2 duration-300",
        )}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          {status === "downloaded" ? (
            <RefreshCw className="size-4" />
          ) : status === "downloading" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          {status === "downloaded" ? (
            <>
              <p className="text-sm font-semibold text-foreground">
                Update v{info?.latestVersion} ready
              </p>
              <p className="text-xs text-muted-foreground">
                {isCap
                  ? "The system installer is open — tap Install to finish."
                  : "Restart to finish installing. Your data stays."}
              </p>
            </>
          ) : status === "downloading" ? (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-foreground">Downloading update…</span>
                <span className="text-xs font-medium tabular-nums text-muted-foreground">
                  {progress}%
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                />
              </div>
            </>
          ) : status === "error" ? (
            <>
              <p className="text-sm font-semibold text-foreground">Couldn&apos;t update</p>
              <p className="text-xs text-muted-foreground">
                {errorMsg || "Something went wrong — try again."}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-foreground">
                ProFlow v{info?.latestVersion} is available
              </p>
              <p className="text-xs text-muted-foreground">
                Installs over the current version — no reinstall, data kept.
              </p>
            </>
          )}
        </div>

        {status === "downloaded" ? (
          isElectron && (
            <button
              type="button"
              onClick={install}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <RefreshCw className="size-3.5" />
              Restart &amp; Update
            </button>
          )
        ) : status === "error" ? (
          <button
            type="button"
            onClick={check}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <RefreshCw className="size-3.5" />
            Try again
          </button>
        ) : (
          <button
            type="button"
            onClick={download}
            disabled={busy}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            <ArrowDownToLine className="size-3.5" />
            Update
          </button>
        )}

        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss update prompt"
          className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}
