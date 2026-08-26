"use client"

import { useCallback, useEffect, useState } from "react"
import { isCapacitor } from "./lan-sync"
import { autoBackupBeforeUpdate } from "./auto-backup"

/** Compare semver strings; true when a > b (handles the "v" prefix too). */
export function isNewerVersion(a: string, b: string) {
  const pa = String(a).replace(/^v/, "").split(".").map(Number)
  const pb = String(b).replace(/^v/, "").split(".").map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0
    const nb = pb[i] || 0
    if (na > nb) return true
    if (na < nb) return false
  }
  return false
}

/**
 * electron-updater's releaseNotes is a string OR an array of {version, note}
 * objects (GitHub provider) — normalize to a plain string for rendering.
 */
export function releaseNotesToText(notes: unknown): string | undefined {
  if (typeof notes === "string" && notes.trim()) return notes
  if (Array.isArray(notes)) {
    const parts = notes
      .map((n: any) => (n && typeof n.note === "string" ? n.note : ""))
      .filter(Boolean)
    return parts.length ? parts.join(" · ") : undefined
  }
  return undefined
}

export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "downloaded"
  | "uptodate"
  | "error"

export type UpdateInfo = {
  latestVersion?: string
  downloadUrl?: string
  releaseNotes?: string
}

const GITHUB_LATEST = "https://api.github.com/repos/Parthiv2610/proflow/releases/latest"
const GITHUB_RELEASES = "https://github.com/Parthiv2610/proflow/releases/latest"

/**
 * Shared update state machine for desktop (electron-updater IPC) and the
 * Android APK (GitHub Releases API + native Updater plugin). Both the Settings
 * card and the global UpdateBanner use this so the two never drift apart.
 */
export function useUpdate() {
  const isElectron = typeof window !== "undefined" && !!(window as any).electronAPI?.isElectron
  const isCap = isCapacitor()

  const [appVersion, setAppVersion] = useState("1.0.0")
  const [status, setStatus] = useState<UpdateStatus>("idle")
  const [info, setInfo] = useState<UpdateInfo | null>(null)
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState("")

  const applyStatus = useCallback((s: any) => {
    if (!s) return
    if (s.status === "checking") setStatus("checking")
    else if (s.status === "available") {
      setInfo({ latestVersion: s.version, releaseNotes: releaseNotesToText(s.releaseNotes) })
      setStatus("available")
    } else if (s.status === "downloading") {
      setStatus("downloading")
      setProgress(s.percent ?? 0)
    } else if (s.status === "downloaded") setStatus("downloaded")
    else if (s.status === "uptodate" || s.status === "dev") setStatus("uptodate")
    else if (s.status === "error") {
      setErrorMsg(s.message || "")
      setStatus("error")
    }
  }, [])

  // Electron: read the installed version + subscribe to live auto-updater
  // events, then pick up the launch-time auto-check result (it may have
  // finished before this view mounted). The eventSeen guard prevents a stale
  // cached snapshot from overwriting fresher progress events.
  useEffect(() => {
    if (!isElectron) return
    const api = (window as any).electronAPI
    api
      ?.getAppVersion()
      .then((v: string) => v && setAppVersion(v))
      .catch(() => {})
    let eventSeen = false
    const unsub = api?.onUpdateStatus?.((s: any) => {
      eventSeen = true
      applyStatus(s)
    })
    api
      ?.getUpdateStatus?.()
      .then((s: any) => {
        if (!eventSeen) applyStatus(s)
      })
      .catch(() => {})
    return unsub
  }, [isElectron, applyStatus])

  // Android APK: read the installed version from the native side once.
  useEffect(() => {
    if (!isCap) return
    ;(async () => {
      try {
        const installed = await (window as any).Capacitor?.Plugins?.Updater?.getAppInfo?.()
        if (installed?.versionName) setAppVersion(installed.versionName)
      } catch {}
    })()
  }, [isCap])

  const check = useCallback(async () => {
    setStatus("checking")

    // Android APK: query the GitHub Releases API for the newest APK asset.
    if (isCap) {
      try {
        // Resolve the installed version from the native side HERE (not from
        // state) so an auto-check on app open can't race getAppInfo and compare
        // against the default "1.0.0" — which would falsely report an update.
        let installed = appVersion
        try {
          const installedInfo = await (window as any).Capacitor?.Plugins?.Updater?.getAppInfo?.()
          if (installedInfo?.versionName) {
            installed = installedInfo.versionName
            setAppVersion(installed)
          }
        } catch {}

        const res = await fetch(GITHUB_LATEST, { cache: "no-store" })
        if (!res.ok) throw new Error("GitHub unreachable")
        const rel = await res.json()
        const tag = String(rel.tag_name || "").replace(/^v/, "")
        const apk = (rel.assets || []).find((a: any) => a.name?.endsWith(".apk"))
        if (isNewerVersion(tag, installed) && apk?.browser_download_url) {
          setInfo({
            latestVersion: tag,
            downloadUrl: apk.browser_download_url,
            releaseNotes: rel.body ? String(rel.body).slice(0, 300) : undefined,
          })
          setStatus("available")
        } else {
          setStatus("uptodate")
        }
      } catch {
        setErrorMsg("Could not reach GitHub. Check your internet connection.")
        setStatus("error")
      }
      return
    }

    const api = (window as any).electronAPI
    if (!api?.updateCheck) {
      setErrorMsg("")
      setStatus("error")
      return
    }
    await api.updateCheck()
  }, [isCap, appVersion])

  const download = useCallback(async () => {
    if (isCap) {
      if (!info?.downloadUrl) return
      const updater = (window as any).Capacitor?.Plugins?.Updater

      // Old builds never registered the native Updater plugin (fixed in
      // v2.1.28), so calling installUpdate would silently do nothing. Don't
      // fake success — say so plainly and hand the user the release page.
      if (!updater?.installUpdate) {
        setErrorMsg(
          "This build's updater is outdated and can't install updates in place. " +
            "Download app-release.apk from github.com/Parthiv2610/proflow/releases/latest and open it to update.",
        )
        setStatus("error")
        try {
          await updater?.openUrl?.({ url: GITHUB_RELEASES })
        } catch {}
        return
      }

      setStatus("downloading")
      try {
        // Auto-save backup before updating so data survives reinstall
        await autoBackupBeforeUpdate();
        await updater.installUpdate({ url: info.downloadUrl })
        setStatus("downloaded")
      } catch (err) {
        const msg = String((err as any)?.message || "")
        // Match the plugin's exact rejection code only — a generic message
        // containing "blocked" shouldn't trigger unknown-sources guidance.
        const blocked = /unknown-sources/i.test(msg)
        setErrorMsg(
          blocked
            ? "Installing apps from unknown sources is blocked for ProFlow. " +
                "Allow it in Settings → Apps → ProFlow → Install unknown apps, then update again."
            : msg || "The update could not be installed. Try again.",
        )
        setStatus("error")
        // Even when sideloading is blocked, the release page download is a
        // workaround — the browser can save the APK, then open it to install.
        if (blocked) {
          try {
            await updater.openUrl?.({ url: GITHUB_RELEASES })
          } catch {}
        }
      }
      return
    }
    const api = (window as any).electronAPI
    if (api?.updateDownload) await api.updateDownload()
  }, [isCap, info])

  const install = useCallback(async () => {
    // Auto-save backup before updating so data survives reinstall
    await autoBackupBeforeUpdate();
    const api = (window as any).electronAPI
    if (api?.updateInstall) await api.updateInstall()
  }, [])

  return {
    isElectron,
    isCap,
    appVersion,
    status,
    info,
    progress,
    errorMsg,
    check,
    download,
    install,
  }
}
