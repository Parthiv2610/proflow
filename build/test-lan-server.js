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

  const post = (collections) =>
    fetch(`${base}/api/state`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ collections }),
    })

  console.log("13. xpEvents merge as a UNION — simultaneous earns are all kept, never double-counted")
  // Laptop earns +10; phone earns +5 at the same time. Both must survive.
  await post({ xpEvents: { v: 400, items: [{ id: "xp-a", amount: 10 }, { id: "seed", amount: 500 }] } })
  await post({ xpEvents: { v: 500, items: [{ id: "xp-b", amount: 5 }, { id: "xp-a", amount: 10 }] } })
  res = await fetch(`${base}/api/state`, { headers })
  state = await res.json()
  const xpEvents = state.collections.xpEvents.items
  assert.strictEqual(xpEvents.length, 3, "seed + both earns survive")
  const byId = Object.fromEntries(xpEvents.map((e) => [e.id, e.amount]))
  assert.strictEqual(byId["xp-a"], 10)
  assert.strictEqual(byId["xp-b"], 5)
  assert.strictEqual(byId["seed"], 500)
  assert.strictEqual(state.collections.xpEvents.v, 500, "version is the max of both pushes")

  console.log("14. same event id echoed twice is deduped (never double-counted)")
  await post({ xpEvents: { v: 600, items: [{ id: "xp-a", amount: 10 }, { id: "xp-b", amount: 5 }] } })
  res = await fetch(`${base}/api/state`, { headers })
  state = await res.json()
  assert.strictEqual(state.collections.xpEvents.items.length, 3, "echo of existing events adds nothing")

  console.log("15. conflicting seed ids keep the LARGER balance (pre-sync migration)")
  await post({ xpEvents: { v: 700, items: [{ id: "seed", amount: 320 }] } })
  res = await fetch(`${base}/api/state`, { headers })
  state = await res.json()
  const seed = state.collections.xpEvents.items.find((e) => e.id === "seed")
  assert.strictEqual(seed.amount, 500, "larger pre-sync balance wins")

  console.log("16. shieldEvents union dedupes deterministic use events (no double consumption)")
  const useEvent = { id: "use:2026-08-01:h1", amount: -1 }
  await post({ shieldEvents: { v: 100, items: [useEvent] } })
  await post({ shieldEvents: { v: 200, items: [useEvent, { id: "buy-1", amount: 1 }] } })
  res = await fetch(`${base}/api/state`, { headers })
  state = await res.json()
  const shieldEvents = state.collections.shieldEvents.items
  assert.strictEqual(shieldEvents.length, 2, "both devices' use of the same missed day dedupes")
  assert.ok(shieldEvents.some((e) => e.id === "buy-1"))

  console.log("17. achievements merge as a grow-only map (badges from both devices kept)")
  await post({ achievements: { v: 100, items: { "streak-3": "2026-08-01" } } })
  await post({ achievements: { v: 200, items: { "tasks-10": "2026-08-02" } } })
  res = await fetch(`${base}/api/state`, { headers })
  state = await res.json()
  assert.deepStrictEqual(state.collections.achievements.items, {
    "streak-3": "2026-08-01",
    "tasks-10": "2026-08-02",
  })

  console.log("18. bestStreak & lastShieldMilestone merge by MAX (monotonic)")
  await post({ bestStreak: { v: 100, items: 21 }, lastShieldMilestone: { v: 100, items: 5 } })
  await post({ bestStreak: { v: 200, items: 14 }, lastShieldMilestone: { v: 200, items: 10 } })
  res = await fetch(`${base}/api/state`, { headers })
  state = await res.json()
  assert.strictEqual(state.collections.bestStreak.items, 21, "max wins even when the lower one is newer")
  assert.strictEqual(state.collections.lastShieldMilestone.items, 10)

  console.log("19. non-grow-only collections still last-write-wins")
  await post({ lastHabitCheck: { v: 100, items: "2026-08-01" } })
  await post({ lastHabitCheck: { v: 50, items: "2026-07-01" } })
  res = await fetch(`${base}/api/state`, { headers })
  state = await res.json()
  assert.strictEqual(state.collections.lastHabitCheck.items, "2026-08-01", "newer version wins for LWW keys")

  await lan.stop()
  console.log("\n✅ ALL LAN SERVER TESTS PASSED")
  process.exit(0)
}

main().catch((err) => {
  console.error("\n❌ TEST FAILED:", err.message)
  process.exit(1)
})
