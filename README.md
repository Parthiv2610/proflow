# ProFlow 🚀

**All-in-One Productivity Workspace** — A desktop productivity app built with Electron + Next.js.

Track tasks, habits, goals, calendar events, and deep work sessions — all in one dark-themed, beautifully animated app.

![Dashboard](https://img.shields.io/badge/status-active-brightgreen)
![Electron](https://img.shields.io/badge/electron-33-blue)
![Next.js](https://img.shields.io/badge/next.js-16-black)
![License](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 📊 **Dashboard** | Stats overview, focus hours chart, today's tasks, quick actions |
| ✅ **Tasks & Projects** | Full task management with categories, status toggles, drag-and-drop reordering |
| 🗓️ **Calendar** | Week & month view with time-blocking, drag-and-drop events, color picker |
| 📝 **Notes & Docs** | Quick notes with tags |
| 🎯 **Habits & Goals** | Track daily routines and goal progress with streak tracking |
| ⏱ **Focus Timer** | Pomodoro deep work sessions with play/pause/skip controls |
| 🎬 **Page Animations** | Smooth fade-in transitions, staggered card animations, hover effects |
| 🔄 **Auto-Update** | Installs new versions in place — no uninstall, no data loss |
| ⌨️ **Command Palette** | Press `⌘P` / `Ctrl+P` to search views, create tasks, navigate |
| 🧘 **Focus Mode** | Distraction-free mode hiding sidebar and topbar |
| 🎉 **Welcome Tour** | 8-step onboarding overlay on first visit |
| 💡 **Tooltip Hints** | Gentle sidebar tooltips for the first few sessions |
| 📶 **LAN Sync** | Use the app on your phone over Wi-Fi — no account or internet needed |
| 📱 **Scan-to-Connect QR** | Each laptop shows a QR code so your phone opens the right address instantly |
| 💾 **Local Persistence** | All data saves to localStorage — survives reloads |

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

**Link it to your laptop (same Wi-Fi):**

1. On the laptop: **Settings → LAN Sync** → turn on **"Allow your phone to use this app"**
2. Note the address shown (e.g. `http://192.168.1.5:5174`)
3. In the APK: **Settings → LAN Sync** → type that address → **Connect**
4. Enter the 6-digit passcode from the laptop screen — done!

The APK syncs both ways, no account, no internet,
just the same Wi-Fi. Not connected yet? It shows "Not connected" and a hint instead of a
confusing passcode prompt.

You could just use only the laptop app or phone app separately

> 🛠️ **Build it yourself:** run `pnpm exec cap sync android && cd android && ./gradlew assembleRelease`
> after a `next build` to produce the signed APK locally (the signing keystore lives in
> `android/app/proflow-release.keystore` with `keystore.properties`).

> 🔐 **Signing note:** the keystore and its password are committed for convenience so the
> CI build works out of the box. The workflow already honors the `ANDROID_KEYSTORE_PASSWORD`
> and `ANDROID_KEY_PASSWORD` GitHub secrets — to harden a public release, set those secrets,
> remove `keystore.properties`, and rotate the keystore.

> 💡 **How syncing works:** the laptop is the "brain" — your phone is a remote
> screen that talks to it over Wi-Fi. Keep ProFlow open on the laptop with LAN
> Sync on. If the phone loses the connection, it keeps its own copy of your data
> and re-syncs automatically when you reconnect. Multiple people can each use
> their own laptop + phone pair on the same network — every laptop shows its own
> QR code and passcode, and data never mixes between them.

---

## 📸 Screenshots


---

## 🚀 Quick Start (Development)

### Prerequisites

- **Node.js** >= 18
- **pnpm** >= 11 (`npm install -g pnpm`)

### Setup

```bash
# Clone the repo
git clone https://github.com/Parthiv2610/proflow.git
cd pro-flow

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

The installer will be in `release/ProFlow Setup 2.0.0.exe`.

### Build the portable .exe (no installer)

```bash
# Using electron-packager directly
pnpm build
npx electron-packager . ProFlow --platform=win32 --arch=x64 --out=release --overwrite --icon=build/icon.png
```

### Build the NSIS installer

```bash
# Using the convenience script (recommended)
build.bat

# Or manually step by step:
pnpm build                                    # Build the Next.js static export
# Then run makensis.exe (path varies by installation):
"C:\Program Files (x86)\NSIS\makensis.exe" build\installer-manual.nsi
# Or use the electron-builder path:
"%LOCALAPPDATA%\electron-builder\Cache\nsis\nsis-3.0.4.1\makensis.exe" build\installer-manual.nsi
```

---

## 🧱 Project Structure

```
pro-flow/
├── app/                      # Next.js app router pages
├── components/
│   ├── proflow/              # Main app components
│   │   ├── views/            # Dashboard, Tasks, Calendar, etc.
│   │   ├── store.tsx         # Zustand-like global state
│   │   ├── sidebar.tsx       # Navigation sidebar
│   │   ├── topbar.tsx        # Top header bar
│   │   └── ui.tsx            # Shared UI components (Card, Button, etc.)
│   └── ui/                   # shadcn-style UI primitives
├── electron/
│   ├── main.js               # Electron main process
│   ├── preload.js            # Preload script (IPC bridge)
│   └── lan-server.js         # LAN sync server (Wi-Fi phone access)
├── lib/                      # Utility functions
│   ├── use-local-storage.ts  # localStorage persistence hook
│   ├── lan-sync.ts           # Renderer-side LAN sync (phone polling, detection)
│   └── use-update.ts         # Shared auto-update state machine (desktop + Android)
├── public/                   # Static assets
├── build/                    # Build scripts & installer config
│   ├── installer-manual.nsi  # NSIS installer script (manual route)
│   ├── icon.ico              # Windows app icon
│   ├── create-cert.ps1       # Self-signed cert generator
│   ├── sign-installer.ps1    # Code signing script
│   └── test-installer.bat    # Installer test suite
└── package.json
```

---

## 🔐 Code Signing

The installer can be signed with a self-signed certificate for development:

```bash
# Create a self-signed code signing certificate
powershell -File build\create-cert.ps1

# Sign the portable app binary
powershell -File build\sign-portable.ps1

# Rebuild the installer (which now includes the signed binary)
build.bat

# Sign the resulting Setup.exe
powershell -File build\sign-installer.ps1
```

> **Note:** Self-signed certificates won't stop SmartScreen on other machines. For that, you need a CA-issued code signing certificate (DigiCert, Sectigo, etc.).

---

## 📦 Submission to Microsoft SmartScreen

To stop SmartScreen warnings when users download the installer:

1. Go to [Microsoft Security Intelligence File Submission](https://www.microsoft.com/en-us/wdsi/filesubmission)
2. Upload the signed `ProFlow-Setup.exe`
3. Mark it as "Clean file"
4. Submit and wait 24–48 hours for review

See `SMARTSCREEN_SUBMISSION.md` for full instructions.

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| [Next.js 16](https://nextjs.org/) | React framework (static export) |
| [React 19](https://react.dev/) | UI library |
| [Electron 33](https://www.electronjs.org/) | Desktop app shell |
| [Tailwind CSS 4](https://tailwindcss.com/) | Utility-first CSS |
| [Lucide React](https://lucide.dev/) | Icons |
| [NSIS](https://nsis.sourceforge.io/) | Windows installer |
| [pnpm](https://pnpm.io/) | Package manager |

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

Built with ❤️ using Electron + Next.js
