@echo off
chcp 65001 >nul
title ProFlow UI Smoke Test
echo ============================================
echo   ProFlow UI Smoke Test
echo   Installs the setup.exe (if present), launches the app,
echo   and verifies it opens to the Dashboard with no welcome-tour overlay.
echo ============================================
echo.

setlocal
set "SCRIPT_DIR=%~dp0"

where node >nul 2>&1
if errorlevel 1 (
    echo [FAIL] Node.js not found on PATH. Install Node 22+ and try again.
    exit /b 1
)

node "%SCRIPT_DIR%smoke-test-ui.js" %*
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if %EXIT_CODE% equ 0 (
    echo ✅ UI smoke test PASSED.
) else (
    echo ⚠ UI smoke test FAILED. See the output above.
)
exit /b %EXIT_CODE%
