const { app, BrowserWindow, Menu, ipcMain } = require("electron")
const path = require("path")
const fs = require("fs")
const http = require("http")
const os = require("os")
const { autoUpdater } = require("electron-updater")
const { startLanServer, getLanIPs, generatePasscode } = require("./lan-server")

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

// ---------------------------------------------------------------------------
// LAN Sync — serve the app + a sync endpoint over WiFi for phone access
// ---------------------------------------------------------------------------

const LAN_STATE_FILE = () => path.join(app.getPath("userData"), "lan-state.json")

let lanServer = null // running server handle (null when disabled)
let mainWindow = null

function loadLanMeta() {
  try {
    const parsed = JSON.parse(fs.readFileSync(LAN_STATE_FILE(), "utf-8"))
    return { passcode: parsed.passcode || "" }
  } catch {
    return { passcode: "" }
  }
}

let lanMeta = loadLanMeta()

function persistLanMeta() {
  try {
    fs.mkdirSync(path.dirname(LAN_STATE_FILE()), { recursive: true })
    const existing = fs.existsSync(LAN_STATE_FILE())
      ? JSON.parse(fs.readFileSync(LAN_STATE_FILE(), "utf-8"))
      : {}
    fs.writeFileSync(
      LAN_STATE_FILE(),
      JSON.stringify({ ...existing, passcode: lanMeta.passcode || "" }),
    )
  } catch {
    // best effort
  }
}

function getLanStatus() {
  const ips = getLanIPs()
  const ip = ips[0] || null
  return {
    enabled: !!lanServer,
    url: lanServer && ip ? `http://${ip}:${lanServer.port}` : null,
    ip,
    ips, // all candidate addresses, best first — the UI can offer alternatives
    port: lanServer ? lanServer.port : 5174,
    passcode: lanMeta.passcode || "",
    host: os.hostname(),
  }
}

function broadcastToRenderer(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("lan:remote", payload)
  }
}

async function setLanEnabled(enabled) {
  if (enabled && !lanServer) {
    if (!lanMeta.passcode) {
      lanMeta.passcode = generatePasscode()
      persistLanMeta()
    }
    try {
      lanServer = await startLanServer({
        port: 5174,
        outDir: path.join(__dirname, "..", "out"),
        stateFile: LAN_STATE_FILE(),
        passcode: lanMeta.passcode,
        onRemoteChange: (merged) => broadcastToRenderer(merged),
      })
      return getLanStatus()
    } catch (err) {
      return { ...getLanStatus(), error: String(err && err.message ? err.message : err) }
    }
  }
  if (!enabled && lanServer) {
    await lanServer.stop()
    lanServer = null
  }
  return getLanStatus()
}

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

// LAN Sync IPC
ipcMain.handle("lan:get-status", () => getLanStatus())

ipcMain.handle("lan:set-enabled", async (_event, enabled) => setLanEnabled(!!enabled))

ipcMain.handle("lan:push", (_event, snapshot) => {
  if (!lanServer || !snapshot) return false
  try {
    // The laptop's own changes are merged into the shared state and persisted.
    // The phone picks them up on its next poll — no broadcast needed here.
    lanServer.mergeIncoming(snapshot)
    return true
  } catch {
    return false
  }
})

ipcMain.handle("lan:regen-passcode", async () => {
  lanMeta.passcode = generatePasscode()
  persistLanMeta()
  if (lanServer) lanServer.setPasscode(lanMeta.passcode)
  return getLanStatus()
})

// Diagnose why a phone can't connect: fetch /api/info over the laptop's own
// LAN address. If localhost works but the LAN IP fails, the Windows Firewall
// is almost certainly dropping inbound traffic on the sync port.
ipcMain.handle("lan:self-test", async () => {
  if (!lanServer) return { reachable: false, reason: "server-off" }
  const port = lanServer.port
  const ips = getLanIPs()
  const probe = (host) =>
    new Promise((resolve) => {
      const req = http.get(`http://${host}:${port}/api/info`, { timeout: 3000 }, (res) => {
        res.resume()
        resolve(res.statusCode === 200)
      })
      req.on("error", () => resolve(false))
      req.on("timeout", () => {
        req.destroy()
        resolve(false)
      })
    })
  const local = await probe("127.0.0.1")
  // Probe every LAN address in parallel — the diagnosis doesn't depend on
  // order, and sequential 3s timeouts could hang the button for 10s+ when
  // several virtual adapters are unroutable.
  const results = await Promise.all(ips.map(async (ip) => ({ ip, ok: await probe(ip) })))
  const ok = results.find((r) => r.ok)
  const testedIp = ok ? ok.ip : null
  if (!local) return { reachable: false, reason: "local-down", testedIp }
  if (!ok) return { reachable: false, reason: "firewall", testedIp, ips }
  return { reachable: true, testedIp, ips }
})

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(async () => {
  const win = createWindow()

  // The LAN server is (re)started by the renderer on startup if the user had
  // it enabled — the preference lives in the renderer's localStorage and is
  // replayed through lan:set-enabled once the window loads.

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
