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
let timerWindow = null;

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
// LAN Sync Server
// ---------------------------------------------------------------------------
let lanServer = null;
let lanData = {};
let connectedDevices = new Map(); // ip -> lastSeen timestamp

function trackDevice(ip) {
  connectedDevices.set(ip, Date.now());
  // Clean up devices not seen in 5 minutes
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [k, t] of connectedDevices) {
    if (t < cutoff) connectedDevices.delete(k);
  }
}

function sendDeviceCount() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    try { mainWindow.webContents.send('lan-sync:devices', connectedDevices.size); } catch (_) {}
  }
}

function getLocalIp() {
  const { networkInterfaces } = require("os");
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return "127.0.0.1";
}

function startLanHttpServer(port, data) {
  return new Promise((resolve, reject) => {
    try {
      const http = require("http");
      lanData = data || {};

      const server = http.createServer((req, res) => {
        // CORS headers
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");

        if (req.method === "OPTIONS") {
          res.writeHead(204);
          res.end();
          return;
        }

        // Track connected devices
        const clientIp = req.socket?.remoteAddress || req.connection?.remoteAddress || 'unknown';
        trackDevice(clientIp);
        sendDeviceCount();

        // GET /sync — client pulls data (fetch fresh from renderer)
        if (req.method === "GET" && req.url === "/sync") {
          requestFreshDataFromRenderer().then((freshData) => {
            // Merge fresh renderer data into lanData
            if (freshData && typeof freshData === "object") {
              lanData = additiveMergeServer(lanData, freshData);
            }
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ data: lanData, syncedAt: new Date().toISOString() }));
          }).catch(() => {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ data: lanData, syncedAt: new Date().toISOString() }));
          });
          return;
        }

        // PUT /sync — client pushes data
        if (req.method === "PUT" && req.url === "/sync") {
          let body = "";
          req.on("data", (chunk) => { body += chunk; });
          req.on("end", () => {
            try {
              const parsed = JSON.parse(body);
              if (parsed.data && typeof parsed.data === "object") {
                lanData = additiveMergeServer(lanData, parsed.data);
              // Also push to the renderer via IPC (safe, no string escaping issues)
              if (mainWindow && !mainWindow.isDestroyed()) {
                try { mainWindow.webContents.send("lan-sync:pushed", parsed.data); } catch (_) {}
              }
              }
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ ok: true, syncedAt: new Date().toISOString() }));
            } catch (e) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: e.message }));
            }
          });
          return;
        }

        // GET / — status page
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("ProFlow LAN Sync is running. Use /sync to exchange data.\nConnected devices: " + connectedDevices.size);
      });

      server.on("error", (err) => reject(err));

      server.listen(port, "0.0.0.0", () => {
        lanServer = server;
        log("LAN sync server started on port " + port);
        resolve({ port, ip: getLocalIp() });
      });
    } catch (err) {
      reject(err);
    }
  });
}

const applyDataStr = `function(d){for(var k in d){try{localStorage.setItem('proflow-'+k,JSON.stringify(d[k]))}catch(e){}}}`;

/**
 * Additive merge: only ADDS new items from incoming data, never deletes.
 * - Arrays: items with new IDs are added, existing are updated
 * - Numbers: takes the higher value
 * - Objects: new keys are added
 */
function additiveMergeServer(existing, incoming) {
  const result = Object.assign({}, existing);
  for (const key of Object.keys(incoming)) {
    const incVal = incoming[key];
    const curVal = result[key];
    // Array of objects with id
    if (Array.isArray(incVal) && incVal.length > 0 && typeof incVal[0] === 'object' && incVal[0] !== null && incVal[0].id) {
      const curArr = Array.isArray(curVal) ? curVal : [];
      const map = new Map(curArr.map(item => [item.id, item]));
      let changed = false;
      for (const item of incVal) {
        if (!map.has(item.id)) { map.set(item.id, item); changed = true; }
        else { map.set(item.id, Object.assign({}, map.get(item.id), item)); }
      }
      if (changed || incVal.length > curArr.length) result[key] = Array.from(map.values());
    }
    // Number — take higher
    else if (typeof incVal === 'number' && typeof curVal === 'number') {
      result[key] = Math.max(curVal, incVal);
    }
    // Object/Record — merge keys
    else if (typeof incVal === 'object' && incVal !== null && !Array.isArray(incVal) && typeof curVal === 'object' && curVal !== null && !Array.isArray(curVal)) {
      result[key] = Object.assign({}, curVal, incVal);
    }
    else {
      result[key] = incVal;
    }
  }
  return result;
}

function stopLanHttpServer() {
  return new Promise((resolve) => {
    if (lanServer) {
      lanServer.close(() => {
        lanServer = null;
        log("LAN sync server stopped");
        resolve();
      });
    } else {
      resolve();
    }
  });
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
ipcMain.handle("lan-sync:start", async (event, opts) => {
  try {
    const { port, data } = opts || {};
    const result = await startLanHttpServer(port || 7777, data || {});
    return { localIp: result.ip, port: result.port };
  } catch (err) {
    return { error: err.message };
  }
});
ipcMain.handle("lan-sync:stop", async () => {
  await stopLanHttpServer();
  connectedDevices.clear();
  sendDeviceCount();
  return { ok: true };
});
ipcMain.handle("lan-sync:deviceCount", () => connectedDevices.size);
// LAN sync: renderer sends its data here so the server can return it on GET /sync
ipcMain.handle("lan-sync:getData", async (event, data) => {
  lanData = data || {};
  return { ok: true };
});
// LAN sync: server requests fresh data from the renderer (returns a promise that resolves when renderer responds)
let _lanDataResolve = null;
ipcMain.on("lan-sync:wantData", () => {}); // placeholder
function requestFreshDataFromRenderer() {
  return new Promise((resolve) => {
    if (!mainWindow || mainWindow.isDestroyed()) { resolve({}); return; }
    _lanDataResolve = resolve;
    mainWindow.webContents.send("lan-sync:wantData", {});
    // Timeout after 2 seconds — fall back to cached data
    setTimeout(() => { if (_lanDataResolve) { _lanDataResolve = null; resolve(lanData); } }, 2000);
  });
}
ipcMain.handle("lan-sync:giveData", async (event, data) => {
  if (_lanDataResolve) { _lanDataResolve(data || {}); _lanDataResolve = null; }
  return { ok: true };
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
// ---------------------------------------------------------------------------
// Floating Timer Window (always-on-top, frameless)
// ---------------------------------------------------------------------------
function createTimerWindow() {
  if (timerWindow && !timerWindow.isDestroyed()) {
    timerWindow.focus();
    return;
  }
  // Position at top-right of screen
  const { width: sw, height: sh } = require('screen').getPrimaryDisplay().workAreaSize;
  timerWindow = new BrowserWindow({
    width: 200,
    height: 90,
    x: sw - 220,
    y: 20,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  timerWindow.setAlwaysOnTop(true, 'screen-saver');
  timerWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  const timerHtml = path.join(__dirname, 'timer-window.html');
  log('Timer window: ' + timerHtml);
  timerWindow.loadFile(timerHtml);

  // Click-through on transparent areas
  timerWindow.setIgnoreMouseEvents(false);

  timerWindow.on('closed', () => { timerWindow = null; });
}

function destroyTimerWindow() {
  if (timerWindow && !timerWindow.isDestroyed()) {
    timerWindow.close();
    timerWindow = null;
  }
}

function sendTimerUpdate(data) {
  if (timerWindow && !timerWindow.isDestroyed()) {
    try { timerWindow.webContents.send('timer:update', data); } catch (_) {}
  }
}

ipcMain.on('timer:toggle', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('timer:toggle');
  }
});
ipcMain.on('timer:skip', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('timer:skip');
  }
});
ipcMain.on('timer:close', () => {
  destroyTimerWindow();
});
ipcMain.on('timer:toggleAutoBreak', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('timer:toggleAutoBreak');
  }
});
ipcMain.handle('timer:show', () => { createTimerWindow(); return { ok: true }; });
ipcMain.handle('timer:hide', () => { destroyTimerWindow(); return { ok: true }; });
ipcMain.handle('timer:update', (event, data) => { sendTimerUpdate(data); return { ok: true }; });

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
// Rolling backup — saves to userData so data survives localStorage clears
// ---------------------------------------------------------------------------
const ROLLING_BACKUP_PATH = path.join(app.getPath("userData"), "proflow-rolling-backup.json");

ipcMain.handle("backup:rollingSave", async (event, payload) => {
  try {
    const { data } = payload || {};
    if (!data || typeof data !== "object") return { error: "data required" };
    const wrapper = {
      format: "proflow-rolling-backup",
      version: 2,
      savedAt: new Date().toISOString(),
      data: data,
    };
    // Atomic write: write to temp then rename
    const tmpPath = ROLLING_BACKUP_PATH + ".tmp";
    fs.writeFileSync(tmpPath, JSON.stringify(wrapper, null, 2), "utf-8");
    fs.renameSync(tmpPath, ROLLING_BACKUP_PATH);
    log("Rolling backup saved (" + Object.keys(data).length + " keys)");
    return { ok: true, path: ROLLING_BACKUP_PATH };
  } catch (err) {
    log("Rolling backup save failed: " + err.message);
    return { error: err.message };
  }
});

ipcMain.handle("backup:loadRolling", async () => {
  try {
    if (!fs.existsSync(ROLLING_BACKUP_PATH)) return { found: false };
    const content = fs.readFileSync(ROLLING_BACKUP_PATH, "utf-8");
    const parsed = JSON.parse(content);
    log("Rolling backup loaded (" + Object.keys(parsed.data || {}).length + " keys)");
    return { found: true, data: parsed.data, savedAt: parsed.savedAt };
  } catch (err) {
    log("Rolling backup load failed: " + err.message);
    return { found: false, error: err.message };
  }
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
