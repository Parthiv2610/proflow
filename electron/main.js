const { app, BrowserWindow, Menu, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

let autoUpdater = null;
try {
  autoUpdater = require("electron-updater").autoUpdater;
} catch (err) {
  console.error("[ProFlow] electron-updater not available:", err.message);
}

const isDev = !app.isPackaged;
const logPath = path.join(app.getPath("userData"), "crash.log");

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try { fs.appendFileSync(logPath, line); } catch {}
  console.log(line);
}

// Allow the timer-end chime to play without requiring a user gesture.
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

// ---------------------------------------------------------------------------
// Auto-update (electron-updater — GitHub Releases feed)
// ---------------------------------------------------------------------------

function getAppVersion() {
  try {
    const pkgPath = path.join(__dirname, "..", "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

let updateState = { status: "idle" };

function sendUpdateStatus(payload) {
  updateState = { ...updateState, ...payload };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update:status", updateState);
  }
}

function wireAutoUpdater() {
  if (!autoUpdater) {
    log("autoUpdater not available, skipping");
    return;
  }
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => sendUpdateStatus({ status: "checking" }));
  autoUpdater.on("update-available", (info) =>
    sendUpdateStatus({ status: "available", version: info && info.version, releaseNotes: info && info.releaseNotes })
  );
  autoUpdater.on("update-not-available", () => sendUpdateStatus({ status: "uptodate" }));
  autoUpdater.on("download-progress", (p) =>
    sendUpdateStatus({ status: "downloading", percent: Math.round((p && p.percent) || 0) })
  );
  autoUpdater.on("update-downloaded", (info) =>
    sendUpdateStatus({ status: "downloaded", version: info && info.version })
  );
  autoUpdater.on("error", (err) => {
    const msg = String((err && err.message) || err);
    log("autoUpdater error: " + msg);
    sendUpdateStatus({ status: "error", message: msg });
  });

  if (!isDev) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((e) => log("checkForUpdates failed: " + e));
    }, 4000);
  }
}

// ---------------------------------------------------------------------------
// Create the main window
// ---------------------------------------------------------------------------

let mainWindow = null;

function createWindow() {
  log("Creating window, isDev=" + isDev + ", __dirname=" + __dirname);

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

  // Build application menu
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
  ];

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
    });
  }

  win.setMenu(Menu.buildFromTemplate(menuTemplate));

  // Log errors that prevent the page from loading
  win.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL) => {
    log("PAGE FAILED TO LOAD: code=" + errorCode + " desc=" + errorDescription + " url=" + validatedURL);
  });

  // Log console errors from the renderer
  win.webContents.on("console-message", (event, level, message) => {
    if (level >= 2) { // 0=info, 1=warn, 2=error
      log("RENDERER ERROR: " + message);
    }
  });

  if (isDev) {
    log("Loading dev URL");
    win.loadURL("http://localhost:3000");
    win.webContents.openDevTools();
  } else {
    const htmlPath = path.join(__dirname, "..", "out", "index.html");
    log("Loading file: " + htmlPath);
    log("File exists: " + fs.existsSync(htmlPath));
    log("File size: " + (fs.existsSync(htmlPath) ? fs.statSync(htmlPath).size : "N/A"));

    // Try loadFile first, fall back to loadURL with file:// protocol
    try {
      win.loadFile(htmlPath);
    } catch (err) {
      log("loadFile failed: " + err.message);
      try {
        const fileUrl = "file:///" + htmlPath.replace(/\\/g, "/");
        log("Trying loadURL: " + fileUrl);
        win.loadURL(fileUrl);
      } catch (err2) {
        log("loadURL also failed: " + err2.message);
      }
    }
  }

  mainWindow = win;
  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });

  return win;
}

// ---------------------------------------------------------------------------
// IPC handlers
// ---------------------------------------------------------------------------

ipcMain.handle("get-app-version", () => getAppVersion());
ipcMain.handle("update:get-status", () => updateState);
ipcMain.handle("update:check", async () => {
  if (isDev) return { status: "dev" };
  try {
    if (autoUpdater) autoUpdater.checkForUpdates();
    return { status: "checking" };
  } catch (err) {
    return { status: "error", message: String((err && err.message) || err) };
  }
});
ipcMain.handle("update:download", async () => {
  try {
    if (autoUpdater) autoUpdater.downloadUpdate();
    return { status: "downloading" };
  } catch (err) {
    return { status: "error", message: String((err && err.message) || err) };
  }
});
ipcMain.handle("update:install", async () => {
  if (autoUpdater) autoUpdater.quitAndInstall(false, true);
  return { status: "installing" };
});

ipcMain.handle("backup:autoSave", async (event, payload) => {
  try {
    const { content } = payload || {};
    if (!content) return { error: "content is required" };
    const fileName = `proflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const filePath = path.join(app.getPath("downloads"), fileName);
    fs.writeFileSync(filePath, content, "utf-8");
    return { path: filePath };
  } catch (err) {
    return { error: String((err && err.message) || err) };
  }
});

ipcMain.handle("backup:save", async (event, payload) => {
  try {
    const { fileName, content } = payload || {};
    if (!fileName || typeof content !== "string") {
      return { error: "fileName and content are required" };
    }
    const win = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: "Export ProFlow backup",
      defaultPath: path.join(app.getPath("downloads"), fileName),
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (canceled || !filePath) return { canceled: true };
    fs.writeFileSync(filePath, content, "utf-8");
    return { canceled: false, path: filePath };
  } catch (err) {
    return { error: String((err && err.message) || err) };
  }
});

ipcMain.handle("get-crash-log", () => {
  try {
    return fs.readFileSync(logPath, "utf-8");
  } catch {
    return "No log file found";
  }
});

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(async () => {
  log("App ready, version=" + getAppVersion());
  createWindow();
  wireAutoUpdater();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("render-process-gone", (event, webContents, details) => {
  log("RENDER PROCESS GONE: " + JSON.stringify(details));
});

app.on("child-process-gone", (event, details) => {
  log("CHILD PROCESS GONE: " + JSON.stringify(details));
});

process.on("uncaughtException", (err) => {
  log("UNCAUGHT EXCEPTION: " + err.stack || err);
});

// Expose crash log path so the renderer can show it
ipcMain.handle("get-crash-log-path", () => logPath);

ipcMain.handle("show-crash-log", async () => {
  try {
    const content = fs.readFileSync(logPath, "utf-8");
    const win = BrowserWindow.getFocusedWindow() || mainWindow;
    if (win) {
      await dialog.showMessageBox(win, {
        type: "info",
        title: "ProFlow Crash Log",
        message: "Crash log contents (copy and send to developer):",
        detail: content.slice(-4000),
        buttons: ["OK"],
      });
    }
  } catch {
    await dialog.showMessageBox({
      type: "info",
      title: "ProFlow Crash Log",
      message: "No crash log found.",
      buttons: ["OK"],
    });
  }
});
