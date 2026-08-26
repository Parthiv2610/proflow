import { isCapacitor } from "./lan-sync";

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
  } catch {}
  return JSON.stringify(
    { format: "proflow-backup", version: 2, exportedAt: new Date().toISOString(), data },
    null,
    2,
  );
}

export async function autoBackupBeforeUpdate(): Promise<string | null> {
  try {
    const content = collectBackupData();
    if (!content || content === "{}") return null;
    if (isCapacitor()) {
      const backup = (window as any).Capacitor?.Plugins?.Backup;
      if (backup?.saveBackup) {
        const fileName = `proflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
        const res = await backup.saveBackup({ fileName, content });
        return res?.path || null;
      }
      return null;
    }
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

export function hasStoredData(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("proflow-")) {
        const raw = localStorage.getItem(k);
        if (raw && raw !== "[]" && raw !== "{}" && raw !== '""' && raw !== "0" && raw !== "false" && raw !== "true") {
          return true;
        }
      }
    }
  } catch {}
  return false;
}
