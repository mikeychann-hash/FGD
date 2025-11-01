@echo off
REM ============================================================================
REM System Requirements Check for Windows
REM Run this to diagnose any installation issues
REM ============================================================================

echo.
echo === System Diagnostics (Windows) ===
echo.

echo 1. Checking Node.js...
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo    X Node.js is NOT installed
    echo    Please install from: https://nodejs.org/
    echo.
) else (
    for /f "delims=" %%i in ('node --version') do set NODE_VERSION=%%i
    echo    OK Node.js is installed
    echo    Version: !NODE_VERSION!
    for /f "delims=" %%i in ('where node') do set NODE_PATH=%%i
    echo    Path: !NODE_PATH!
)
echo.

echo 2. Checking npm...
where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo    X npm is NOT installed
) else (
    for /f "delims=" %%i in ('npm --version') do set NPM_VERSION=%%i
    echo    OK npm is installed
    echo    Version: v!NPM_VERSION!
    for /f "delims=" %%i in ('where npm') do set NPM_PATH=%%i
    echo    Path: !NPM_PATH!
)
echo.

echo 3. Checking current directory...
echo    Current dir: %CD%
if exist "package.json" (
    echo    OK package.json found
) else (
    echo    X package.json NOT found
)
if exist "server.js" (
    echo    OK server.js found
) else (
    echo    X server.js NOT found
)
echo.

echo 4. Checking dependencies...
if exist "node_modules\" (
    echo    OK node_modules directory exists
    for /f %%a in ('dir /b /ad node_modules ^| find /c /v ""') do set MODULE_COUNT=%%a
    echo    Installed packages: !MODULE_COUNT!
) else (
    echo    WARN node_modules NOT found (run: npm install)
)
echo.

echo 5. Checking port 3000...
netstat -ano | findstr :3000 | findstr LISTENING >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo    WARN Port 3000 is IN USE
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
        echo    Process ID: %%a
        for /f "tokens=1" %%b in ('tasklist /FI "PID eq %%a" /NH') do echo    Process Name: %%b
    )
) else (
    echo    OK Port 3000 is available
)
echo.

echo === Recommended Actions ===
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo -^> Install Node.js from https://nodejs.org/ (version 14 or higher)
)
if not exist "node_modules\" (
    echo -^> Run: npm install
)
if not exist "package.json" (
    echo -^> Make sure you're in the FGD project directory
)
echo.

echo === Try These Commands ===
echo   check-requirements.bat     # Run this diagnostic again
echo   npm install                # Install dependencies
echo   quick-start.bat            # Start the server
echo   start-server.bat --help    # See all startup options
echo.
pause
