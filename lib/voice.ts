"use client"

import { isCapacitor } from "./lan-sync"

/**
 * Voice note recordings. On Android a native plugin (VoiceNotesPlugin) drives
 * MediaRecorder — the WebView's getUserMedia/MediaRecorder support is flaky and
 * permission handling is unreliable there. On desktop/web we use the browser
 * MediaRecorder API, which works in Electron (Chromium) and desktop Chrome.
 * Both return a base64 data URL so recordings slot into the existing attachment
 * model (stored in localStorage, capped like other attachments).
 */

export const MAX_VOICE_SECONDS = 60

export type VoiceRecording = {
  dataUrl: string
  mime: string
  durationMs: number
  size: number
}

/** "mm:ss" (or "m:ss" past a minute) from a duration in ms. */
export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

export function voiceSupported(): boolean {
  if (isCapacitor()) {
    return !!(window as any)?.Capacitor?.Plugins?.VoiceNotes?.start
  }
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined"
  )
}

let recorder: MediaRecorder | null = null
let chunks: Blob[] = []
let startedAt = 0

export async function startVoiceRecording(): Promise<void> {
  if (isCapacitor()) {
    const p = (window as any)?.Capacitor?.Plugins?.VoiceNotes
    if (!p?.start) throw new Error("Voice recording is not available on this device")
    await p.requestPermission?.()
    await p.start()
    return
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  chunks = []
  recorder = new MediaRecorder(stream)
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data)
  }
  recorder.start()
  startedAt = Date.now()
}

export async function stopVoiceRecording(): Promise<VoiceRecording | null> {
  if (isCapacitor()) {
    const p = (window as any)?.Capacitor?.Plugins?.VoiceNotes
    if (!p?.stop) return null
    const res = await p.stop()
    if (!res?.dataUrl) return null
    return {
      dataUrl: res.dataUrl,
      mime: res.mime || "audio/mp4",
      durationMs: res.durationMs || 0,
      size: res.size || 0,
    }
  }
  if (!recorder) return null
  const mime = recorder.mimeType || "audio/webm"
  return new Promise((resolve) => {
    recorder!.onstop = () => {
      const blob = new Blob(chunks, { type: mime })
      const reader = new FileReader()
      reader.onload = () => {
        resolve({
          dataUrl: reader.result as string,
          mime,
          durationMs: Date.now() - startedAt,
          size: blob.size,
        })
      }
      reader.readAsDataURL(blob)
      recorder!.stream.getTracks().forEach((t) => t.stop())
      recorder = null
      chunks = []
    }
    recorder!.stop()
  })
}

/** Abort a recording without keeping it. */
export async function cancelVoiceRecording(): Promise<void> {
  if (isCapacitor()) {
    // Native side: stop and discard — the plugin deletes its temp file.
    try {
      await (window as any)?.Capacitor?.Plugins?.VoiceNotes?.stop?.()
    } catch {
      // no active recording — fine
    }
    return
  }
  if (recorder) {
    recorder.stream.getTracks().forEach((t) => t.stop())
    recorder = null
    chunks = []
  }
}
