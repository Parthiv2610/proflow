"use client"

// Tiny canvas confetti — called imperatively (celebrate()) when the user
// completes something. No dependencies, self-cleaning, pointer-events-none so
// it never blocks the app.

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  w: number
  h: number
  rot: number
  vr: number
  color: string
}

const COLORS = ["#a78bfa", "#f472b6", "#34d399", "#fbbf24", "#60a5fa", "#f87171", "#facc15"]

let activeCanvas: HTMLCanvasElement | null = null
let activeRaf = 0

/**
 * Fire a confetti burst. `big` = more particles (level-ups, finished focus
 * sessions); default is a small cheer for a single completion.
 */
export function celebrate(opts?: { big?: boolean }) {
  if (typeof window === "undefined" || typeof document === "undefined") return

  // Replace any in-flight burst so rapid completions don't stack canvases.
  if (activeCanvas) {
    cancelAnimationFrame(activeRaf)
    activeCanvas.remove()
    activeCanvas = null
  }

  const canvas = document.createElement("canvas")
  canvas.style.cssText =
    "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:9999;"
  canvas.width = window.innerWidth * window.devicePixelRatio
  canvas.height = window.innerHeight * window.devicePixelRatio
  document.body.appendChild(canvas)
  activeCanvas = canvas

  const ctx = canvas.getContext("2d")
  if (!ctx) {
    canvas.remove()
    activeCanvas = null
    return
  }
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

  const W = window.innerWidth
  const H = window.innerHeight
  const count = opts?.big ? 200 : 90
  const duration = opts?.big ? 3200 : 2200
  const startX = W / 2
  const startY = H * 0.28

  const parts: Particle[] = Array.from({ length: count }, () => {
    const angle = Math.random() * Math.PI * 2
    const speed = 5 + Math.random() * 9
    return {
      x: startX + (Math.random() - 0.5) * 60,
      y: startY + (Math.random() - 0.5) * 40,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4,
      w: 5 + Math.random() * 6,
      h: 7 + Math.random() * 8,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.35,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }
  })

  const startedAt = performance.now()

  const tick = (now: number) => {
    const elapsed = now - startedAt
    const t = Math.min(elapsed / duration, 1)
    ctx.clearRect(0, 0, W, H)

    for (const p of parts) {
      p.vy += 0.22 // gravity
      p.x += p.vx
      p.y += p.vy
      p.rot += p.vr
      const alpha = Math.max(1 - t, 0)
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
      ctx.restore()
    }

    if (t < 1) {
      activeRaf = requestAnimationFrame(tick)
    } else {
      canvas.remove()
      activeCanvas = null
    }
  }

  activeRaf = requestAnimationFrame(tick)
}
