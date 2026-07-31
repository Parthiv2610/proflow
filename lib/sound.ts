"use client"

let audioCtx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  if (!audioCtx) audioCtx = new AC()
  if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {})
  return audioCtx
}

/** Play a short two-tone chime. Safe no-op if audio is unavailable. */
export function playChime() {
  try {
    const ctx = getCtx()
    if (!ctx) return
    const now = ctx.currentTime

    const notes = [
      { freq: 880, start: 0, dur: 0.18 },
      { freq: 1174.66, start: 0.18, dur: 0.28 },
    ]
    for (const n of notes) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.value = n.freq
      gain.gain.setValueAtTime(0.0001, now + n.start)
      gain.gain.exponentialRampToValueAtTime(0.18, now + n.start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.start + n.dur)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now + n.start)
      osc.stop(now + n.start + n.dur + 0.05)
    }
  } catch {
    // audio unavailable — ignore
  }
}
