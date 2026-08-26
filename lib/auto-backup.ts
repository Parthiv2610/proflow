import { isCapacitor } from "./lan-sync";

/**
 * Collect every proflow-* localStorage key into a structured backup JSON.
 * Used before updates to auto-save so data isn't lost on reinstall.
 */
export function collectBackupData(): string {
  const data: Record<string, unknown> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("proflow-")) {
        const raw = localStorage.getItem(k);
        if (raw !== null) {
          try {
            data[k.slice("proflow-".length)] = JSON.parse(raw);
          } catch {
            data[k.slice("proflow-".length)] = raw;
          }
        }
      }
    }
  } catch {
    // localStorage unavailable — return empty backup
  }
  return JSON.stringify(
    { format: "proflow-backup", version: 2, exportedAt: new Date().toISOString(), data },
    null,
    2,
  );
}

/**
 * Auto-save a backup to a known location before an update is installed.
 * - Android: uses the Backup plugin to write to Downloads.
 * - Desktop: uses the electron backup:autoSave IPC to write to Downloads.
 * - Browser: silently saves via anchor download (best-effort).
 */
export async function autoBackupBeforeUpdate(): Promise<string | null> {
  try {
    const content = collectBackupData();
    if (!content || content === "{}") return null; // nothing to back up

    if (isCapacitor()) {
      const backup = (window as any).Capacitor?.Plugins?.Backup;
      if (backup?.saveBackup) {
        const fileName = `proflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
        const res = await backup.saveBackup({ fileName, content });
        return res?.path || null;
      }
      // Fallback: Web Share API
      const nav = navigator as any;
      const file = new File([content], `proflow-backup-${new Date().toISOString().slice(0, 10)}.json`, {
        type: "application/json",
      });
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: "ProFlow backup" });
        return "shared";
      }
      return null;
    }

    // Electron
    const api = (window as any).electronAPI;
    if (api?.autoSaveBackup) {
      const res = await api.autoSaveBackup({ content });
      if (res?.error) return null;
      return res?.path || null;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Check if localStorage has any meaningful proflow data.
 * Returns false if the store is empty (fresh install or data wiped).
 */
export function hasStoredData(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("proflow-")) {
        const raw = localStorage.getItem(k);
        // Check for non-empty, non-trivial data
        if (raw && raw !== "[]" && raw !== "{}" && raw !== '""' && raw !== "0" && raw !== "false" && raw !== "true" && raw !== "[]") {
          return true;
        }
      }
    }
  } catch {
    // assume data exists if storage is unavailable
  }
  return false;
}
