@echo off
setlocal enabledelayedexpansion
title ProFlow — Building Desktop App
echo ============================================
echo  ProFlow Desktop Builder
echo ============================================
echo.

:: Check for Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed.
    echo Please install Node.js from https://nodejs.org (v20 or later)
    pause
    exit /b 1
)

:: Check for pnpm (preferred) or npm
set PKG_MGR=npm
where pnpm >nul 2>nul
if %errorlevel% equ 0 set PKG_MGR=pnpm

echo Using package manager: !PKG_MGR!
echo.

echo [1/4] Installing dependencies...
call !PKG_MGR! install
if %errorlevel% neq 0 (
    echo [ERROR] !PKG_MGR! install failed.
    pause
    exit /b 1
)
echo Done.

echo.
echo [2/4] Configuring for static export and building...

:: Save the current next.config.mjs and swap to export mode
set CONFIG_FILE=next.config.mjs
set CONFIG_BACKUP=next.config.mjs.dev
if exist !CONFIG_FILE! copy /Y !CONFIG_FILE! !CONFIG_BACKUP! >nul

:: Write the Electron export config
(
echo /** @type {import('next').NextConfig} */
echo const nextConfig = ^{
echo   output: "export",
echo   distDir: "out",
echo   typescript: ^{
echo     ignoreBuildErrors: true,
echo   ^},
echo   images: ^{
echo     unoptimized: true,
echo   ^},
echo   assetPrefix: "./",
echo   trailingSlash: true,
echo ^}
echo.
echo export default nextConfig
) > !CONFIG_FILE!

call !PKG_MGR! exec next build
set BUILD_EXIT=!errorlevel!

:: Restore the original dev config
if exist !CONFIG_BACKUP! copy /Y !CONFIG_BACKUP! !CONFIG_FILE! >nul
if exist !CONFIG_BACKUP! del !CONFIG_BACKUP! >nul

if !BUILD_EXIT! neq 0 (
    echo [ERROR] Next.js build failed.
    pause
    exit /b 1
)
echo Done.

echo.
echo [3/4] Packaging Electron app...

:: Try electron-builder first (produces NSIS installer)
call !PKG_MGR! exec electron-builder --win
if !errorlevel! equ 0 (
    echo.
    echo ============================================
    echo  SUCCESS!
    echo ============================================
    echo.
    echo The ProFlow installer is in the "release" folder.
    echo   release\ProFlow Setup *.exe
    echo.
    pause
    exit /b 0
)

:: Fallback to electron-packager (portable build)
echo [INFO] electron-builder failed (known Windows symlink issue).
echo [INFO] Falling back to electron-packager (portable build)...
echo.

setlocal disabledelayedexpansion
"!PKG_MGR!" exec electron-packager . ProFlow --platform=win32 --arch=x64 --out=release --overwrite --asar --prune --ignore="\.next" --ignore="node_modules/(?:(?!electron)[^/])*" --ignore="\.freebuff" --ignore="build/generate" --ignore="next\.config" --ignore="postcss" --ignore="tailwind" --ignore="tsconfig" --ignore="\.git" --win32metadata.ProductName="ProFlow" --win32metadata.CompanyName="ProFlow" --appCopyright="ProFlow" --appVersion="1.0.0" --icon="build/icon.png"
setlocal enabledelayedexpansion
if !errorlevel! neq 0 (
    echo [ERROR] electron-packager also failed.
    pause
    exit /b 1
)
echo.
echo ============================================
echo  SUCCESS! (portable build)
echo ============================================
echo.
echo The portable app folder is in the "release" folder:
echo   release\ProFlow-win32-x64\ProFlow.exe
echo.
echo To distribute as a single file, ZIP the folder:
echo   release\ProFlow-win32-x64\  ->  ProFlow-Portable.zip
echo.
echo Note: This is a portable app (no installer). Just double-click
echo ProFlow.exe to run it. No installation required.
echo.
pause
