const { app, BrowserWindow, Menu, ipcMain } = require("electron")
const path = require("path")
const fs = require("fs")
const { autoUpdater } = require("electron-updater")

const isDev = !app.isPackaged

// Allow the timer-end chime to play without requiring a user gesture.
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required")

// ---------------------------------------------------------------------------
// In-place auto-update (electron-updater — GitHub Releases feed)
// ---------------------------------------------------------------------------

/** Read the current app version from package.json */
function getAppVersion() {
  const pkgPath = path.join(__dirname, "..", "package.json")
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"))
    return pkg.version || "0.0.0"
  } catch {
    return "0.0.0"
  }
}

let updateState = { status: "idle" }

/** Forward an auto-updater event to the renderer (Settings → About & Updates). */
function sendUpdateStatus(payload) {
  updateState = { ...updateState, ...payload }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update:status", updateState)
  }
}

function wireAutoUpdater() {
  // Let the user choose when to download/restart — the renderer drives the flow.
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on("checking-for-update", () => sendUpdateStatus({ status: "checking" }))
  autoUpdater.on("update-available", (info) =>
    sendUpdateStatus({
      status: "available",
      version: info && info.version,
      releaseNotes: info && info.releaseNotes,
    }),
  )
  autoUpdater.on("update-not-available", () => sendUpdateStatus({ status: "uptodate" }))
  autoUpdater.on("download-progress", (p) =>
    sendUpdateStatus({ status: "downloading", percent: Math.round((p && p.percent) || 0) }),
  )
  autoUpdater.on("update-downloaded", (info) =>
    sendUpdateStatus({ status: "downloaded", version: info && info.version }),
  )
  autoUpdater.on("error", (err) =>
    sendUpdateStatus({ status: "error", message: String((err && err.message) || err) }),
  )

  if (!isDev) {
    // Check for updates shortly after launch (production only).
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(() => {})
    }, 4000)
  }
}

// ---------------------------------------------------------------------------
// Create the main window
// ---------------------------------------------------------------------------

let mainWindow = null

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    title: "ProFlow",
    backgroundColor: "#1a1626",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Build a clean application menu (macOS gets the app menu, Windows gets a minimal one)
  const menuTemplate = [
    {
      label: "File",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
  ]

  // On macOS, add the app name menu
  if (process.platform === "darwin") {
    menuTemplate.unshift({
      label: app.getName(),
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    })
  }

  const menu = Menu.buildFromTemplate(menuTemplate)
  Menu.setApplicationMenu(menu)

  if (isDev) {
    // In development, load from the Next.js dev server
    win.loadURL("http://localhost:3000")
    win.webContents.openDevTools()
  } else {
    // In production, load the exported static build
    win.loadFile(path.join(__dirname, "..", "out", "index.html"))
  }

  mainWindow = win
  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null
  })

  return win
}

// ---------------------------------------------------------------------------
// IPC handlers
// ---------------------------------------------------------------------------

ipcMain.handle("get-app-version", () => {
  return getAppVersion()
})

// Return the cached update state — the launch-time auto-check may have finished
// before the Settings view mounted, so the renderer asks for it on subscribe.
ipcMain.handle("update:get-status", () => updateState)

// In-place auto-update — the installer is downloaded and applied silently over
// the current install (no uninstall, no reinstall, data preserved).
ipcMain.handle("update:check", async () => {
  if (isDev) return { status: "dev" }
  try {
    autoUpdater.checkForUpdates()
    return { status: "checking" }
  } catch (err) {
    return { status: "error", message: String((err && err.message) || err) }
  }
})

ipcMain.handle("update:download", async () => {
  try {
    autoUpdater.downloadUpdate()
    return { status: "downloading" }
  } catch (err) {
    return { status: "error", message: String((err && err.message) || err) }
  }
})

ipcMain.handle("update:install", async () => {
  // Apply the downloaded update and restart into it.
  autoUpdater.quitAndInstall(false, true)
  return { status: "installing" }
})

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(async () => {
  createWindow()

  // Wire electron-updater events → renderer and check for updates on launch
  // (production only, after a short delay so the app opens instantly).
  wireAutoUpdater()
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
