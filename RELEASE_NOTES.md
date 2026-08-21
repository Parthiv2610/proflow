# 🚀 ProFlow — Release Notes

> ℹ️ **Latest update (v3.1.0):** Full-featured checklists, habit reminder notifications, streak calendar, phone widgets, auto-delete completed tasks with 24h restore, and more.

---

## ✨ v3.1.0 — Checklists, reminders & widgets

### ✅ Checklists — full-featured checklist app built in
- **Unlimited checklists** with custom names, 30+ emoji icons, and 15 color options.
- **Items** with check/uncheck, priority (low/medium/high), due dates, notes, and **subtasks**.
- **Progress tracking** — per-list progress bar with percentage.
- **Sort & filter** — by priority, due date, alphabetical, or manual drag order.
- **Bulk actions** — select multiple items to check, uncheck, or delete.
- **20+ templates** — Grocery, Travel, Camping, Moving, Deep Clean, Project Launch, Wedding, Gym Workout, Tax Prep, Study Session, and more.
- **Pin, archive, duplicate** — organize your lists.
- **Search** across items, notes, and subtasks.

### 🔔 Habit reminder notifications (PC + mobile)
- **Per-habit reminder toggle** — set a time for each habit and get notified on scheduled days.
- **Desktop** — browser notifications via `setTimeout` when the app is open.
- **Android** — AlarmManager notifications via the native Reminders plugin, fires even when ProFlow is closed.

### 📅 Streak calendar replaces the old bar
- **Sidebar** — compact monthly calendar showing the strongest habit's streak with green (done), red (missed), and muted (rest) cells.
- **Dashboard** — full-size calendar with month navigation, color legend, and streak badge.
- Replaces the old 14-segment bar and the weekly schedule display.

### 📱 Home screen widgets (Android)
- **"Today at a Glance"** — 4×2 widget showing tasks done, habits done, focus time, and streak.
- **"Quick Add"** — 4×1 widget that opens the app for fast task entry.
- Data synced from the WebView via a new `WidgetBridge` Capacitor plugin + SharedPreferences.

### ♻️ Auto-delete completed tasks with 24h restore
- Completed tasks are **removed from the active list immediately** and moved to a "Recently done" pool.
- **Restore any task within 24 hours** from the "Recently done" tab — safe from misclicks.
- Tasks auto-expire after 24 hours.
- Dashboard, progress charts, and encouragement card all updated to reflect the new flow.

---

## ✨ v3.0.0 — Notes, connected

### 🔗 Wiki links & backlinks
- **`[[Note title]]`** anywhere in a note renders as a clickable link — tap it to jump straight to that note.
- **Linked notes panel** in the reader shows what this note links to (and flags missing targets) plus **backlinks** — every note that links here.

### 🕘 Version history
- Every save snapshots the previous version automatically (last 15 per note) — open **History** in the reader to restore any past version, and restoring is itself undoable.
- Smart caps keep localStorage safe: 300 snapshots total, consecutive identical saves don't duplicate.

### 🖨️ Print / Save as PDF
- Print button in the reader with a clean print stylesheet — just the note body, no app chrome. Pick "Save as PDF" from any print dialog.

### 🎙️ Voice notes
- **Mic button in the note editor** — record up to 60 seconds, auto-stops, preview with a built-in player.
- Android records natively (new `VoiceNotesPlugin`, system mic permission); desktop/web use the browser recorder. Recordings attach like any other file.

### 🛠️ Fixes
- **On-screen keyboard no longer hides form fields** — the Android app now resizes above the keyboard (`adjustResize`), so every input in dialogs stays visible while typing, on the APK and in mobile browsers too.
- **Task "category" option removed** — no more category picker when adding a task; the field is gone from the data model and the list (existing categories are simply no longer shown).
- **Momentum meter replaced by "Today at a glance"** — the dashboard's energy bar and 7-day trend strip are gone; a simple card now shows tasks done, habits done, and minutes focused today.
- **Note editor is now scrollable on short windows** — the Save button used to sit below the fold on small screens, unreachable; dialogs taller than the viewport now scroll.
- **Dashboard Habit Streak card is now honest** — the weekday strip used to fake a Mon→Sun pattern by filling bars with the streak length (ignoring the habit's real schedule and which days were actually done). It now shows the strongest habit's actual weekly schedule, with rest days muted, and reads "No habits yet" instead of "0/0" when you have none.
- **Progress Streak Calendar now counts habit check-ins** — it only counted focus sessions and completed tasks before, so checking a habit never lit a single cell (and the count read "0 active days" mid-streak). Today's habit checks now register on the heatmap.

---

## ✨ v2.2.0 — Work deeper, plan smarter

### 📝 Notes & Docs overhaul
- **Edit notes** — click any note (or the pencil) to change its title, body, and tag after creating it.
- **Full-screen reader** — click a note's title or preview to read it rendered: markdown formatting, full-size images, downloadable file chips, and one-tap Edit / Pin / Delete.
- **Uploads & attachments** — attach **images** (rendered inline) and **files** (downloadable chips) to any note. On Android, saving a file writes it to **Downloads** natively (MediaStore / system picker) — the WebView can't do browser downloads.
- **Markdown-lite editor** — format with `# headings`, `**bold**`, `*italic*`, `` `code` ``, `-` lists, `- [ ]` checklists and `---` dividers, with a live **Preview** toggle.
- **Search** notes by title, body, or tag.
- **Pin** notes to the top, **custom tags** beyond the preset list, and a word count as you type.

### 🔁 Recurring tasks (weekly & monthly)
- Mark a task **Weekly** or **Monthly** when you create it.
- Completing a recurring task rolls it forward automatically: same title/project/priority, due date advanced **+7 days** or **+1 month**, ready for the next occurrence.
- Repeats show a 🔁 badge in the task list and each completion earns XP.

### 🌗 Light & dark mode
- New **Appearance** setting in Settings — switch between dark and light instantly, in both the desktop app and the APK. Accent colors work in both modes.

### 🔔 Android OS reminders
- The APK now schedules **real system notifications** before today's timed calendar events (5 minutes early), powered by a native AlarmManager plugin — they fire even when ProFlow is closed.
- Controlled by the new **"Android event reminders"** preference; the app asks for notification permission once.

---

## 📱 ProFlow on Android (APK)
- **A proper Android app** — same ProFlow experience as the desktop, built as a signed release APK with the ProFlow launcher icon.
- **Bottom tab bar** — Home, Tasks, Calendar, and Settings tabs pinned at the bottom of the phone screen for one-thumb navigation (fast alternative to the sidebar drawer).
- **Mobile sidebar drawer** — the ☰ hamburger slides the full navigation in from the left, with a blurred backdrop.

### 🎛️ Settings Rebuild
- **All-new iOS-style toggle switches** — white knob on a colored track, clear ON/OFF states (the old switches were hard to see in dark mode).
- **"Clear all data" reset** — a red danger zone at the bottom of Settings that wipes every task, habit, note, event, goal, and setting on the device and starts fresh. Two-step confirm so you can't tap it by accident.

### 🖥️ Smarter Desktop Layout
- **Sidebar adapts to any window size**: opens by default on large screens, **collapses by default on smaller laptop windows**, and turns into a slide-in drawer on phones.
- **Desktop hamburger** — toggle the sidebar at any size with the ☰ button in the top bar.

---

## 🔧 Fixes & Polish

- Fixed the Settings toggle switch being nearly invisible on dark backgrounds.
- Welcome-tour, calendar, and timer fixes carried forward from v2.0.0.
- Fresh-from-source CI builds for both the installer **and** the APK, with hydration guards so the blank-screen bug can never ship again.

---

## 📥 Downloads

| Platform | File |
|----------|------|
| **Windows** | `ProFlow-Setup-3.0.0.exe` (NSIS installer — installs to Program Files, Add/Remove Programs support) |
| **Android** | `app-release.apk` (signed release — install on any phone; allow "install from unknown sources") |

---

<details>
<summary><b>Full changelog (v2.0.0 → v2.1.0)</b></summary>

- Add Capacitor Android app with signed release build, ProFlow icon, v2.1.0 branding
- Add phone bottom tab bar: Home / Tasks / Calendar / Settings
- Add mobile sidebar drawer + always-visible hamburger
- Make the desktop sidebar responsive: open on large screens, collapsed by default on smaller laptop windows, drawer on phones
- Redesign Settings toggle switches (iOS-style, high contrast)
- Add "Clear all data" reset (wipes every `proflow-*` key + in-memory state)
- Add CI workflows that build the installer and APK from the same release tag
- Add cap-mode end-to-end test and `clean.bat`

</details>
