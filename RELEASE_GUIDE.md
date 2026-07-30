# 🚀 ProFlow v2.0.0 — GitHub Release Guide

This guide walks you through creating a GitHub Release with the signed installer.

---

## Step 1 — Go to GitHub Releases

1. Open: **[https://github.com/parth-kulkarni1/pro-flow/releases/new](https://github.com/parth-kulkarni1/pro-flow/releases/new)**
2. Sign in to GitHub if prompted

---

## Step 2 — Fill out the release form

| Field | Value |
|-------|-------|
| **Tag version** | `v2.0.0` |
| **Release title** | `ProFlow v2.0.0 — Animations, Calendar Drag-Drop, Color Picker & More` |
| **Target branch** | `main` |

---

## Step 3 — Paste the release notes

Copy and paste the entire block below into the release description box:

```markdown
## ✨ What's New in v2.0.0

### 🎬 Navigation & UX
- **Page view animations** — every view switch fades + slides up smoothly
- **Staggered card animations** — dashboard stats pop in one by one
- **Card hover lift** — stat cards lift on hover with shadow effect
- **Sidebar active nav indicator** — sliding bar animates next to active item
- **Icon scaling** — active/hover icons scale up subtly

### 🗓️ Calendar
- **Google Calendar-style week/month views** with smooth transitions
- **Drag-and-drop events** — grab an event and move it to any time slot or day
- **Event color picker** — choose from 4 colors when creating or editing events
- **Time-blocking** — click a time slot to create an event; drag the bottom handle to resize

### ⏰ Live Clock & Dynamic Date
- **Live clock** ticking every second, right next to the date
- **Real today's date** — no hardcoded values
- **Time-of-day greeting** — "Good morning/afternoon/evening"

### 👤 Profile
- **Avatar upload** — pick a profile picture from your computer
- **Editable name** — change your display name in Settings

### 🔄 Auto-Update
- Checks for newer versions on startup and prompts to download
- Manual check available in Settings → About & Updates

### 🎉 Onboarding
- **Welcome tour** — 8-step overlay on first visit
- **Tooltip hints** — gentle sidebar tooltips for the first 5 sessions

### 🧠 Other Features
- **Command palette** (⌘P) — search views, create tasks, navigate
- **Focus mode** — distraction-free state hiding sidebar and topbar
- **Local storage persistence** — tasks, habits, notes, and settings survive reloads
- **Drag-and-drop task reordering** on dashboard and tasks view

## 🛠️ Technical
- Built with Electron 33 + Next.js 16 + React 19
- Signed with a self-signed code signing certificate
- Windows installer (NSIS) — installs to Program Files with Add/Remove Programs support
- 107 MB compressed installer

## 📦 Downloads
- **Installer:** `ProFlow-Setup-2.0.0.exe` (107 MB, signed)

## 🧪 System Requirements
- **OS:** Windows 10 or Windows 11 (x64)
- **Storage:** ~400 MB after installation
- **RAM:** 512 MB minimum, 2 GB recommended
```

---

## Step 4 — Upload the installer

1. Drag-and-drop this file into the **Attach binaries** area:
   ```
   release\ProFlow-Setup-2.0.0.exe   (107 MB)
   ```
2. Wait for the upload to complete (may take a minute)

---

## Step 5 — Publish the release

1. Check **"Set as the latest release"** ✓
2. Click **"Publish release"** 🚀

---

## Step 6 — Update the auto-update manifest

After publishing, update `public/versions.json` so the download URL points to the GitHub release asset:

```json
{
  "latestVersion": "2.0.0",
  "downloadUrl": "https://github.com/parth-kulkarni1/pro-flow/releases/download/v2.0.0/ProFlow-Setup-2.0.0.exe",
  "releaseNotes": "✨ v2.0.0 — Page view animations, calendar drag-drop, event color picker, live clock, avatar upload, welcome tour, and more!",
  "minimumVersion": "1.0.0",
  "updateUrl": "https://pro-flow-8mp2.vercel.app/versions.json"
}
```

---

## Quick links

| Action | URL |
|--------|-----|
| Create new release | https://github.com/parth-kulkarni1/pro-flow/releases/new |
| Repo home | https://github.com/parth-kulkarni1/pro-flow |
| Releases page | https://github.com/parth-kulkarni1/pro-flow/releases |
| Deployed Vercel app | https://pro-flow-8mp2.vercel.app |
