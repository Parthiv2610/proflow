@echo off
chcp 65001 >nul
title ProFlow — Submit to Microsoft SmartScreen
echo ============================================
echo   ProFlow — Microsoft SmartScreen Submission
echo ============================================
echo.
echo This will open the Microsoft Security Intelligence
echo file submission portal in your default browser.
echo.
echo After the page loads:
echo   1. Sign in with your Microsoft account
echo   2. Upload: release\ProFlow-Setup-2.0.0.exe
echo   3. Mark it as "Clean file"
echo   4. Paste the details from SMARTSCREEN_SUBMISSION.md
echo.
echo Opening browser...
start https://www.microsoft.com/en-us/wdsi/filesubmission
echo.
echo Done — the page should be open in your browser.
echo.
echo For full instructions, see: SMARTSCREEN_SUBMISSION.md
echo.
pause
