const { app, BrowserWindow, Menu, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

const isDev = !app.isPackaged;

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------
const logPath = path.join(app.getPath("userData"), "crash.log");
function log(msg) {
  const line = "[" + new Date().toISOString() + "] " + msg + "\n";
  try { fs.appendFileSync(logPath, line); } catch (_) {}
  if (isDev) console.log(line.trimEnd());
}

try { fs.writeFileSync(logPath, "=== ProFlow started " + new Date().toISOString() + " ===\n"); } catch (_) {}

// ---------------------------------------------------------------------------
// Auto-updater (safe — does nothing if module missing)
// ---------------------------------------------------------------------------
let autoUpdater = null;
try {
  autoUpdater = require("electron-updater").autoUpdater;
  log("electron-updater loaded OK");
} catch (err) {
  log("electron-updater NOT available: " + err.message);
}

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

// ---------------------------------------------------------------------------
// App version
// ---------------------------------------------------------------------------
function getAppVersion() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf-8")).version || "0.0.0";
  } catch { return "0.0.0"; }
}

// ---------------------------------------------------------------------------
// Update state
// ---------------------------------------------------------------------------
let updateState = { status: "idle" };
let mainWindow = null;

function sendUpdateStatus(payload) {
  updateState = { ...updateState, ...payload };
  if (mainWindow && !mainWindow.isDestroyed()) {
    try { mainWindow.webContents.send("update:status", updateState); } catch (_) {}
  }
}

function wireAutoUpdater() {
  if (!autoUpdater) return;
  try {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on("checking-for-update", () => sendUpdateStatus({ status: "checking" }));
    autoUpdater.on("update-available", (info) =>
      sendUpdateStatus({ status: "available", version: info && info.version, releaseNotes: info && info.releaseNotes }));
    autoUpdater.on("update-not-available", () => sendUpdateStatus({ status: "uptodate" }));
    autoUpdater.on("download-progress", (p) =>
      sendUpdateStatus({ status: "downloading", percent: Math.round((p && p.percent) || 0) }));
    autoUpdater.on("update-downloaded", (info) =>
      sendUpdateStatus({ status: "downloaded", version: info && info.version }));
    autoUpdater.on("error", (err) => {
      log("autoUpdater error: " + err.message);
      sendUpdateStatus({ status: "error", message: err.message });
    });
    if (!isDev) {
      setTimeout(() => autoUpdater.checkForUpdates().catch((e) => log("update check failed: " + e)), 4000);
    }
    log("autoUpdater wired OK");
  } catch (err) {
    log("autoUpdater wire failed: " + err.message);
  }
}

// ---------------------------------------------------------------------------
// Resolve the built index.html
// ---------------------------------------------------------------------------
function resolveIndexHtml() {
  if (isDev) {
    return path.join(__dirname, "..", "out", "index.html");
  }

  // Production: out/ is an extraResource copied OUTSIDE the asar archive
  // process.resourcesPath = <install-dir>/resources/
  const candidates = [
    path.join(process.resourcesPath, "out", "index.html"),
    path.join(__dirname, "..", "out", "index.html"),          // fallback: inside asar
    path.join(process.resourcesPath, "app", "out", "index.html"), // old layout
    path.join(path.dirname(process.execPath), "resources", "out", "index.html"), // ultimate fallback
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      log("Found index.html at: " + p);
      return p;
    }
    log("Tried (missing): " + p);
  }

  // Return the primary path even if missing — loadFile will show an error
  log("WARNING: No index.html found in any location!");
  log("  execPath:      " + process.execPath);
  log("  resourcesPath: " + process.resourcesPath);
  log("  __dirname:     " + __dirname);

  // Dump directory listing to help debug
  for (const dir of candidates.map(path.dirname)) {
    try {
      const files = fs.readdirSync(dir);
      log("  contents of " + dir + ": " + JSON.stringify(files.slice(0, 20)));
    } catch (e) {
      log("  cannot read dir " + dir + ": " + e.message);
    }
  }

  return candidates[0];
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------
function showCrashLogDialog() {
  let content = "No crash log found.";
  try { content = fs.readFileSync(logPath, "utf-8"); } catch (_) {}
  const win = BrowserWindow.getFocusedWindow() || mainWindow;
  if (win) {
    dialog.showMessageBox(win, {
      type: "info",
      title: "ProFlow — Crash Log",
      message: "Crash log (copy & paste to developer):",
      detail: content.slice(-4000),
      buttons: ["OK"],
    });
  }
}

function showErrorDialog(msg, detail) {
  try {
    dialog.showErrorBox("ProFlow Error", msg + "\n\n" + (detail || ""));
  } catch (_) {
    log("DIALOG FAILED: " + msg + " | " + detail);
  }
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
  });

  // Menu
  const template = [
    { label: "File", submenu: [
      { role: "reload" }, { role: "forceReload" },
      { type: "separator" }, { role: "quit" }
    ]},
    { label: "Edit", submenu: [
      { role: "undo" }, { role: "redo" },
      { type: "separator" },
      { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" }
    ]},
    { label: "View", submenu: [
      { role: "reload" }, { role: "forceReload" }, { role: "toggleDevTools" },
      { type: "separator" },
      { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" },
      { type: "separator" },
      { role: "togglefullscreen" }
    ]},
    { label: "Help", submenu: [
      { label: "Show Crash Log", click: () => showCrashLogDialog() }
    ]}
  ];
  if (process.platform === "darwin") {
    template.unshift({ label: app.getName(), submenu: [
      { role: "about" }, { type: "separator" },
      { role: "hide" }, { role: "hideOthers" }, { role: "unhide" },
      { type: "separator" }, { role: "quit" }
    ]});
  }
  win.setMenu(Menu.buildFromTemplate(template));

  // Error handlers
  win.webContents.on("did-fail-load", (e, code, desc, url) => {
    log("LOAD FAILED: code=" + code + " desc=" + desc + " url=" + url);
    showErrorDialog("Failed to load page", "Error " + code + ": " + desc + "\nURL: " + url);
  });
  win.webContents.on("console-message", (e, level, msg) => {
    if (level >= 2) log("RENDERER: " + msg);
  });
  win.on("render-process-gone", (e, wc, details) => {
    log("RENDER CRASH: " + JSON.stringify(details));
  });

  // Load the app
  const htmlPath = resolveIndexHtml();
  log("Loading: " + htmlPath);
  win.loadFile(htmlPath);

  mainWindow = win;
  win.on("closed", () => { if (mainWindow === win) mainWindow = null; });
  return win;
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------
ipcMain.handle("get-app-version", () => getAppVersion());
ipcMain.handle("get-crash-log-path", () => logPath);
ipcMain.handle("show-crash-log", () => showCrashLogDialog());

ipcMain.handle("update:get-status", () => updateState);
ipcMain.handle("update:check", () => {
  if (isDev) return { status: "dev" };
  try { if (autoUpdater) autoUpdater.checkForUpdates(); return { status: "checking" }; }
  catch (e) { return { status: "error", message: e.message }; }
});
ipcMain.handle("update:download", () => {
  try { if (autoUpdater) autoUpdater.downloadUpdate(); return { status: "downloading" }; }
  catch (e) { return { status: "error", message: e.message }; }
});
ipcMain.handle("update:install", () => {
  try { if (autoUpdater) autoUpdater.quitAndInstall(false, true); } catch (_) {}
  return { status: "installing" };
});

ipcMain.handle("backup:autoSave", async (event, payload) => {
  try {
    const { content } = payload || {};
    if (!content) return { error: "content is required" };
    const fileName = "proflow-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    const filePath = path.join(app.getPath("downloads"), fileName);
    fs.writeFileSync(filePath, content, "utf-8");
    return { path: filePath };
  } catch (err) { return { error: err.message }; }
});

ipcMain.handle("backup:save", async (event, payload) => {
  try {
    const { fileName, content } = payload || {};
    if (!fileName || typeof content !== "string") return { error: "fileName and content required" };
    const win = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: "Export ProFlow backup",
      defaultPath: path.join(app.getPath("downloads"), fileName),
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (canceled || !filePath) return { canceled: true };
    fs.writeFileSync(filePath, content, "utf-8");
    return { canceled: false, path: filePath };
  } catch (err) { return { error: err.message }; }
});

// ---------------------------------------------------------------------------
// Launch
// ---------------------------------------------------------------------------
app.whenReady().then(() => {
  log("App ready v" + getAppVersion() + ", platform=" + process.platform);
  log("isDev=" + isDev);
  log("execPath=" + process.execPath);
  log("resourcesPath=" + (process.resourcesPath || "N/A"));
  createWindow();
  wireAutoUpdater();
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

process.on("uncaughtException", (err) => log("UNCAUGHT: " + (err.stack || err)));
process.on("unhandledRejection", (err) => log("UNHANDLED: " + err));
