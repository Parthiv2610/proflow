@echo off
chcp 65001 >nul
title ProFlow — Create GitHub Release
echo ============================================
echo   ProFlow — Create GitHub Release
echo ============================================
echo.

set INSTALLER=..\release\ProFlow-Setup-2.1.0.exe

if not exist "%INSTALLER%" (
    echo [ERROR] Installer not found at %INSTALLER%
    pause
    exit /b 1
)

echo Installer: %INSTALLER%
for %%I in ("%INSTALLER%") do echo Size: %%~zI bytes
echo.
echo Computing SHA-256 hash...
certutil -hashfile "%INSTALLER%" SHA256 2>&1 | findstr /v "CertUtil" | findstr /v "hash"
echo.

echo Opening GitHub new release page in your browser...
start https://github.com/parth-kulkarni1/pro-flow/releases/new
echo.
echo ============================================
echo   ✓ Browser opened!
echo   ✓ SHA-256 hash computed above
echo ============================================
echo.
echo Next steps:
echo   1. Tag: v2.1.0
echo   2. Title: ProFlow v2.1.0
echo   3. Paste release notes from RELEASE_GUIDE.md
echo   4. Drag the .exe file into Attach Binaries
echo   5. Click Publish Release
echo.
pause
