/**
 * Tiny, safe markdown-lite renderer for notes. HTML is escaped FIRST, so raw
 * HTML in a note renders as literal text — there is no XSS surface. Supports
 * the formatting the note editor toolbar can produce: headings, bold, italic,
 * inline code, bullet lists, task checklists, and dividers.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** Inline formatting applied to already-escaped text. */
function inline(escaped: string): string {
  return escaped
    // [[Note title]] wiki links — resolved to notes by the reader. This runs
    // FIRST so the captured name is the raw escaped text: if it ran after the
    // bold/italic/code passes, their injected <strong>/<em>/<code> tags would
    // leak into the data-note-title attribute and match no note. The visible
    // [[...]] text still gets formatted by the later passes.
    .replace(/\[\[([^\[\]]+)\]\]/g, (_m, name: string) => {
      return `<span class="pf-wiki" data-note-title="${name}" role="link" tabindex="0">[[${name}]]</span>`
    })
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
}

/**
 * Unique note titles referenced by [[wiki links]] in a note body, in order of
 * appearance. Used by the reader for the outgoing-links list and by every note
 * for backlink discovery.
 */
export function extractWikiLinks(src: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const m of src.matchAll(/\[\[([^\[\]]+)\]\]/g)) {
    const title = m[1].trim()
    if (title && !seen.has(title)) {
      seen.add(title)
      out.push(title)
    }
  }
  return out
}

const TASK_ITEM = /^\s*[-*]\s*\[([ xX])\]\s+(.+)$/
const BULLET_ITEM = /^[-*]\s+(.+)$/
const HEADING = /^(#{1,3})\s+(.+)$/
const DIVIDER = /^(-{3,}|\*{3,})$/

/** Render note body text to a safe HTML string. */
export function renderMarkdown(src: string): string {
  const out: string[] = []
  let para: string[] = []
  let list: "ul" | "task" | null = null

  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${para.map(inline).join("<br/>")}</p>`)
      para = []
    }
  }
  const closeList = () => {
    if (list === "ul") out.push("</ul>")
    if (list === "task") out.push("</ul>")
    list = null
  }

  for (const raw of src.split(/\r?\n/)) {
    const trimmed = raw.trim()
    if (!trimmed) {
      flushPara()
      closeList()
      continue
    }

    const task = trimmed.match(TASK_ITEM)
    if (task) {
      flushPara()
      if (list !== "task") {
        closeList()
        out.push('<ul class="pf-task-list">')
        list = "task"
      }
      const checked = task[1].toLowerCase() === "x"
      out.push(
        `<li><span class="pf-task-box${checked ? " checked" : ""}">${checked ? "✓" : ""}</span>${inline(escapeHtml(task[2]))}</li>`,
      )
      continue
    }

    const bullet = trimmed.match(BULLET_ITEM)
    if (bullet) {
      flushPara()
      if (list !== "ul") {
        closeList()
        out.push("<ul>")
        list = "ul"
      }
      out.push(`<li>${inline(escapeHtml(bullet[1]))}</li>`)
      continue
    }

    closeList()

    const heading = trimmed.match(HEADING)
    if (heading) {
      flushPara()
      const lvl = heading[1].length
      out.push(`<h${lvl}>${inline(escapeHtml(heading[2]))}</h${lvl}>`)
      continue
    }

    if (DIVIDER.test(trimmed)) {
      flushPara()
      out.push("<hr/>")
      continue
    }

    para.push(escapeHtml(trimmed))
  }

  flushPara()
  closeList()
  return out.join("\n")
}
