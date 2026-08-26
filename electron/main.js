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
    const p = path.join(isDev ? __dirname : process.resourcesPath, "package.json");
    return JSON.parse(fs.readFileSync(p, "utf-8")).version || "0.0.0";
  } catch {
    try {
      return JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf-8")).version || "0.0.0";
    } catch { return "0.0.0"; }
  }
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
// Resolve index.html
// ---------------------------------------------------------------------------
function resolveIndex() {
  // In dev, out/ is in project root. In production, out/ is copied to resources/out/.
  const candidates = [];

  if (isDev) {
    candidates.push(path.join(__dirname, "..", "out", "index.html"));
  } else {
    // With asarUnpack or extraResources, out/ is at resources/out/
    candidates.push(path.join(process.resourcesPath, "out", "index.html"));
    // Also check inside app.asar (old layout)
    candidates.push(path.join(__dirname, "..", "out", "index.html"));
    // Also check relative to app root
    candidates.push(path.join(process.resourcesPath, "app.asar.unpacked", "out", "index.html"));
  }

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        log("Found: " + p);
        return p;
      }
    } catch (_) {}
  }

  // Log everything for debugging
  log("FATAL: index.html not found in any of:");
  candidates.forEach(c => log("  " + c));

  try {
    log("__dirname = " + __dirname);
    log("resourcesPath = " + process.resourcesPath);
    log("execPath = " + process.execPath);
    const dirs = [process.resourcesPath, path.join(process.resourcesPath, "out"), path.dirname(process.execPath)];
    dirs.forEach(d => {
      try { log("ls " + d + ": " + JSON.stringify(fs.readdirSync(d).slice(0, 15))); }
      catch (e) { log("ls " + d + ": " + e.message); }
    });
  } catch (e) { log("Debug dump failed: " + e.message); }

  return candidates[0];
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------
function showCrashLog() {
  let content = "No crash log found.";
  try { content = fs.readFileSync(logPath, "utf-8"); } catch (_) {}
  const w = BrowserWindow.getFocusedWindow() || mainWindow;
  if (w) {
    dialog.showMessageBox(w, { type: "info", title: "ProFlow — Crash Log", message: "Copy to developer:", detail: content.slice(-4000), buttons: ["OK"] });
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440, height: 920, minWidth: 1024, minHeight: 700,
    title: "ProFlow",
    backgroundColor: "#1a1626",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Simple menu
  const template = [
    { label: "File", submenu: [{ role: "reload" }, { role: "forceReload" }, { type: "separator" }, { role: "quit" }] },
    { label: "Edit", submenu: [{ role: "undo" }, { role: "redo" }, { type: "separator" }, { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" }] },
    { label: "View", submenu: [{ role: "reload" }, { role: "forceReload" }, { role: "toggleDevTools" }, { type: "separator" }, { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }, { type: "separator" }, { role: "togglefullscreen" }] },
    { label: "Help", submenu: [{ label: "Show Crash Log", click: () => showCrashLog() }] },
  ];
  if (process.platform === "darwin") {
    template.unshift({ label: app.getName(), submenu: [{ role: "about" }, { type: "separator" }, { role: "quit" }] });
  }
  win.setMenu(Menu.buildFromTemplate(template));

  // Load
  const idx = resolveIndex();
  log("Loading: " + idx);
  win.loadFile(idx);

  // Error reporting
  win.webContents.on("did-fail-load", (e, code, desc) => {
    log("LOAD FAILED: " + code + " " + desc);
    showError("Page load failed", "Error " + code + ": " + desc);
  });
  win.webContents.on("console-message", (e, level, msg) => { if (level >= 2) log("RENDERER: " + msg); });
  win.on("render-process-gone", (e, wc, details) => log("RENDER CRASH: " + JSON.stringify(details)));

  mainWindow = win;
  win.on("closed", () => { if (mainWindow === win) mainWindow = null; });
  return win;
}

function showError(msg, detail) {
  try { dialog.showErrorBox("ProFlow Error", msg + "\n\n" + (detail || "")); }
  catch (_) { log("DIALOG FAILED: " + msg + " | " + detail); }
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------
ipcMain.handle("get-app-version", () => getAppVersion());
ipcMain.handle("get-crash-log-path", () => logPath);
ipcMain.handle("show-crash-log", () => showCrashLog());
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
    const fp = path.join(app.getPath("downloads"), "proflow-backup-" + new Date().toISOString().slice(0, 10) + ".json");
    fs.writeFileSync(fp, content, "utf-8");
    return { path: fp };
  } catch (err) { return { error: err.message }; }
});
ipcMain.handle("backup:save", async (event, payload) => {
  try {
    const { fileName, content } = payload || {};
    if (!fileName || typeof content !== "string") return { error: "fileName and content required" };
    const w = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePath } = await dialog.showSaveDialog(w, {
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
  log("App ready v" + getAppVersion() + " platform=" + process.platform + " dev=" + isDev);
  log("resourcesPath=" + (process.resourcesPath || "N/A"));
  createWindow();
  wireAutoUpdater();
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

process.on("uncaughtException", (err) => log("UNCAUGHT: " + (err.stack || err)));
process.on("unhandledRejection", (err) => log("UNHANDLED: " + err));
