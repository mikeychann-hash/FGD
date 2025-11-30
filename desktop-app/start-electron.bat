@echo off
setlocal
echo =====================================
echo   FGD Desktop - Electron Mode
echo =====================================
echo.

REM Use script directory so the launcher works from any location
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

REM Resolve npm (prefer PATH, fall back to default install location)
for %%I in (npm.cmd) do set "NPM=%%~$PATH:I"
if "%NPM%"=="" set "NPM=C:\Program Files\nodejs\npm.cmd"

REM Check if we're in the right directory
if not exist "package.json" (
    echo ERROR: package.json not found!
    pause
    exit /b 1
)

echo [1/3] Installing project dependencies (npm install --no-fund --no-audit)...
call "%NPM%" install --no-fund --no-audit
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo [2/3] Starting Electron desktop app...
echo.
echo =====================================
echo   FGD Desktop App (Electron)
echo   
echo   Desktop window will open shortly
echo   
echo   Press Ctrl+C to stop
echo =====================================
echo.

REM Start Electron dev mode
call "%NPM%" run electron:dev

pause
