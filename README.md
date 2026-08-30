# ProFlow 🚀

**All-in-One Productivity Workspace** — A cross-platform productivity app built with Electron + Next.js + Capacitor.

Track tasks, habits, goals, checklists, calendar events, deep work sessions, and notes — all in one dark-themed, beautifully animated app. Sync between your PC and phone over LAN.

![Dashboard](https://img.shields.io/badge/status-active-brightgreen)
![Electron](https://img.shields.io/badge/electron-33-blue)
![Next.js](https://img.shields.io/badge/next.js-16-black)
![Android](https://img.shields.io/badge/android-capacitor-green)
![License](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Features

### Core Productivity

| Feature | Description |
|---------|-------------|
| 📊 **Dashboard** | Stats overview, focus hours chart, checklist progress, habit streaks, quick actions |
| ✅ **Tasks & Projects** | Full task management with categories, status toggles, auto-complete with 1-day restore |
| ☑️ **Checklists** | Dedicated checklist app — create lists, check items, earn XP, archive completed lists |
| 🗓️ **Calendar** | Week & month view with time-blocking, drag-and-drop events, color picker |
| 📝 **Notes & Docs** | Quick notes with tags, drag-and-drop reordering |
| 🎯 **Habits & Goals** | Track daily routines with streak calendar, reminder scheduling, and shield protection |
| ⏱ **Focus Timer** | Pomodoro deep work sessions with play/pause/skip, continues in background |

### Gamification & Rewards

| Feature | Description |
|---------|-------------|
| 🏆 **XP System** | Earn XP for completing tasks (+10), habits (+15), focus sessions (+20), checklist items (+5) |
| 🛡️ **Streak Shields** | Protect your habit streaks from missed days |
| 🎖️ **Achievements** | Unlock badges for milestones and consistent behavior |
| 📈 **Progress View** | XP history, achievements cabinet, streak stats, focus log |

### Cross-Platform

| Feature | Description |
|---------|-------------|
| 💻 **Desktop App** | Native Windows installer via Electron — auto-updates in place |
| 📱 **Android APK** | Native Android app via Capacitor — auto-updates over the air |
| 📲 **Phone Widgets** | Today at a Glance, Quick Add, Habit tracker, Task tracker widgets |
| 🔄 **LAN Sync** | Sync between PC and phone on the same WiFi — additive merge, never deletes data |

### Reminders & Notifications

| Feature | Description |
|---------|-------------|
| 🔔 **Habit Reminders** | Schedule daily reminders per habit — works on both phone and PC |
| 📢 **Device Notifications** | Native OS notifications (Android 13+ and desktop) |
| 🛡️ **Shield Undo** | Undo accidental shield usage within a short window |

### UX & Polish

| Feature | Description |
|---------|-------------|
| 🎨 **9 Accent Colors** | Purple, Blue, Indigo, Green, Teal, Cyan, Orange, Amber, Rose |
| 🎬 **Page Animations** | Smooth fade-in transitions, spring animations, staggered card reveals |
| ⌨️ **Command Palette** | Press `⌘P` / `Ctrl+P` to search views, create tasks, navigate |
| 🧘 **Focus Mode** | Distraction-free mode hiding sidebar and topbar |
| 🎉 **Welcome Tour** | 8-step onboarding overlay on first visit |
| 💾 **Local Persistence** | All data saves to localStorage — survives reloads |
| 🐛 **Error Boundary** | Shows crash reason on screen instead of blank white page |

---

## 🚀 How to Use

There are two ways to use ProFlow — pick whichever fits you.

### 1️⃣ Desktop only (no phone)

Just install and use the app on your computer. Everything is saved locally on
your machine and works fully offline.

1. Download the installer (always the latest):
   `https://github.com/Parthiv2610/proflow/releases/latest/download/ProFlow-Setup.exe`
2. Click through the installer — it installs to `C:\Program Files\ProFlow`
3. Open ProFlow and start adding tasks, habits, goals, events, and notes

That's it — no account, no setup, no internet required.

> 🔄 **Install once, update forever.** After the first install you never need to
> download another installer: every time the developer pushes new code to GitHub,
> CI automatically builds a new release, and ProFlow updates **in place** — a
> banner appears in the app, you click **Update**, it installs over the current
> version and restarts. Your tasks, habits, notes and settings are always kept.

### 2️⃣ 📱 Android APK (native app)

A **ProFlow APK** (`app-release.apk`, properly signed) is built automatically by GitHub
Actions on every push and attached to the latest release. The download link never
changes — it always points at the newest build:
`https://github.com/Parthiv2610/proflow/releases/latest/download/app-release.apk`

**Install (first time only):**

1. Download `app-release.apk` on your Android phone (link above)
2. Tap it — Android may ask to allow installs from your browser; allow it
3. If prompted by Play Protect, tap **Install anyway** (it's a self-built app, not from the Play Store)

> 🔄 **Install once, update forever.** Future updates are pushed through the app
> itself: a banner appears, you tap **Update**, the APK downloads and the system
> installer installs it **over** the current version (same signature, same
> keystore) — all your data is preserved. No need to re-download the APK.

> 🛠️ **Build it yourself:** run `pnpm exec cap sync android && cd android && ./gradlew assembleRelease`
> after a `next build` to produce the signed APK locally (the signing keystore lives in
> `android/app/proflow-release.keystore` with `keystore.properties`).

### 3️⃣ 🔄 Syncing Between PC and Phone

ProFlow supports **LAN sync** — syncing data between your desktop and phone on the same WiFi network. No internet required, no cloud services, no accounts.

**How it works:**

1. **On your PC:** Go to **Settings → LAN sync** → Click **Start server**
2. **On your phone:** Go to **Settings → LAN sync** → Enter the URL shown on your PC (e.g. `http://192.168.1.5:7777`)
3. **Toggle "Auto-sync to desktop"** ON — your phone pushes new items to the PC every 30 seconds

**Key behavior:**
- ✨ **Additive merge** — new tasks, habits, checklists, notes added on phone appear on PC
- 🔒 **Never deletes** — items deleted on phone are NOT removed from PC
- 🔢 **Smart counters** — XP, streaks, and achievements take the higher value on both devices
- ⏱ **Auto-sync** — toggle pushes data every 30 seconds when enabled

> ⚠️ Both devices must be on the **same WiFi network**. If your router has "AP isolation" or "client isolation" enabled, disable it for LAN sync to work.

---

## 📸 Screenshots

<img width="464" height="290" alt="Dashboard" src="https://github.com/user-attachments/assets/73bf1b3b-4067-437b-a469-aeb6e8c4ee44" />
<img width="464" height="290" alt="Tasks" src="https://github.com/user-attachments/assets/31f82ae0-4880-4025-9928-835a7f551e67" />
<img width="464" height="290" alt="Calendar" src="https://github.com/user-attachments/assets/01a1c4fb-534a-43a6-ad50-691f541d5e1d" />
<img width="464" height="290" alt="Focus" src="https://github.com/user-attachments/assets/02d34eb3-9ecc-4f7c-a54f-0de5db0f1560" />
<img width="464" height="290" alt="Habits" src="https://github.com/user-attachments/assets/abdd8ec3-69e7-4e85-a0bc-c8d92a10aadf" />
<img width="464" height="290" alt="Notes" src="https://github.com/user-attachments/assets/1d765d12-15fe-4ffe-a6ae-1d59acb51c68" />

---

## 🚀 Quick Start (Development)

### Prerequisites

- **Node.js** >= 18
- **pnpm** >= 11 (`npm install -g pnpm`)

### Setup

```bash
# Clone the repo
git clone https://github.com/Parthiv2610/proflow.git
cd proflow

# Install dependencies
pnpm install

# Start the Next.js dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the web version.

### Run the Electron desktop app

```bash
# In one terminal — start the Next.js dev server
pnpm dev

# In another terminal — launch Electron
pnpm electron:dev
```

### Run the Android app

```bash
# Build the static export
pnpm build

# Sync to Android
pnpm exec cap sync android

# Open in Android Studio or run on device
cd android && ./gradlew installDebug
```

---

## 🏗️ Building for Production

### Build the web version

```bash
pnpm build
```

Output goes to `out/` directory (static HTML export).

### Build the Windows desktop installer

```bash
# 1. Build the Next.js static export
pnpm build

# 2. Package with Electron
pnpm electron:build:win
```

The installer will be in `release/ProFlow Setup.exe`.

### Build the Android APK

```bash
# 1. Build the static export
pnpm build

# 2. Sync to Android
pnpm exec cap sync android

# 3. Build signed APK
cd android && ./gradlew assembleRelease
```

The APK will be at `android/app/build/outputs/apk/release/app-release.apk`.

---

## 🧱 Project Structure

```
proflow/
├── app/                      # Next.js app router pages
├── components/
│   ├── proflow/              # Main app components
│   │   ├── views/            # Dashboard, Tasks, Calendar, Habits, Checklists, Notes, etc.
│   │   ├── store.tsx         # Global state (tasks, habits, XP, streaks, etc.)
│   │   ├── sidebar.tsx       # Navigation sidebar
│   │   ├── topbar.tsx        # Top header bar
│   │   ├── bottom-tabs.tsx   # Mobile bottom navigation
│   │   ├── streak-calendar.tsx # Habit streak calendar component
│   │   ├── error-boundary.tsx  # Crash screen with error details
│   │   └── ui.tsx            # Shared UI components (Card, Button, etc.)
│   └── ui/                   # shadcn-style UI primitives
├── electron/
│   ├── main.js               # Electron main process (window, LAN server, auto-update)
│   └── preload.js            # Preload script (IPC bridge)
├── lib/                      # Utility functions
│   ├── use-local-storage.ts  # localStorage persistence hook
│   ├── use-update.ts         # Auto-update state machine (desktop + Android)
│   ├── lan-sync.ts           # LAN sync client/server + additive merge
│   ├── widget-bridge.ts      # Android widget communication
│   ├── notify.ts             # Notification scheduling
│   └── auto-backup.ts        # Auto-backup before updates
├── android/                  # Capacitor Android project
│   ├── app/src/main/java/    # Java: widgets, notifications, backup plugin
│   └── app/src/main/res/     # Android resources, layouts, icons
├── public/                   # Static assets
├── build/                    # App icon (used by electron-builder)
│   └── icon.png
├── capacitor.config.ts       # Capacitor config (Android app settings)
├── next.config.mjs           # Next.js config (static export)
└── package.json
```

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| [Next.js 16](https://nextjs.org/) | React framework (static export) |
| [React 19](https://react.dev/) | UI library |
| [Electron 33](https://www.electronjs.org/) | Desktop app shell |
| [Capacitor](https://capacitorjs.com/) | Android native shell |
| [Tailwind CSS 4](https://tailwindcss.com/) | Utility-first CSS |
| [Lucide React](https://lucide.dev/) | Icons |
| [NSIS](https://nsis.sourceforge.io/) | Windows installer |
| [pnpm](https://pnpm.io/) | Package manager |

---

## 📦 Release History

| Version | Highlights |
|---------|-----------|
| **v5.1.0** | Additive LAN sync — mobile additions merge to desktop, never deletes |
| **v5.0.0** | LAN sync, sidebar polish, error boundary, mobile stability fixes |
| **v4.1.0** | Fresh Electron build, fixed installer loading |
| **v3.5.0** | Checklist XP, inline toggles, sidebar dividers, auto-backup |
| **v3.4.0** | Focus timer bg fix, streak calendar, shield undo, native notifications |
| **v3.3.0** | Dashboard visual refresh — gradients, color-coded cards |
| **v3.2.0** | Simplified UI + spring animations |
| **v3.1.1** | Interactive widgets + export fix |
| **v3.1.0** | Checklists, habit reminders, widgets, streak calendar |
| **v3.0.0** | Notes knowledge base, keyboard & dashboard polish |

---

## 🤝 Contributing

Contributions are welcome! Here's how:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

Feel free to use, modify, and distribute.

---

Built with ❤️ using Electron + Next.js + Capacitor
