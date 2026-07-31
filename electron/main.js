const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require("electron")
const path = require("path")
const fs = require("fs")
const https = require("https")
const http = require("http")
const os = require("os")
const { startLanServer, getLanIPs, generatePasscode } = require("./lan-server")

const isDev = !app.isPackaged

// ---------------------------------------------------------------------------
// Auto-update helpers
// --------------------------------------------------------------------------

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

/** The remote URL where versions.json is hosted */
const UPDATE_URL =
  process.env.PROFLOW_UPDATE_URL ||
  "https://pro-flow-8mp2.vercel.app/versions.json"

/**
 * Fetch a JSON resource over HTTPS (with HTTP fallback).
 * Returns null on any network/parse error.
 */
function fetchJSON(url) {
  return new Promise((resolve) => {
    const client = url.startsWith("https") ? https : http
    const req = client.get(url, { timeout: 8000 }, (res) => {
      if (res.statusCode !== 200) {
        resolve(null)
        return
      }
      const chunks = []
      res.on("data", (c) => chunks.push(c))
      res.on("end", () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString()))
        } catch {
          resolve(null)
        }
      })
    })
    req.on("error", () => resolve(null))
    req.on("timeout", () => {
      req.destroy()
      resolve(null)
    })
  })
}

/** Compare two semver strings; returns true if a > b */
function isNewerVersion(a, b) {
  const pa = a.split(".").map(Number)
  const pb = b.split(".").map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0
    const nb = pb[i] || 0
    if (na > nb) return true
    if (na < nb) return false
  }
  return false
}

/**
 * Check for a newer version and optionally show a dialog.
 * Returns the remote manifest (or null) so the caller can act on it.
 */
async function checkForUpdate() {
  const manifest = await fetchJSON(UPDATE_URL)
  if (!manifest) return null

  const currentVer = getAppVersion()
  const remoteVer = manifest.latestVersion
  if (!remoteVer || !isNewerVersion(remoteVer, currentVer)) return null

  return manifest
}

/** Show a native dialog asking the user to download the update */
function showUpdateDialog(manifest) {
  const win = BrowserWindow.getFocusedWindow()
  if (!win) return

  const result = dialog.showMessageBoxSync(win, {
    type: "info",
    title: "Update Available",
    message: `ProFlow v${manifest.latestVersion} is available!`,
    detail:
      manifest.releaseNotes ||
      `You're using v${getAppVersion()}. Download the latest version to get new features and fixes.`,
    buttons: ["Download", "Not Now"],
    defaultId: 0,
    cancelId: 1,
  })

  if (result === 0 && manifest.downloadUrl) {
    shell.openExternal(manifest.downloadUrl)
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
  const ip = getLanIPs()[0] || null
  return {
    enabled: !!lanServer,
    url: lanServer && ip ? `http://${ip}:${lanServer.port}` : null,
    ip,
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
        onRemoteChange: (merged) => broadcastToRenderer({ type: "snapshot", snapshot: merged }),
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

ipcMain.handle("check-for-update", async () => {
  const manifest = await checkForUpdate()
  if (!manifest) {
    return { hasUpdate: false, currentVersion: getAppVersion() }
  }
  return {
    hasUpdate: true,
    currentVersion: getAppVersion(),
    latestVersion: manifest.latestVersion,
    downloadUrl: manifest.downloadUrl,
    releaseNotes: manifest.releaseNotes,
  }
})

ipcMain.handle("download-update", async (_event, url) => {
  if (url) shell.openExternal(url)
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

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(async () => {
  const win = createWindow()

  // The LAN server is (re)started by the renderer on startup if the user had
  // it enabled — the preference lives in the renderer's localStorage and is
  // replayed through lan:set-enabled once the window loads.

  // Check for updates on startup (only in production, after a short delay)
  if (!isDev) {
    // Wait for the window to finish loading, then check
    win.webContents.on("did-finish-load", async () => {
      // Give the user a moment to see the app before interrupting
      await new Promise((r) => setTimeout(r, 3000))
      const manifest = await checkForUpdate()
      if (manifest) {
        showUpdateDialog(manifest)
      }
    })
  }
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
