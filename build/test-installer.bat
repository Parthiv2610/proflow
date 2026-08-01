@echo off
chcp 65001 >nul
title ProFlow Installer Test
echo ============================================
echo   ProFlow Installer Test Suite
echo   Tests install, shortcuts, registry, and uninstall
echo ============================================
echo.

set SETUP_PATH=%~dp0..\release\ProFlow-Setup-2.1.0.exe
set INSTALL_DIR=%ProgramFiles%\ProFlow
set UNINSTALL_PATH=%ProgramFiles%\ProFlow\Uninstall.exe
set PASS=0
set FAIL=0

if not exist "%SETUP_PATH%" (
    echo [FAIL] Installer not found at %SETUP_PATH%
    set /a FAIL+=1
    goto :check_results
)

echo [INFO] Installer found: %SETUP_PATH%
echo [INFO] About to install ProFlow to %INSTALL_DIR%
echo [INFO] A UAC prompt will appear — click Yes.
echo.
pause

echo.
echo === STEP 1: Running installer (silent mode) ===
echo.
start /wait "" "%SETUP_PATH%" /S
set INSTALL_EXIT=%ERRORLEVEL%
echo Installer exit code: %INSTALL_EXIT%
if %INSTALL_EXIT% equ 0 (
    echo [PASS] Installer completed successfully
    set /a PASS+=1
) else (
    echo [FAIL] Installer returned error code %INSTALL_EXIT%
    set /a FAIL+=1
    goto :check_results
)

echo.
echo === STEP 2: Verifying installed files ===
echo.
if exist "%INSTALL_DIR%" (
    echo [PASS] Install directory exists: %INSTALL_DIR%
    set /a PASS+=1
) else (
    echo [FAIL] Install directory NOT found!
    set /a FAIL+=1
    goto :check_results
)

if exist "%INSTALL_DIR%\ProFlow.exe" (
    echo [PASS] ProFlow.exe found
    set /a PASS+=1
) else (
    echo [FAIL] ProFlow.exe missing!
    set /a FAIL+=1
)

if exist "%INSTALL_DIR%\Uninstall.exe" (
    echo [PASS] Uninstall.exe created
    set /a PASS+=1
) else (
    echo [FAIL] Uninstall.exe missing!
    set /a FAIL+=1
)

if exist "%INSTALL_DIR%\resources\app\out\index.html" (
    echo [PASS] App resources found
    set /a PASS+=1
) else (
    echo [FAIL] App resources missing!
    set /a FAIL+=1
)

if exist "%INSTALL_DIR%\resources\app\electron\main.js" (
    echo [PASS] Electron main.js found
    set /a PASS+=1
) else (
    echo [FAIL] Electron main.js missing!
    set /a FAIL+=1
)

if exist "%INSTALL_DIR%\resources\app\electron\preload.js" (
    echo [PASS] Electron preload.js found
    set /a PASS+=1
) else (
    echo [FAIL] Electron preload.js missing!
    set /a FAIL+=1
)

echo.
echo === STEP 3: Verifying shortcuts ===
echo.
if exist "%PUBLIC%\Desktop\ProFlow.lnk" (
    echo [PASS] Desktop shortcut found (public)
    set /a PASS+=1
) else if exist "%USERPROFILE%\Desktop\ProFlow.lnk" (
    echo [PASS] Desktop shortcut found
    set /a PASS+=1
) else (
    echo [FAIL] Desktop shortcut not found!
    set /a FAIL+=1
)

if exist "%ProgramData%\Microsoft\Windows\Start Menu\Programs\ProFlow\ProFlow.lnk" (
    echo [PASS] Start Menu shortcut exists ^(All Users^)
    set /a PASS+=1
) else if exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\ProFlow\ProFlow.lnk" (
    echo [PASS] Start Menu shortcut exists ^(Current User^)
    set /a PASS+=1
) else (
    echo [FAIL] Start Menu shortcut not found!
    set /a FAIL+=1
)

echo.
echo === STEP 4: Verifying registry entries (Add/Remove Programs) ===
echo.
reg query "HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall\ProFlow" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo [PASS] Add/Remove Programs registry key exists
    set /a PASS+=1
    
    for /f "tokens=2*" %%a in ('reg query "HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall\ProFlow" /v DisplayName 2^>nul') do set DISPLAY_NAME=%%b
    echo [INFO] DisplayName: %DISPLAY_NAME%
    
    for /f "tokens=2*" %%a in ('reg query "HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall\ProFlow" /v DisplayVersion 2^>nul') do set DISP_VER=%%b
    echo [INFO] DisplayVersion: %DISP_VER%
    
    for /f "tokens=2*" %%a in ('reg query "HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall\ProFlow" /v UninstallString 2^>nul') do set UNINST_STR=%%b
    echo [INFO] UninstallString: %UNINST_STR%
    
    for /f "tokens=2*" %%a in ('reg query "HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall\ProFlow" /v DisplayIcon 2^>nul') do set DISP_ICON=%%b
    echo [INFO] DisplayIcon: %DISP_ICON%
) else (
    echo [FAIL] Add/Remove Programs registry key NOT found!
    set /a FAIL+=1
)

reg query "HKLM\Software\Microsoft\Windows\CurrentVersion\App Paths\ProFlow.exe" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo [PASS] App Paths registry key exists
    set /a PASS+=1
) else (
    echo [FAIL] App Paths registry key NOT found!
    set /a FAIL+=1
)

echo.
echo === STEP 5: Running Uninstall ===
echo.
echo [INFO] About to uninstall ProFlow...
echo.
pause

if exist "%UNINSTALL_PATH%" (
    start /wait "" "%UNINSTALL_PATH%" /S _?=%INSTALL_DIR%
    set UNINSTALL_EXIT=%ERRORLEVEL%
    echo Uninstaller exit code: %UNINSTALL_EXIT%
    if %UNINSTALL_EXIT% equ 0 (
        echo [PASS] Uninstaller completed successfully
        set /a PASS+=1
    ) else (
        echo [FAIL] Uninstaller returned error code %UNINSTALL_EXIT%
        set /a FAIL+=1
    )
) else (
    echo [FAIL] Uninstall.exe not found at expected path!
    set /a FAIL+=1
)

echo.
echo === STEP 6: Verifying cleanup after uninstall ===
echo.

if exist "%INSTALL_DIR%" (
    echo [FAIL] Install directory still exists after uninstall!
    set /a FAIL+=1
) else (
    echo [PASS] Install directory cleaned up
    set /a PASS+=1
)

reg query "HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall\ProFlow" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo [FAIL] Registry key still exists after uninstall!
    set /a FAIL+=1
) else (
    echo [PASS] Registry key cleaned up
    set /a PASS+=1
)

reg query "HKLM\Software\Microsoft\Windows\CurrentVersion\App Paths\ProFlow.exe" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo [FAIL] App Paths registry key still exists after uninstall!
    set /a FAIL+=1
) else (
    echo [PASS] App Paths registry key cleaned up
    set /a PASS+=1
)

:check_results
echo.
echo ============================================
echo   Test Results
echo ============================================
echo   Passed: %PASS%
echo   Failed: %FAIL%
echo ============================================

if %FAIL% gtr 0 (
    echo.
    echo ⚠ Some tests failed. Review the output above.
    exit /b 1
) else (
    echo.
    echo ✅ All tests passed! The installer works correctly.
    echo    - Installs to Program Files ✓
    echo    - Creates shortcuts ✓
    echo    - Registers in Add/Remove Programs ✓
    echo    - Uninstalls cleanly ✓
    exit /b 0
)
