@echo off
setlocal enabledelayedexpansion
title ProFlow - Clean Build Artifacts
cd /d "%~dp0"

echo ============================================
echo   ProFlow Cleanup
echo ============================================
echo.

set DRY=0
set CONFIRM=N

if /i "%~1"=="/dry" set DRY=1
if /i "%~1"=="/y"   set CONFIRM=Y

if "!DRY!"=="1" goto clean
if "!CONFIRM!"=="Y" goto clean

set /p CONFIRM=Delete build caches and release intermediates? (Y/N):
if /i not "!CONFIRM!"=="Y" goto cancel

:clean
echo.
echo Deleting build artifacts...
echo.
set DELETED=0

call :del_dir ".next"
call :del_dir "out"
call :del_dir "release\win-unpacked"
call :del_dir "release\ProFlow-v5"
call :del_dir "release\ProFlow-win32-x64"
call :del_dir "release\.icon-ico"
call :del_file "release\builder-debug.yml"
call :del_file "release\builder-effective-config.yaml"
call :del_file "release\latest.yml"
call :del_file "release\*.blockmap"
call :del_file "tsconfig.tsbuildinfo"
call :del_file ".eslintcache"
call :del_file "next.config.mjs.dev"

echo.
if "!DRY!"=="1" goto drydone
echo Done. Cleaned !DELETED! entries.
echo.
echo Next step: run build.bat to rebuild everything fresh.
goto finish

:drydone
echo [DRY-RUN] Nothing was deleted. Run clean.bat without /dry to actually clean.
goto finish

:cancel
echo Cancelled. Nothing was deleted.
echo.

:finish
echo.
endlocal
exit /b 0

:del_dir
if not exist "%~1" exit /b
if "!DRY!"=="1" echo   would delete: %~1
if "!DRY!"=="1" exit /b
rd /s /q "%~1" >nul 2>&1
set /a DELETED+=1
echo   deleted: %~1
exit /b

:del_file
if not exist "%~1" exit /b
if "!DRY!"=="1" echo   would delete: %~1
if "!DRY!"=="1" exit /b
del /f /q "%~1" >nul 2>&1
set /a DELETED+=1
echo   deleted: %~1
exit /b
