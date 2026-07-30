"use client"

import { useCallback, useEffect, useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Command,
  ListTodo,
  LayoutDashboard,
  Plus,
  Settings,
  Sparkles,
  Timer,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useStore } from "./store"

type Step = {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}

const steps: Step[] = [
  {
    icon: Sparkles,
    title: "Welcome to ProFlow",
    description:
      "Your all-in-one productivity workspace. Manage tasks, track habits, focus with Pomodoro timers, and organise your calendar — all in one place.",
  },
  {
    icon: LayoutDashboard,
    title: "Dashboard — Your Command Centre",
    description:
      "See your daily progress at a glance: completion rate, habit streaks, deep-work hours, overdue tasks, goal progress, and upcoming events. The Focus Hours chart shows your last 7 days of deep work.",
  },
  {
    icon: ListTodo,
    title: "Tasks & Projects",
    description:
      "Add tasks with priorities, due dates, and categories. Toggle status between todo, in-progress, and done. Drag to reorder, or delete tasks you no longer need.",
  },
  {
    icon: Plus,
    title: "Quick Capture",
    description:
      "Hit the Capture button in the topbar to quickly add a task without leaving your current view. Set the title, project, category, priority, and due date in one go.",
  },
  {
    icon: Timer,
    title: "Focus Timer",
    description:
      "Use the Pomodoro timer in the topbar for deep work sessions. Start, pause, or skip between focus and break intervals. Track your total focus hours on the Dashboard.",
  },
  {
    icon: Command,
    title: "Command Palette",
    description:
      "Press ⌘P (or Ctrl+P on Windows) to open the command palette. Search views, create tasks, or toggle focus mode — all from your keyboard.",
  },
  {
    icon: Bell,
    title: "Stay Notified",
    description:
      "The notification bell in the topbar keeps you updated on overdue tasks, upcoming events, and habit reminders. Mark individual notifications as read, or clear them all at once.",
  },
  {
    icon: Settings,
    title: "Personalise Everything",
    description:
      "Visit Settings to change your name, upload a profile picture, pick an accent colour, and toggle preferences like desktop notifications, focus reminders, and more.",
  },
]

export function WelcomeTour() {
  const { showTour, dismissTour } = useStore()
  const [step, setStep] = useState(0)
  const total = steps.length
  const current = steps[step]

  const goNext = useCallback(() => {
    if (step < total - 1) setStep((s) => s + 1)
    else dismissTour()
  }, [step, total, dismissTour])

  const goBack = useCallback(() => {
    if (step > 0) setStep((s) => s - 1)
  }, [step])

  // Keyboard navigation
  useEffect(() => {
    if (!showTour) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismissTour()
      if (e.key === "ArrowRight" || e.key === "Enter") goNext()
      if (e.key === "ArrowLeft") goBack()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [showTour, goNext, goBack, dismissTour])

  // Lock body scroll while tour is active
  useEffect(() => {
    if (!showTour) return
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [showTour])

  if (!showTour) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      {/* Card */}
      <div
        className={cn(
          "relative w-full max-w-lg overflow-hidden rounded-2xl border border-border",
          "bg-gradient-to-b from-card to-sidebar text-foreground shadow-2xl",
          "animate-in fade-in zoom-in-95 duration-200",
        )}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={dismissTour}
          className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>

        {/* Step indicator dots */}
        <div className="flex justify-center gap-1.5 pt-6">
          {steps.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === step
                  ? "w-6 bg-primary"
                  : i < step
                    ? "w-1.5 bg-primary/40"
                    : "w-1.5 bg-muted-foreground/20",
              )}
            />
          ))}
        </div>

        {/* Content */}
        <div
          key={step}
          className="flex flex-col items-center px-8 pb-2 pt-6 text-center animate-in fade-in duration-200"
        >
          {/* Icon */}
          <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-lg shadow-primary/10">
            <current.icon className="size-7" />
          </div>

          {/* Title */}
          <h2 className="mt-4 text-xl font-bold tracking-tight">{current.title}</h2>

          {/* Description */}
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
            {current.description}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={dismissTour}
            className="text-xs text-muted-foreground"
          >
            Skip tour
          </Button>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button type="button" variant="ghost" size="icon" onClick={goBack} className="size-8">
                <ArrowLeft className="size-4" />
              </Button>
            )}
            <Button
              type="button"
              size="lg"
              onClick={goNext}
              className="gap-1.5 px-5"
            >
              {step < total - 1 ? (
                <>
                  Next
                  <ArrowRight className="size-3.5" />
                </>
              ) : (
                <>
                  <Sparkles className="size-3.5" />
                  Get started
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Step counter */}
        <p className="pb-4 text-center text-[11px] text-muted-foreground/60">
          {step + 1} of {total}
        </p>
      </div>
    </div>
  )
}
