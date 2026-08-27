/**
 * GitHub Sync — stores all ProFlow data in a private GitHub repo file.
 *
 * How it works:
 *  1. User creates a GitHub Personal Access Token (classic) with `repo` scope
 *  2. User enters the token + repo name in Settings → Sync
 *  3. On "Push", we serialise all `proflow-*` localStorage keys into a JSON blob
 *     and PUT it to `proflow-sync.json` on the `master` branch.
 *  4. On "Pull", we GET that file and merge it back into localStorage.
 *  5. Auto-sync can be enabled to pull on startup and push on data changes.
 */

const SYNC_PATH = "proflow-sync.json"

export type SyncStatus = "idle" | "pushing" | "pulling" | "error" | "synced"
export type SyncInfo = { lastSync: string | null; error: string | null; status: SyncStatus }

// ── Local storage helpers ──

export function collectAllData(): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith("proflow-")) {
        const raw = localStorage.getItem(k)
        if (raw !== null) {
          try {
            data[k.slice("proflow-".length)] = JSON.parse(raw)
          } catch {
            data[k.slice("proflow-".length)] = raw
          }
        }
      }
    }
  } catch {}
  return data
}

export function applyData(data: Record<string, unknown>) {
  for (const [key, value] of Object.entries(data)) {
    try {
      localStorage.setItem("proflow-" + key, JSON.stringify(value))
    } catch {}
  }
}

// ── GitHub API ──

function headers(token: string) {
  return {
    Authorization: `token ${token}`,
    Accept: "application/vnd.github.v3+json",
    "Content-Type": "application/json",
  }
}

async function getFile(
  token: string,
  repo: string,
): Promise<{ sha: string; content: Record<string, unknown> } | null> {
  const url = `https://api.github.com/repos/${repo}/contents/${SYNC_PATH}`
  const res = await fetch(url, { headers: headers(token) })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`GitHub GET failed: ${res.status} ${res.statusText}`)
  const json = await res.json()
  const decoded = atob(json.content.replace(/\n/g, ""))
  return { sha: json.sha, content: JSON.parse(decoded).data ?? {} }
}

async function putFile(
  token: string,
  repo: string,
  data: Record<string, unknown>,
  sha: string | null,
) {
  const body: Record<string, unknown> = {
    message: `ProFlow sync ${new Date().toISOString()}`,
    content: btoa(
      JSON.stringify(
        { format: "proflow-sync", version: 1, syncedAt: new Date().toISOString(), data },
        null,
        2,
      ),
    ),
    branch: "master",
  }
  if (sha) body.sha = sha

  const url = `https://api.github.com/repos/${repo}/contents/${SYNC_PATH}`
  const res = await fetch(url, {
    method: "PUT",
    headers: headers(token),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `GitHub PUT failed: ${res.status}`)
  }
}

// ── Public API ──

export async function pushToGitHub(
  token: string,
  repo: string,
): Promise<SyncInfo> {
  try {
    const data = collectAllData()
    const existing = await getFile(token, repo)
    await putFile(token, repo, data, existing?.sha ?? null)
    const now = new Date().toISOString()
    localStorage.setItem("proflow-sync-lastSync", now)
    return { lastSync: now, error: null, status: "synced" }
  } catch (e: any) {
    return {
      lastSync: localStorage.getItem("proflow-sync-lastSync"),
      error: e.message || "Unknown error",
      status: "error",
    }
  }
}

export async function pullFromGitHub(
  token: string,
  repo: string,
): Promise<SyncInfo> {
  try {
    const existing = await getFile(token, repo)
    if (existing) {
      applyData(existing.content)
    }
    const now = new Date().toISOString()
    localStorage.setItem("proflow-sync-lastSync", now)
    return { lastSync: now, error: null, status: "synced" }
  } catch (e: any) {
    return {
      lastSync: localStorage.getItem("proflow-sync-lastSync"),
      error: e.message || "Unknown error",
      status: "error",
    }
  }
}

export function getSyncConfig() {
  return {
    token: localStorage.getItem("proflow-sync-token") || "",
    repo: localStorage.getItem("proflow-sync-repo") || "",
    lastSync: localStorage.getItem("proflow-sync-lastSync"),
    autoSync: localStorage.getItem("proflow-sync-auto") === "true",
  }
}

export function setSyncConfig(config: {
  token?: string
  repo?: string
  autoSync?: boolean
}) {
  if (config.token !== undefined) localStorage.setItem("proflow-sync-token", config.token)
  if (config.repo !== undefined) localStorage.setItem("proflow-sync-repo", config.repo)
  if (config.autoSync !== undefined) localStorage.setItem("proflow-sync-auto", String(config.autoSync))
}

export function clearSyncConfig() {
  localStorage.removeItem("proflow-sync-token")
  localStorage.removeItem("proflow-sync-repo")
  localStorage.removeItem("proflow-sync-lastSync")
  localStorage.removeItem("proflow-sync-auto")
}
