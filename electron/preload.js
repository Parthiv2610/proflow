const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  isElectron: true,
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  updateCheck: () => ipcRenderer.invoke("update:check"),
  updateDownload: () => ipcRenderer.invoke("update:download"),
  updateInstall: () => ipcRenderer.invoke("update:install"),
  getUpdateStatus: () => ipcRenderer.invoke("update:get-status"),
  onUpdateStatus: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on("update:status", handler);
    return () => ipcRenderer.removeListener("update:status", handler);
  },
  saveBackup: (p) => ipcRenderer.invoke("backup:save", p),
  autoSaveBackup: (p) => ipcRenderer.invoke("backup:autoSave", p),
  showCrashLog: () => ipcRenderer.invoke("show-crash-log"),
  getCrashLogPath: () => ipcRenderer.invoke("get-crash-log-path"),
  startLanSync: (opts) => ipcRenderer.invoke("lan-sync:start", opts),
  stopLanSync: () => ipcRenderer.invoke("lan-sync:stop"),
});
