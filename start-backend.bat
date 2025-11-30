@echo off
echo =====================================
echo   FGD Backend Server - Starting...
echo =====================================
echo.

REM Set npm path
set NPM="C:\Program Files\nodejs\npm.cmd"

REM Navigate to backend directory
cd /d "C:\Users\Admin\Desktop\FGD-main"

REM Check if we're in the right directory
if not exist "package.json" (
    echo ERROR: package.json not found!
    echo Current directory: %CD%
    pause
    exit /b 1
)

echo [1/2] Checking for node_modules...
if not exist "node_modules" (
    echo Installing dependencies...
    call %NPM% install
    if errorlevel 1 (
        echo ERROR: Failed to install dependencies
        pause
        exit /b 1
    )
)

echo.
echo [2/2] Starting backend server...
echo.
echo =====================================
echo   FGD Backend is starting!
echo   
echo   Server: http://localhost:3000
echo   
echo   Press Ctrl+C to stop
echo =====================================
echo.

REM Start the backend server
call %NPM% start

pause
