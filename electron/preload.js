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

  // LAN Sync
  lanGetStatus: () => ipcRenderer.invoke("lan:get-status"),
  lanSetEnabled: (enabled) => ipcRenderer.invoke("lan:set-enabled", enabled),
  lanPush: (snapshot) => ipcRenderer.invoke("lan:push", snapshot),
  lanRegenPasscode: () => ipcRenderer.invoke("lan:regen-passcode"),
  lanSelfTest: () => ipcRenderer.invoke("lan:self-test"),
  onLanRemote: (callback) => {
    const listener = (_event, data) => callback(data)
    ipcRenderer.on("lan:remote", listener)
    return () => ipcRenderer.removeListener("lan:remote", listener)
  },
})
