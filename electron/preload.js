const { contextBridge, ipcRenderer } = require("electron")

// Expose a minimal, safe API to the renderer process
contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  isElectron: true,

  // Auto-update (in-place, electron-updater)
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  updateCheck: () => ipcRenderer.invoke("update:check"),
  updateDownload: () => ipcRenderer.invoke("update:download"),
  updateInstall: () => ipcRenderer.invoke("update:install"),
  getUpdateStatus: () => ipcRenderer.invoke("update:get-status"),
  onUpdateStatus: (callback) => {
    const listener = (_event, data) => callback(data)
    ipcRenderer.on("update:status", listener)
    return () => ipcRenderer.removeListener("update:status", listener)
  },

  // Data backup export — native save dialog
  saveBackup: (payload) => ipcRenderer.invoke("backup:save", payload),
})
