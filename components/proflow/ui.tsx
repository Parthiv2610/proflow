"use client"

import { cn } from "@/lib/utils"

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-5",
        "transition-all duration-200 ease-out",
        "hover:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.12)] hover:-translate-y-0.5",
        "active:scale-[0.99] active:shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  )
}

export function ProgressBar({
  value,
  className,
  tone = "primary",
}: {
  value: number
  className?: string
  tone?: "primary" | "focus" | "success" | "info" | "danger"
}) {
  const tones: Record<string, string> = {
    primary: "bg-primary",
    focus: "bg-focus",
    success: "bg-success",
    info: "bg-info",
    danger: "bg-danger",
  }
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className={cn("h-full rounded-full transition-all duration-700 ease-out")}
        style={{
          width: `${Math.min(100, Math.max(0, value))}%`,
          transition: "width 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)",
          background: tone === "success" ? "linear-gradient(90deg, var(--success), color-mix(in srgb, var(--success) 70%, var(--primary)))"
            : tone === "primary" ? "linear-gradient(90deg, var(--primary), color-mix(in srgb, var(--primary) 70%, var(--info)))"
            : tones[tone],
        }}
      />
    </div>
  )
}

export function CircularProgress({
  value,
  size = 88,
  stroke = 9,
  tone = "var(--primary)",
  children,
}: {
  value: number
  size?: number
  stroke?: number
  tone?: string
  children?: React.ReactNode
}) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700"
          style={{ transition: "stroke-dashoffset 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

const priorityStyles: Record<string, string> = {
  high: "bg-danger/15 text-danger",
  medium: "bg-focus/15 text-focus",
  low: "bg-info/15 text-info",
}

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-medium capitalize", priorityStyles[priority])}>
      {priority}
    </span>
  )
}
