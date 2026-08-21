# 🚀 ProFlow v3.0.0 — Notes, connected

Your notes are now a real knowledge base — wiki-link them together, restore any past version, print them, or record voice notes, right from the app.

## ✨ What's New

### 🔗 Wiki links & backlinks
- Type **`[[Note title]]`** anywhere in a note and it becomes a clickable link — tap it to jump straight to that note.
- The **Linked notes panel** in the reader shows what a note links to (flagging missing targets) plus **backlinks** — every note that links back here.

### 🕘 Version history
- Every save automatically snapshots the previous version (last 15 per note) — open **History** in the reader to restore any past version, and restoring is itself undoable.
- Smart caps keep localStorage safe: 300 snapshots total, and consecutive identical saves don't duplicate.

### 🖨️ Print / Save as PDF
- Print button in the reader with a clean print stylesheet — just the note body, no app chrome. Pick "Save as PDF" from any print dialog.

### 🎙️ Voice notes
- **Mic button in the note editor** — record up to 60 seconds, auto-stop, and preview with a built-in player.
- Android records natively (system mic permission); desktop/web use the browser recorder. Recordings attach like any other file.

## 🛠️ Fixes & cleanup

- **On-screen keyboard no longer hides form fields** — the Android app now resizes above the keyboard, so every input in dialogs stays visible while typing (on the APK *and* in mobile browsers).
- **Task "category" option removed** — cleaner task creation; the category field is gone from the data model and the task list.
- **Momentum meter replaced by "Today at a glance"** — the dashboard's energy bar is gone; a simple card now shows tasks done, habits done, and minutes focused today.
- **Dashboard Habit Streak card is now honest** — it shows the strongest habit's real weekly schedule with rest days muted instead of a fake Mon→Sun fill.
- **Progress Streak Calendar counts habit check-ins** — today's habit checks now light up the heatmap.
- **Note editor is scrollable on short windows** — the Save button no longer sits unreachable below the fold.

## 📥 Downloads

| Platform | File |
|----------|------|
| **Windows** | `ProFlow-Setup-3.0.0.exe` (NSIS installer — installs to Program Files, Add/Remove Programs support) |
| **Android** | `app-release.apk` (signed release — install on any phone; allow "install from unknown sources") |

**Already installed?** ProFlow updates itself in place — the app checks for this release and installs it silently.

## 🧪 System Requirements

- **Windows:** 10 or 11 (x64)
- **Android:** 8.0+ (signed APK)
