"use client"

import { isCapacitor } from "./lan-sync"
import { showNotification } from "./notify"

/**
 * Saving note attachments on Android. The Capacitor WebView silently ignores
 * browser-style anchor downloads (Blob / data URLs), so on the APK we hand the
 * base64 data URL to the native Backup plugin, which writes it to Downloads
 * via MediaStore (API 29+) or the system "Save to…" picker (older). Desktop
 * and web keep the plain anchor download — no native bridge there.
 */

/** Human-readable size label for attachment chips and captions. */
export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export type SaveAttachmentResult =
  | { saved: true; path?: string }
  | { saved: false; reason: "unsupported" | "cancelled" | "error" }

/**
 * Save an attachment (stored as a data URL) to the device. Returns
 * {@code unsupported} on desktop/web — callers should fall back to an anchor
 * download there — and {@code cancelled} when the user dismisses the picker.
 */
export async function saveAttachmentNative(
  name: string,
  mime: string,
  dataUrl: string,
): Promise<SaveAttachmentResult> {
  const plugin = (window as any)?.Capacitor?.Plugins?.Backup
  if (!isCapacitor() || !plugin?.saveAttachment) {
    return { saved: false, reason: "unsupported" }
  }
  try {
    const res = await plugin.saveAttachment({ fileName: name, mimeType: mime, base64: dataUrl })
    return { saved: true, path: res?.path }
  } catch (err) {
    const msg = String((err as any)?.message || "")
    // The system picker throws when the user backs out — not an error.
    if (/cancell?ed/i.test(msg) || (err as any)?.name === "AbortError") {
      return { saved: false, reason: "cancelled" }
    }
    return { saved: false, reason: "error" }
  }
}

/**
 * Save an attachment and confirm the outcome to the user. Android writes it to
 * Downloads natively (or opens the picker); a failure surfaces a hint to try
 * the desktop app. Cancels and unsupported platforms stay quiet — desktop/web
 * callers keep the plain anchor download.
 */
export async function saveAttachmentAndNotify(a: { name: string; mime: string; dataUrl: string }) {
  const res = await saveAttachmentNative(a.name, a.mime, a.dataUrl)
  if (res.saved) {
    showNotification("ProFlow", `💾 Saved "${a.name}" to Downloads`)
  } else if (res.reason === "error") {
    showNotification("ProFlow", `Couldn't save "${a.name}" — try the desktop app.`)
  }
}
