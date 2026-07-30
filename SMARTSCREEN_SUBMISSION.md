# 🛡️ Submitting ProFlow to Microsoft SmartScreen

This guide walks you through submitting the signed ProFlow installer to Microsoft
so SmartScreen stops showing the **"Windows protected your PC"** warning.

---

## Step 1 — Open the submission portal

Run this to open the page in your browser:

```bash
start https://www.microsoft.com/en-us/wdsi/filesubmission
```

Or go to: **[https://www.microsoft.com/en-us/wdsi/filesubmission](https://www.microsoft.com/en-us/wdsi/filesubmission)**

You'll need to **sign in with a Microsoft account** (any personal account works).

---

## Step 2 — Fill out the form

| Field | What to enter |
|-------|---------------|
| **Contact email** | Your email address |
| **Your organization** | `ProFlow` |
| **Select the Microsoft security product used** | `Microsoft Defender SmartScreen` |
| **What do you believe this file is?** | `Clean file / not detected as malware` |
| **Detection name** | (leave blank or put `SmartScreen reputation`) |

---

## Step 3 — Upload the installer

Click **Browse** and select:

```
release\ProFlow-Setup-2.0.0.exe   (107 MB, signed ✓)
```

---

## Step 4 — Paste this into "Additional Information"

Copy and paste the entire block below into the submission form's "Additional Information" box:

```
Application: ProFlow v2.0.0
Publisher: ProFlow
Developer Website: https://github.com/parth-kulkarni1/pro-flow
File: ProFlow-Setup-2.0.0.exe
Signed: Yes (self-signed, CN=ProFlow, O=ProFlow, C=US)

ProFlow is a desktop productivity application built with Electron + Next.js.
It includes: task management, calendar with time-blocking, habits & goals
tracking, focus timer (Pomodoro), notes & docs, and a dashboard with
analytics.

The installer is signed with a self-signed code signing certificate.
Users are currently seeing the SmartScreen "Windows protected your PC"
warning when downloading the installer from GitHub releases.

We are submitting this file to build SmartScreen reputation so that
users can download and install ProFlow without unnecessary warnings.
The application is safe — it does not access the network except for
the optional auto-update check.

SHA-256: (you can compute this with certutil -hashfile)
```

> **Note:** The SHA-256 hash step is optional — Microsoft's system computes
> it automatically from the uploaded file.

---

## Step 5 — Submit and wait

1. Complete the CAPTCHA if asked
2. Click **Submit**
3. Microsoft will analyze the submission (usually 24–48 hours)
4. You'll get an email with a tracking link
5. If the result is **"Clean"**, SmartScreen will start building reputation

---

## What happens next

After submission:

1. **Day 1–2:** Microsoft reviews the file and marks it as clean
2. **Week 1–3:** As more people download and run the installer without issues,
   SmartScreen's reputation score increases
3. **After ~1,000+ clean downloads:** SmartScreen stops blocking it entirely
   for most users

To speed this up, share the installer link with a few trusted people and
ask them to download and run it — each clean execution builds reputation.

---

## Alternative: Submit through Microsoft Partner Center

If you have a Microsoft Partner account, you can also submit through
the **Partner Center SmartScreen submission**:

1. Go to https://partner.microsoft.com/en-us/dashboard/mp/smartscreen
2. Sign in with your Partner account
3. Upload the file and provide the same details

This uses the same backend but gives better tracking.

---

## Files you need

| File | Size | Signed |
|------|------|--------|
| `release/ProFlow-Setup-2.0.0.exe` | 107 MB | ✅ Yes |

Both the **installer** and the **app binary inside it** are signed with
the ProFlow code signing certificate.

---

## Quick links

| Action | URL |
|--------|-----|
| Microsoft SmartScreen submission | https://www.microsoft.com/en-us/wdsi/filesubmission |
| Partner Center submission | https://partner.microsoft.com/en-us/dashboard/mp/smartscreen |
| Submission status check | Via email link after submission |
| GitHub releases | https://github.com/parth-kulkarni1/pro-flow/releases |
