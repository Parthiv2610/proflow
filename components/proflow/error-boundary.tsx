"use client"

import React from "react"

type Props = { children: React.ReactNode }
type State = { error: Error | null }

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to console for debugging
    console.error("[ProFlow Error]", error, info.componentStack)
    // Store in localStorage so it persists across reloads
    try {
      localStorage.setItem(
        "proflow-last-error",
        JSON.stringify({
          message: error.message,
          stack: error.stack?.slice(0, 500),
          componentStack: info.componentStack?.slice(0, 500),
          time: new Date().toISOString(),
        })
      )
    } catch {}
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-svh flex-col items-center justify-center bg-background p-6 text-foreground">
          <div className="w-full max-w-lg rounded-2xl border border-destructive/30 bg-card p-6 shadow-2xl">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-destructive/15 text-destructive text-lg">⚠️</span>
              <h2 className="text-lg font-bold">Something went wrong</h2>
            </div>
            <div className="mb-4 rounded-xl bg-destructive/5 border border-destructive/20 p-3">
              <p className="text-sm font-mono text-destructive break-all">{this.state.error.message}</p>
            </div>
            {this.state.error.stack && (
              <details className="mb-4">
                <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Show stack trace</summary>
                <pre className="mt-2 max-h-48 overflow-auto rounded-xl bg-muted/50 p-3 text-[10px] font-mono text-muted-foreground whitespace-pre-wrap break-all">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
            <p className="mb-4 text-xs text-muted-foreground">
              Your data is safe — it&apos;s backed up automatically. Reload the app and your data will be restored.
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ error: null })
                window.location.reload()
              }}
              className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Reload app
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
