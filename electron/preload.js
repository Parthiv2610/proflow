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
  // Floating timer window
  timerShow: () => ipcRenderer.invoke("timer:show"),
  timerHide: () => ipcRenderer.invoke("timer:hide"),
  timerUpdate: (data) => ipcRenderer.invoke("timer:update", data),
  onTimerToggle: (cb) => { ipcRenderer.on("timer:toggle", cb); return () => ipcRenderer.removeListener("timer:toggle", cb); },
  onTimerSkip: (cb) => { ipcRenderer.on("timer:skip", cb); return () => ipcRenderer.removeListener("timer:skip", cb); },
  onTimerToggleAutoBreak: (cb) => { ipcRenderer.on("timer:toggleAutoBreak", cb); return () => ipcRenderer.removeListener("timer:toggleAutoBreak", cb); },
  // Rolling backup (survives localStorage clears)
  rollingSave: (data) => ipcRenderer.invoke("backup:rollingSave", data),
  rollingLoad: () => ipcRenderer.invoke("backup:loadRolling"),
  // LAN sync: receive pushed data from server
  onLanPushed: (cb) => { const handler = (_e, data) => cb(data); ipcRenderer.on("lan-sync:pushed", handler); return () => ipcRenderer.removeListener("lan-sync:pushed", handler); },
  // LAN sync: server asks renderer for fresh data
  lanGetData: () => ipcRenderer.invoke("lan-sync:getData"),
  lanSetDataHandler: (cb) => { const handler = (_e, opts) => cb(opts); ipcRenderer.on("lan-sync:wantData", handler); return () => ipcRenderer.removeListener("lan-sync:wantData", handler); },
});
