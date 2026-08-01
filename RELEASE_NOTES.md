# 🚀 ProFlow v2.1.0 — Settings Overhaul, Mobile Navigation & Android APK

> 🎉 ProFlow now runs on your phone too! This release ships a real Android APK that links to your laptop over Wi-Fi — no account, no internet required.

---

## ✨ What's New

### 📱 ProFlow on Android (APK)
- **A proper Android app** — same ProFlow experience as the desktop, built as a signed release APK with the ProFlow launcher icon and v2.1.0 branding.
- **Link it to your laptop over Wi-Fi**: open the APK → Settings → LAN Sync → enter your laptop's address → connect with the 6-digit passcode shown on the laptop. Two-way sync, no accounts, no cloud.
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

## 🔗 How to Link Phone ↔ Laptop

1. On the **laptop**: open ProFlow → **Settings → LAN Sync** → turn it on. Note the address (e.g. `http://192.168.1.5:5174`).
2. On the **phone**: install the APK → open **Settings → LAN Sync** → enter the laptop's address → **Connect**.
3. Enter the **6-digit passcode** shown on the laptop.
4. Both devices on the same Wi-Fi — changes sync both ways. No account, no internet needed.

---

<details>
<summary><b>Full changelog (v2.0.0 → v2.1.0)</b></summary>

- Add Capacitor Android app with signed release build, ProFlow icon, v2.1.0 branding
- Add cap-mode LAN sync linking the APK to the laptop (passcode + two-way merge, last-write-wins)
- Add phone bottom tab bar: Home / Tasks / Calendar / Settings
- Add mobile sidebar drawer + always-visible hamburger
- Make the desktop sidebar responsive: open on large screens, collapsed by default on smaller laptop windows, drawer on phones
- Redesign Settings toggle switches (iOS-style, high contrast)
- Add "Clear all data" reset (wipes every `proflow-*` key + in-memory state + LAN teardown)
- Add CI workflows that build the installer and APK from the same release tag
- Add cap-mode end-to-end test and `clean.bat`

</details>
