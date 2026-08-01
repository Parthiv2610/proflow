// End-to-end test of the Android APK "cap mode" linking flow.
//
// The APK (Capacitor WebView) does NOT load the app from the laptop — it loads
// the local bundle and syncs against the laptop's absolute LAN URL via
// lib/lan-sync.ts: lanPull()/lanPushSnapshot() fetch `${laptopUrl}/api/state`
// with an `X-ProFlow-Passcode` header. That is a CROSS-ORIGIN fetch (WebView
// origin vs. http://192.168.x.x:5174), so CORS preflight must pass too.
//
// Run: node .freebuff/test-cap-mode.js
const assert = require("assert")
const fs = require("fs")
const os = require("os")
const path = require("path")
const { startLanServer } = require("../electron/lan-server.js")

const PASSCODE = "654321"
const ORIGIN = "https://localhost" // Capacitor WebView origin (androidScheme https)

async function main() {
  const outDir = path.resolve("out")
  const stateFile = path.join(os.tmpdir(), "proflow-cap-test-lan-state.json")
  fs.rmSync(stateFile, { force: true })

  let remoteChanges = 0
  const lan = await startLanServer({
    port: 5199,
    outDir,
    stateFile,
    passcode: PASSCODE,
    onRemoteChange: () => remoteChanges++,
  })
  const base = `http://127.0.0.1:${lan.port}` // what the APK stores as its laptop URL
  const h = { "X-ProFlow-Passcode": PASSCODE, Origin: ORIGIN }

  console.log("\n=== CAP-MODE END-TO-END (fresh export + real LAN server) ===\n")

  console.log("1. Static index.html is served from the FRESH export (not a stub)")
  let res = await fetch(`${base}/`)
  assert.strictEqual(res.status, 200)
  assert.strictEqual(res.headers.get("x-proflow-lan"), "1")
  const html = await res.text()
  assert.ok(html.includes("self.__next_f"), "fresh export has RSC flight data")
  assert.ok(html.includes("ProFlow"), "fresh export has the app shell")
  console.log("   OK - fresh hydrated export served, x-proflow-lan header set")

  console.log("2. CORS preflight (OPTIONS) for the WebView origin passes")
  res = await fetch(`${base}/api/state`, {
    method: "OPTIONS",
    headers: {
      Origin: ORIGIN,
      "Access-Control-Request-Method": "GET",
      "Access-Control-Request-Headers": "content-type,x-proflow-passcode",
    },
  })
  assert.strictEqual(res.status, 204)
  assert.strictEqual(res.headers.get("access-control-allow-origin"), "*")
  // Header VALUES are case-preserved by undici — compare case-insensitively.
  assert.ok(
    (res.headers.get("access-control-allow-headers") || "")
      .toLowerCase()
      .includes("x-proflow-passcode"),
    "passcode header allowed",
  )
  // Chrome Private Network Access: localhost WebView -> private laptop IP needs
  // this header, or the real APK's fetch is blocked before CORS even applies.
  assert.strictEqual(
    res.headers.get("access-control-allow-private-network"),
    "true",
    "PNA allowed for localhost -> private-IP laptop",
  )
  console.log("   OK - CORS * + passcode header allowed + PNA true")

  console.log("3. GET /api/state without passcode -> 401 (APK not yet authed)")
  res = await fetch(`${base}/api/state`, { headers: { Origin: ORIGIN } })
  assert.strictEqual(res.status, 401)
  console.log("   OK - 401")

  console.log("4. GET with WRONG passcode -> 401 (submitLanPasscode -> 'wrong-code')")
  res = await fetch(`${base}/api/state`, {
    headers: { "X-ProFlow-Passcode": "000000", Origin: ORIGIN },
  })
  assert.strictEqual(res.status, 401)
  console.log("   OK - 401")

  console.log("5. GET with correct passcode -> snapshot (submitLanPasscode -> 'ok')")
  res = await fetch(`${base}/api/state`, { headers: h })
  assert.strictEqual(res.status, 200)
  const empty = await res.json()
  assert.deepStrictEqual(empty, { collections: {} })
  console.log("   OK - authed pull returns state")

  console.log("6. POST push from the APK (lanPushSnapshot) merges on the laptop")
  const snap = {
    collections: {
      tasks: { v: 42, items: [{ id: "t1", title: "Phone task", status: "todo" }] },
      habits: { v: 7, items: [] },
      userName: { v: 3, items: "Jordan" },
    },
  }
  res = await fetch(`${base}/api/state`, {
    method: "POST",
    headers: { ...h, "Content-Type": "application/json" },
    body: JSON.stringify(snap),
  })
  assert.strictEqual(res.status, 200)
  assert.strictEqual(remoteChanges, 1, "laptop UI is woken via onRemoteChange")
  console.log("   OK - pushed, onRemoteChange fired once")

  console.log("7. GET reflects the phone's pushed data (pull-back after push)")
  res = await fetch(`${base}/api/state`, { headers: h })
  const merged = await res.json()
  assert.strictEqual(merged.collections.tasks.items[0].title, "Phone task")
  assert.strictEqual(merged.collections.tasks.v, 42)
  assert.strictEqual(merged.collections.userName.items, "Jordan")
  console.log("   OK - laptop state now contains phone data")

  console.log("8. Last-write-wins: older laptop data does NOT clobber phone's newer data")
  await fetch(`${base}/api/state`, {
    method: "POST",
    headers: { ...h, "Content-Type": "application/json" },
    body: JSON.stringify({ collections: { tasks: { v: 10, items: [] } } }),
  })
  res = await fetch(`${base}/api/state`, { headers: h })
  const after = await res.json()
  assert.strictEqual(after.collections.tasks.items[0].title, "Phone task", "v42 won over v10")
  console.log("   OK - higher version wins (phone data preserved)")

  console.log("9. Newer laptop data DOES overwrite phone's data (v50 beats v42)")
  await fetch(`${base}/api/state`, {
    method: "POST",
    headers: { ...h, "Content-Type": "application/json" },
    body: JSON.stringify({ collections: { tasks: { v: 50, items: [{ id: "t9", title: "Laptop task" }] } } }),
  })
  res = await fetch(`${base}/api/state`, { headers: h })
  const after2 = await res.json()
  assert.strictEqual(after2.collections.tasks.items[0].title, "Laptop task")
  console.log("   OK - v50 won over v42")

  console.log("10. CORS on actual data responses (not just preflight)")
  res = await fetch(`${base}/api/state`, { headers: h })
  assert.strictEqual(res.headers.get("access-control-allow-origin"), "*")
  console.log("   OK - data responses are cross-origin readable by the WebView")

  await lan.stop()
  console.log("\n=== ALL 10 CAP-MODE CHECKS PASSED ===\n")
  console.log("The connect → passcode → pull → push → merge → LWW → CORS flow")
  console.log("works exactly as the APK's lib/lan-sync.ts expects.")
}

main().catch((e) => {
  console.error("\nCAP-MODE TEST FAILED:", e.message)
  process.exit(1)
})
