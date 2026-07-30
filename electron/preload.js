const { contextBridge, ipcRenderer } = require("electron")

// Expose a minimal, safe API to the renderer process
contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  isElectron: true,

  // Auto-update
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  checkForUpdate: () => ipcRenderer.invoke("check-for-update"),
  downloadUpdate: (url) => ipcRenderer.invoke("download-update", url),
})
