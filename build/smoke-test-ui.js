// ProFlow UI smoke test
// ----------------------
// Guards against the "stuck on the welcome tour" regression:
//   1. (optional) silent-installs ProFlow-Setup-2.0.0.exe
//   2. launches ProFlow.exe with a remote-debugging port + a fresh profile
//   3. connects over the Chrome DevTools Protocol and asserts that
//      the Dashboard rendered and the welcome-tour overlay is ABSENT
//   4. kills the app and cleans up the temp profile
//
// Usage:
//   node build/smoke-test-ui.js                 # install + launch + check
//   node build/smoke-test-ui.js --skip-install  # just launch + check (app already installed)
//   node build/smoke-test-ui.js --installer <path> --app <path> --port <n>
//
// Requires Node 22+ (uses global fetch and WebSocket).
"use strict"

const { spawn, spawnSync } = require("child_process")
const fs = require("fs")
const os = require("os")
const path = require("path")

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2)
const getArg = (name, def) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : def
}
const hasFlag = (name) => args.includes(name)

const PROGRAMFILES = process.env.ProgramFiles || "C:/Program Files"
const SETUP = path.resolve(getArg("--installer", path.join(__dirname, "..", "release", "ProFlow-Setup-2.0.0.exe")))
const INSTALL_DIR = path.join(PROGRAMFILES, "ProFlow")
const APP = path.resolve(getArg("--app", path.join(INSTALL_DIR, "ProFlow.exe")))
const PORT = Number(getArg("--port", "9333"))
const SKIP_INSTALL = hasFlag("--skip-install")
const PROFILE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "proflow-smoke-"))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---------------------------------------------------------------------------
// Tiny helpers
// ---------------------------------------------------------------------------
let pass = 0
let fail = 0
const ok = (msg) => {
  console.log("  [PASS] " + msg)
  pass++
}
const bad = (msg) => {
  console.log("  [FAIL] " + msg)
  fail++
}

async function waitForPageTarget() {
  // Poll the CDP /json/list endpoint until our page target appears.
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`)
      const targets = await res.json()
      const page = targets.find(
        (t) => t.type === "page" && (t.url.includes("index.html") || t.url.startsWith("file://")),
      )
      if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
    } catch {
      // CDP not up yet
    }
    await sleep(500)
  }
  return null
}

async function evalInPage(ws, expression) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1e9)
    const timer = setTimeout(() => {
      ws.removeEventListener("message", onMsg)
      reject(new Error("Runtime.evaluate timed out"))
    }, 5000)
    const onMsg = (ev) => {
      let msg
      try {
        msg = JSON.parse(String(ev.data))
      } catch {
        return
      }
      if (msg.id === id) {
        clearTimeout(timer)
        ws.removeEventListener("message", onMsg)
        if (msg.error) reject(new Error(msg.error.message))
        else resolve(msg.result)
      }
    }
    ws.addEventListener("message", onMsg)
    ws.send(JSON.stringify({ id, method: "Runtime.evaluate", params: { expression, returnByValue: true } }))
  })
}

// ---------------------------------------------------------------------------
// STEP 1 — (optional) silent install
// ---------------------------------------------------------------------------
async function install() {
  console.log("=== STEP 1: Silent install ===")
  if (SKIP_INSTALL) {
    console.log("  [INFO] --skip-install: using existing install")
    return
  }
  if (!fs.existsSync(SETUP)) {
    bad(`Installer not found: ${SETUP}`)
    return
  }
  // The installer can't overwrite a running ProFlow.exe.
  spawnSync("taskkill", ["/IM", "ProFlow.exe", "/T", "/F"], { stdio: "ignore" })

  console.log(`  [INFO] Running: ${SETUP} /S`)
  const r = spawnSync(SETUP, ["/S"], { stdio: "inherit" })
  if (r.status === 0) {
    ok("Installer exited 0")
  } else {
    bad(`Installer exited ${r.status}. If this is "Administrator privileges required", re-run this script from an elevated (Run as administrator) prompt.`)
    return
  }
  const exe = path.join(INSTALL_DIR, "ProFlow.exe")
  if (fs.existsSync(exe)) ok(`Installed to ${exe}`)
  else bad(`ProFlow.exe not found at ${exe}`)
}

// ---------------------------------------------------------------------------
// STEP 2 + 3 — launch, then assert the UI
// ---------------------------------------------------------------------------
async function checkUi() {
  console.log("=== STEP 2: Launching app ===")
  if (!fs.existsSync(APP)) {
    bad(`App not found: ${APP}`)
    return
  }

  // Fresh profile + remote debugging. The welcome tour defaults to OFF, so a
  // clean profile must NOT show it.
  const child = spawn(APP, [`--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE_DIR}`], {
    stdio: "ignore",
  })

  let appExited = false
  child.on("exit", (code) => {
    appExited = true
    console.log(`  [INFO] App process exited early with code ${code}`)
  })

  const cleanup = () => {
    try {
      spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" })
    } catch {
      // already gone
    }
  }

  try {
    const wsUrl = await waitForPageTarget()
    if (!wsUrl) {
      bad("Timed out waiting for the app's debug target. If ProFlow is already running, close it first.")
      return
    }
    ok("App launched and exposed a debug target")

    const ws = new WebSocket(wsUrl)
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve)
      ws.addEventListener("error", () => reject(new Error("CDP websocket failed")))
    })

    console.log("=== STEP 3: Checking UI ===")

    // Poll until React hydrates and the dashboard paints (or fail at 40s).
    let final = null
    for (let i = 0; i < 80; i++) {
      try {
        // NOTE: use textContent, NOT innerText — innerText skips opacity-0
        // elements, and the Dashboard's stat cards animate in with
        // fill-mode-both (kept at opacity 0), which caused a false failure.
        const res = await evalInPage(
          ws,
          `(() => { const t = document.body ? document.body.textContent : ""; return { text: t.slice(0, 4000), hasTour: t.includes("Welcome to ProFlow"), hasDashboard: t.includes("Today's Completion") }; })()`,
        )
        const value = res.result?.value
        if (value) {
          final = value
          if (value.hasDashboard) break
        }
      } catch {
        // context not ready yet
      }
      await sleep(500)
    }

    if (!final) {
      bad("Never got a response from the page")
      return
    }

    if (final.hasDashboard) ok("Dashboard rendered (found \"Today's Completion\")")
    else bad(`Dashboard did not render. Body text: ${JSON.stringify(final.text.slice(0, 300))}`)

    if (final.hasTour) bad("Welcome tour is BLOCKING the app (regression!)")
    else ok("Welcome tour is NOT shown — app is not stuck")

    // Extra sanity: the command palette / capture dialog shouldn't be open by default.
    const open = await evalInPage(
      ws,
      `(() => { const dialogs = Array.from(document.querySelectorAll('[role="dialog"]')).map(d => d.getAttribute("aria-label") || "unknown"); return dialogs; })()`,
    )
    const dialogs = open?.result?.value || []
    if (dialogs.length === 0) ok("No dialogs/overlays open by default")
    else bad(`Unexpected open dialogs: ${JSON.stringify(dialogs)}`)

    ws.close()
  } finally {
    cleanup()
  }
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
;(async () => {
  console.log("============================================")
  console.log("  ProFlow UI Smoke Test")
  console.log("============================================")
  console.log(`  Installer : ${SETUP}`)
  console.log(`  App       : ${APP}`)
  console.log(`  CDP port  : ${PORT}`)
  console.log("")

  await install()
  await checkUi()

  console.log("")
  console.log("============================================")
  console.log(`  Results — Passed: ${pass} | Failed: ${fail}`)
  console.log("============================================")
  if (fail > 0) {
    console.log("  SMOKE TEST FAILED — the stuck-welcome-tour bug is present or the app did not render.")
    process.exit(1)
  }
  console.log("  SMOKE TEST PASSED — app opens to the Dashboard with no blocking overlay.")
  process.exit(0)
})().catch((err) => {
  // Never wedge: always clean up and always print a controlled exit code.
  console.error("  [FAIL] Smoke test aborted:", err.message)
  try {
    spawnSync("taskkill", ["/IM", "ProFlow.exe", "/T", "/F"], { stdio: "ignore" })
  } catch {
    // already gone
  }
  console.log("")
  console.log("  SMOKE TEST FAILED — see error above.")
  process.exit(1)
})
