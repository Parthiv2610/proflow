// ProFlow LAN Sync Server
// -------------------------
// Exposes a tiny sync API so the ProFlow Android app (APK) on the same Wi-Fi
// can share data with this laptop — no accounts, no internet. NATIVE APPS
// ONLY: the laptop EXE talks over IPC, the phone APK over HTTP. Browsers are
// deliberately not supported — they get a small notice instead of the web app,
// and the API rejects any request without the native-client marker header.
// Pure Node (no Electron imports) so it can be unit-tested standalone.
//
// API:
//   GET  /api/info          -> { lan: true, host, ip, port }   (client marker)
//   GET  /api/state         -> { collections: {...} }          (marker + passcode)
//   POST /api/state         -> merge snapshot (marker + passcode)
//   anything else           -> native-app-only notice (never the web app)
//
// Auth: every request must send `X-ProFlow-Client: proflow-cap` — the marker
// only the native APK sends. Every /api/state call must ALSO send
// `X-ProFlow-Passcode: <code>`. An empty passcode means "no passcode required".

const http = require("http")
const fs = require("fs")
const path = require("path")
const os = require("os")

const MAX_BODY = 10 * 1024 * 1024 // 10 MB state snapshots

// LAN sync is native-app-only. The Android APK (Capacitor WebView) sends this
// marker header on every request; the laptop EXE talks over IPC instead.
// Browsers never send it, so they're rejected before passcode auth even
// applies — a browser can neither load the app nor call the sync API.
const CLIENT_HEADER = "x-proflow-client"
const CLIENT_VALUE = "proflow-cap"

const isNativeClient = (req) => req.headers[CLIENT_HEADER] === CLIENT_VALUE

// What a browser visiting the laptop's LAN address sees — a short notice, and
// nothing else. The web app is never served over the network.
const NOTICE_HTML = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ProFlow</title>
<style>body{font-family:system-ui,sans-serif;background:#120d1f;color:#e7e2f5;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center}div{max-width:420px;padding:24px}h1{font-size:22px;margin:0 0 8px}p{font-size:14px;line-height:1.5;color:#b6aed0;margin:0}</style>
</head>
<body><div><h1>ProFlow</h1><p>This is a ProFlow LAN-sync endpoint. Open the ProFlow app on your phone (Settings → LAN Sync) and enter the address shown on your laptop to connect.</p></div></body></html>`

// Adapter names that are almost never the Wi-Fi/LAN a phone could reach:
// virtual machines, containers, VPNs and tunnel adapters. Windows names
// them e.g. "vEthernet (WSL)", "VMware Network Adapter VMnet8",
// "Ethernet 2" (Tailscale), "TAP-Windows Adapter V9", etc.
const VIRTUAL_ADAPTER = /vmware|virtualbox|vethernet|wsl|docker|hyper-v|tailscale|zerotier|hamachi|nord|openvpn|wireguard|tap-|tun-|vpn|bluetooth|loopback/i

/**
 * All plausible LAN IPv4 addresses of this machine, most-likely-reachable first.
 * Filters out virtual/container/VPN adapters and sorts so a real Wi-Fi/LAN IP
 * (192.168.x.x / 10.x.x.x / 172.16-31.x.x) comes before anything exotic — a
 * laptop with Docker/WSL/VMware installed used to report a fake adapter IP as
 * its first address, so the phone could never reach it.
 */
function getLanIPs() {
  const nets = os.networkInterfaces()
  const candidates = []
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family !== "IPv4" || net.internal) continue
      if (net.address.startsWith("169.254")) continue // link-local, unroutable
      candidates.push({ name, address: net.address })
    }
  }
  const isVirtual = (c) => VIRTUAL_ADAPTER.test(c.name)
  const isPrivate = (c) =>
    /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(c.address)
  // Real private LAN IPs on physical adapters first, then private on any
  // adapter, then everything else (public / unusual).
  const score = (c) =>
    (isVirtual(c) ? 8 : 0) + (!isPrivate(c) ? 4 : 0) + (c.address.startsWith("192.168.") ? -1 : 0)
  candidates.sort((a, b) => score(a) - score(b))
  // NOTE: os.networkInterfaces() also reports configured IPv4s of disconnected
  // adapters, so the first entry is a best-guess, not a guarantee. The UI shows
  // every candidate so the user can try an alternate address if the top one
  // isn't on their real Wi-Fi.
  return candidates.map((c) => c.address)
}

/** A fresh 6-digit passcode. */
function generatePasscode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

// Collections that can't use plain last-write-wins because both devices can
// legitimately change them at the same time:
//   - xpEvents / shieldEvents: event ledgers — union by id, so simultaneous
//     earns on both devices are ALL kept (nothing lost) and each event is
//     counted exactly once (never double-counted, since ids dedupe).
//   - achievements: grow-only map (id → earned date) — union by key.
//   - bestStreak / lastShieldMilestone: monotonic numbers — take the max.
const GROW_ONLY_KEYS = new Set([
  "xpEvents",
  "shieldEvents",
  "achievements",
  "bestStreak",
  "lastShieldMilestone",
])

/** Union-merge one grow-only collection (each is {v, items}). */
function mergeGrowOnly(key, current, incoming) {
  const v = Math.max(current.v || 0, incoming.v || 0)
  if (key === "bestStreak" || key === "lastShieldMilestone") {
    return { v, items: Math.max(Number(current.items) || 0, Number(incoming.items) || 0) }
  }
  if (key === "achievements") {
    return { v, items: { ...(current.items || {}), ...(incoming.items || {}) } }
  }
  // xpEvents / shieldEvents — event ledgers: union by item id, larger amount
  // wins on a conflict (e.g. two devices each seeding their pre-sync balance).
  const byId = new Map()
  for (const x of [...(current.items || []), ...(incoming.items || [])]) {
    if (!x || x.id == null) continue
    const prev = byId.get(x.id)
    if (!prev || (Number(x.amount) || 0) > (Number(prev.amount) || 0)) byId.set(x.id, x)
  }
  return { v, items: [...byId.values()] }
}

/**
 * Merge an incoming snapshot into the current state.
 * Per-collection last-write-wins: the collection with the higher `v` wins;
 * on a tie the incoming copy wins (it is the freshest write). The grow-only
 * collections above bypass LWW and merge instead.
 */
function mergeState(current, incoming) {
  const cur = current && current.collections ? current.collections : {}
  const inc = incoming && incoming.collections ? incoming.collections : {}
  const merged = {}
  for (const key of new Set([...Object.keys(cur), ...Object.keys(inc)])) {
    const c = cur[key]
    const i = inc[key]
    if (!c) merged[key] = i
    else if (!i) merged[key] = c
    else if (GROW_ONLY_KEYS.has(key)) merged[key] = mergeGrowOnly(key, c, i)
    else merged[key] = i.v >= c.v ? i : c
  }
  return { collections: merged }
}

/**
 * Start the LAN server.
 *
 * @param {object} opts
 * @param {number} opts.port        preferred port (bumps up if taken)
 * @param {string} opts.outDir      kept for API compatibility (no longer served)
 * @param {string} opts.stateFile   JSON file persisting {passcode, data}
 * @param {string} opts.passcode    passcode to require ("" = none)
 * @param {(state: object) => void} [opts.onRemoteChange] called when a POST
 *                                  merges in data (used to wake the laptop UI)
 * @returns {Promise<{stop: () => Promise<void>, port: number, passcode: string, setPasscode: (p: string) => void}>}
 */
function startLanServer(opts) {
  return new Promise((resolve, reject) => {
    const stateFile = opts.stateFile
    const passcodeRef = { current: opts.passcode || "" }
    const ip = getLanIPs()[0] || "localhost"

    let data = { collections: {} }

    const loadState = () => {
      try {
        const raw = fs.readFileSync(stateFile, "utf-8")
        const parsed = JSON.parse(raw)
        if (parsed && parsed.data && parsed.data.collections) {
          data = parsed.data
        }
      } catch {
        // first run — start empty
      }
    }

    const persist = () => {
      try {
        fs.mkdirSync(path.dirname(stateFile), { recursive: true })
        fs.writeFileSync(stateFile, JSON.stringify({ passcode: passcodeRef.current, data }))
      } catch {
        // storage unavailable — keep running in-memory
      }
    }

    loadState()

    const authorized = (req) =>
      !passcodeRef.current || req.headers["x-proflow-passcode"] === passcodeRef.current

    const sendJSON = (res, code, obj, extraHeaders = {}) => {
      const body = JSON.stringify(obj)
      res.writeHead(code, {
        "Content-Type": "application/json; charset=utf-8",
        "X-ProFlow-Lan": "1",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
        ...extraHeaders,
      })
      res.end(body)
    }

    const readBody = (req) =>
      new Promise((resolve, reject) => {
        const chunks = []
        let size = 0
        req.on("data", (c) => {
          size += c.length
          if (size > MAX_BODY) {
            reject(new Error("body too large"))
            req.destroy()
            return
          }
          chunks.push(c)
        })
        req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")))
        req.on("error", reject)
      })

    const server = http.createServer(async (req, res) => {
      // CORS preflight
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-ProFlow-Passcode, X-ProFlow-Client",
          "Access-Control-Allow-Private-Network": "true",
          "Access-Control-Max-Age": "86400",
        })
        res.end()
        return
      }

      let url
      try {
        url = new URL(req.url, `http://${req.headers.host || "localhost"}`)
      } catch {
        sendJSON(res, 400, { error: "bad url" })
        return
      }

      // The sync API is reserved for the native Android app. Browsers get 403.
      if (!isNativeClient(req)) {
        if (url.pathname.startsWith("/api/")) {
          sendJSON(res, 403, { error: "native-app-only" })
          return
        }
        // Non-API paths: a small notice, never the web app.
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "X-ProFlow-Lan": "1",
          "Cache-Control": "no-store",
        })
        res.end(NOTICE_HTML)
        return
      }

      if (url.pathname === "/api/info") {
        sendJSON(res, 200, { lan: true, host: os.hostname(), ip, port: server.address().port })
        return
      }

      if (url.pathname === "/api/state") {
        if (!authorized(req)) {
          sendJSON(res, 401, { error: "invalid passcode" })
          return
        }
        if (req.method === "GET") {
          sendJSON(res, 200, data)
          return
        }
        if (req.method === "POST") {
          let body
          try {
            body = await readBody(req)
          } catch {
            sendJSON(res, 413, { error: "body too large" })
            return
          }
          let incoming
          try {
            incoming = JSON.parse(body)
          } catch {
            sendJSON(res, 400, { error: "invalid json" })
            return
          }
          const before = JSON.stringify(data.collections)
          data = mergeState(data, incoming)
          persist()
          if (JSON.stringify(data.collections) !== before) {
            try {
              opts.onRemoteChange && opts.onRemoteChange(data)
            } catch {
              // renderer disconnected — ignore
            }
          }
          sendJSON(res, 200, { ok: true })
          return
        }
        sendJSON(res, 405, { error: "method not allowed" })
        return
      }

      // Everything else (even a native client asking for the app): a notice,
      // never the web app — LAN sync is laptop-EXE ↔ phone-APK only.
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "X-ProFlow-Lan": "1",
        "Cache-Control": "no-store",
      })
      res.end(NOTICE_HTML)
    })

    const attemptListen = (port, triesLeft) => {
      server.once("error", (err) => {
        if (err.code === "EADDRINUSE" && triesLeft > 0) {
          attemptListen(port + 1, triesLeft - 1)
        } else {
          reject(err)
        }
      })
      server.listen(port, "0.0.0.0", () => resolve(handle))
    }

    const handle = {
      get port() {
        return server.address().port
      },
      get passcode() {
        return passcodeRef.current
      },
      setPasscode(p) {
        passcodeRef.current = p || ""
        persist()
      },
      /** Merge a snapshot pushed by the laptop's own renderer (persists, no broadcast). */
      mergeIncoming(snapshot) {
        const before = JSON.stringify(data.collections)
        data = mergeState(data, snapshot)
        persist()
        return JSON.stringify(data.collections) !== before
      },
      stop() {
        return new Promise((res) => {
          try {
            server.close(() => res())
          } catch {
            res()
          }
        })
      },
    }

    attemptListen(opts.port, 10)
  })
}

module.exports = { startLanServer, getLanIPs, generatePasscode, mergeState }
