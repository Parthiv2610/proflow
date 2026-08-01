// ProFlow LAN Sync Server
// -------------------------
// Serves the built web app (out/) over WiFi AND exposes a tiny sync API so a
// phone on the same network can share data with this laptop — no accounts,
// no internet. Pure Node (no Electron imports) so it can be unit-tested
// standalone.
//
// API:
//   GET  /api/info          -> { lan: true, host, ip, port }   (no auth)
//   GET  /api/state         -> { collections: {...} }          (passcode)
//   POST /api/state         -> merge snapshot (passcode)
//   anything else           -> static files from out/, index.html fallback
//
// Auth: every /api/state call must send `X-ProFlow-Passcode: <code>`.
// An empty passcode means "no passcode required".

const http = require("http")
const fs = require("fs")
const path = require("path")
const os = require("os")

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".xml": "text/xml; charset=utf-8",
}

const MAX_BODY = 10 * 1024 * 1024 // 10 MB state snapshots

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

/**
 * Merge an incoming snapshot into the current state.
 * Per-collection last-write-wins: the collection with the higher `v` wins;
 * on a tie the incoming copy wins (it is the freshest write).
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
    else merged[key] = i.v >= c.v ? i : c
  }
  return { collections: merged }
}

/**
 * Start the LAN server.
 *
 * @param {object} opts
 * @param {number} opts.port        preferred port (bumps up if taken)
 * @param {string} opts.outDir      directory with the built web app
 * @param {string} opts.stateFile   JSON file persisting {passcode, data}
 * @param {string} opts.passcode    passcode to require ("" = none)
 * @param {(state: object) => void} [opts.onRemoteChange] called when a POST
 *                                  merges in data (used to wake the laptop UI)
 * @returns {Promise<{stop: () => Promise<void>, port: number, passcode: string, setPasscode: (p: string) => void}>}
 */
function startLanServer(opts) {
  return new Promise((resolve, reject) => {
    // Resolve once so the traversal guard works with absolute or relative paths.
    const outDir = path.resolve(opts.outDir)
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

    const resolvedOut = path.resolve(outDir)
    const serveStatic = (req, res, url) => {
      let filePath
      try {
        const decoded = decodeURIComponent(url.pathname)
        const rel = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "")
        // Reject any traversal segment outright.
        if (rel.split("/").some((p) => p === "..")) {
          sendJSON(res, 403, { error: "forbidden" })
          return
        }
        filePath = path.normalize(path.join(outDir, rel))
      } catch {
        sendJSON(res, 400, { error: "bad path" })
        return
      }
      // Path-traversal guard: resolved path must stay inside outDir (prefix+sep,
      // not a bare prefix — otherwise a sibling "out_evil" directory would pass).
      if (!filePath.startsWith(resolvedOut + path.sep) && filePath !== resolvedOut) {
        sendJSON(res, 403, { error: "forbidden" })
        return
      }
      let target = filePath
      try {
        if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) {
          // SPA fallback — unknown routes render the app shell.
          target = path.join(outDir, "index.html")
        }
        const body = fs.readFileSync(target)
        const ext = path.extname(target).toLowerCase()
        res.writeHead(200, {
          "Content-Type": MIME[ext] || "application/octet-stream",
          "X-ProFlow-Lan": "1",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=0",
        })
        res.end(body)
      } catch {
        sendJSON(res, 404, { error: "not found" })
      }
    }

    const server = http.createServer(async (req, res) => {
      // CORS preflight
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-ProFlow-Passcode",
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

      // Static files
      serveStatic(req, res, url)
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
