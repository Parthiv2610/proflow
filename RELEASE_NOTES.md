# 🚀 ProFlow — Release Notes

> ℹ️ **Latest update:** LAN sync was **removed** — the app is fully local on each device (desktop and Android APK each keep their own data). Updates still install in place with no data loss.

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
| **Windows** | `ProFlow-Setup-2.1.0.exe` (NSIS installer — installs to Program Files, Add/Remove Programs support) |
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
