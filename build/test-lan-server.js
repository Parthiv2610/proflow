// Standalone test for electron/lan-server.js — run with plain Node:
//   node build/test-lan-server.js
const assert = require("assert")
const fs = require("fs")
const os = require("os")
const path = require("path")
const { startLanServer } = require("../electron/lan-server.js")

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "proflow-lan-test-"))
  const outDir = path.join(tmp, "out")
  const stateFile = path.join(tmp, "state", "lan-state.json")
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, "index.html"), "<html><body>ProFlow test</body></html>")

  let remoteChanges = 0
  const lan = await startLanServer({
    port: 5714,
    outDir,
    stateFile,
    passcode: "123456",
    onRemoteChange: () => remoteChanges++,
  })
  const base = `http://127.0.0.1:${lan.port}`
  const headers = { "X-ProFlow-Passcode": "123456" }

  console.log("1. static index.html + LAN header")
  let res = await fetch(`${base}/`)
  assert.strictEqual(res.headers.get("x-proflow-lan"), "1")
  assert.ok((await res.text()).includes("ProFlow test"))

  console.log("2. /api/info identifies the LAN server")
  res = await fetch(`${base}/api/info`)
  assert.strictEqual(res.headers.get("x-proflow-lan"), "1")
  const info = await res.json()
  assert.strictEqual(info.lan, true)

  console.log("3. /api/state without passcode -> 401")
  res = await fetch(`${base}/api/state`)
  assert.strictEqual(res.status, 401)

  console.log("4. /api/state with wrong passcode -> 401")
  res = await fetch(`${base}/api/state`, { headers: { "X-ProFlow-Passcode": "000000" } })
  assert.strictEqual(res.status, 401)

  console.log("5. authed GET returns empty state")
  res = await fetch(`${base}/api/state`, { headers })
  assert.strictEqual(res.status, 200)
  let state = await res.json()
  assert.deepStrictEqual(state, { collections: {} })

  console.log("6. POST snapshot -> merged + onRemoteChange fires")
  res = await fetch(`${base}/api/state`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      collections: {
        tasks: { v: 100, items: [{ id: "t1", title: "Buy milk" }] },
        habits: { v: 50, items: [] },
      },
    }),
  })
  assert.strictEqual(res.status, 200)
  assert.strictEqual(remoteChanges, 1)

  console.log("7. GET reflects the merge")
  res = await fetch(`${base}/api/state`, { headers })
  state = await res.json()
  assert.strictEqual(state.collections.tasks.items[0].title, "Buy milk")
  assert.strictEqual(state.collections.tasks.v, 100)

  console.log("8. older version does NOT clobber newer data")
  await fetch(`${base}/api/state`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ collections: { tasks: { v: 50, items: [] } } }),
  })
  res = await fetch(`${base}/api/state`, { headers })
  state = await res.json()
  assert.strictEqual(state.collections.tasks.items[0].title, "Buy milk")

  console.log("9. newer phone edit wins, other collections untouched")
  await fetch(`${base}/api/state`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      collections: { tasks: { v: 200, items: [{ id: "t1", title: "Buy milk + eggs" }] } },
    }),
  })
  res = await fetch(`${base}/api/state`, { headers })
  state = await res.json()
  assert.strictEqual(state.collections.tasks.items[0].title, "Buy milk + eggs")
  assert.strictEqual(state.collections.habits.v, 50)

  console.log("10. state persisted to file (survives restart)")
  assert.ok(fs.existsSync(stateFile))
  const persisted = JSON.parse(fs.readFileSync(stateFile, "utf-8"))
  assert.strictEqual(persisted.data.collections.tasks.v, 200)
  assert.strictEqual(persisted.passcode, "123456")

  console.log("11. path traversal blocked")
  res = await fetch(`${base}/..%2f..%2f..%2fWindows%2fwin.ini`)
  assert.ok([400, 403, 404].includes(res.status))

  console.log("12. mergeIncoming (laptop push) persists without broadcast")
  const changed = lan.mergeIncoming({
    collections: { notes: { v: 300, items: [{ id: "n1" }] } },
  })
  assert.strictEqual(changed, true)
  const beforeCount = remoteChanges
  await fetch(`${base}/api/state`, { headers })
  assert.strictEqual(remoteChanges, beforeCount) // no extra broadcast
  res = await fetch(`${base}/api/state`, { headers })
  state = await res.json()
  assert.strictEqual(state.collections.notes.v, 300)

  await lan.stop()
  console.log("\n✅ ALL LAN SERVER TESTS PASSED")
  process.exit(0)
}

main().catch((err) => {
  console.error("\n❌ TEST FAILED:", err.message)
  process.exit(1)
})
