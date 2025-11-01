@echo off
REM FGD Unified Startup Script (Windows)
REM Starts Paper Server + Geyser + FGD Dashboard together

setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
set "PAPER_SERVER_DIR=%SCRIPT_DIR%minecraft-servers\paper-server"
set "LOG_DIR=%SCRIPT_DIR%logs"

echo =========================================
echo FGD Unified Startup (Windows)
echo =========================================
echo.

REM Create logs directory
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

REM Parse command line arguments
set "MODE=all"
if not "%1"=="" set "MODE=%1"

if "%MODE%"=="stop" goto :stop
if "%MODE%"=="paper" goto :start_paper_only
if "%MODE%"=="dashboard" goto :start_dashboard_only
if "%MODE%"=="all" goto :start_all

echo Usage: %0 [all^|paper^|dashboard^|stop]
echo.
echo   all        - Start Paper server and FGD dashboard (default)
echo   paper      - Start Paper server only
echo   dashboard  - Start FGD dashboard only
echo   stop       - Stop all running services
exit /b 1

:stop
echo Stopping all services...
echo.
taskkill /FI "WINDOWTITLE eq Paper Server*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq FGD Dashboard*" /F >nul 2>&1
echo All services stopped
exit /b 0

:start_all
set "START_PAPER=true"
set "START_DASHBOARD=true"
goto :check_paper

:start_paper_only
set "START_PAPER=true"
set "START_DASHBOARD=false"
goto :check_paper

:start_dashboard_only
set "START_PAPER=false"
set "START_DASHBOARD=true"
goto :start_dashboard

:check_paper
if "%START_PAPER%"=="false" goto :start_dashboard

if not exist "%PAPER_SERVER_DIR%\paper.jar" (
    echo Error: Paper server not found!
    echo.
    echo Please run the setup script first:
    echo   cd minecraft-servers
    echo   setup-paper-geyser.bat
    echo.
    exit /b 1
)

echo Starting Paper Server...
cd /d "%PAPER_SERVER_DIR%"

REM Start Paper in new window
start "Paper Server" /MIN cmd /c "start.bat > %LOG_DIR%\paper-server.log 2>&1"

echo [OK] Paper Server started
echo   Log file: %LOG_DIR%\paper-server.log
echo   Java Edition: localhost:25565
echo   Bedrock Edition: localhost:19132
echo   RCON: localhost:25575
echo.

echo Waiting for Paper server to initialize...
timeout /t 5 /nobreak >nul

cd /d "%SCRIPT_DIR%"

:start_dashboard
if "%START_DASHBOARD%"=="false" goto :complete

echo Starting FGD Dashboard...

REM Check if node_modules exists
if not exist "%SCRIPT_DIR%node_modules" (
    echo Installing dependencies...
    call npm install
)

REM Start dashboard in new window
start "FGD Dashboard" /MIN cmd /c "node server.js > %LOG_DIR%\fgd-dashboard.log 2>&1"

echo [OK] FGD Dashboard started
echo   Log file: %LOG_DIR%\fgd-dashboard.log
echo   Dashboard: http://localhost:3000
echo   Admin Panel: http://localhost:3000/admin
echo.

:complete
echo.
echo =========================================
echo Startup Complete!
echo =========================================
echo.
echo Services running:
if "%START_PAPER%"=="true" (
    echo   [OK] Paper Server (Java: 25565, Bedrock: 19132, RCON: 25575^)
)
if "%START_DASHBOARD%"=="true" (
    echo   [OK] FGD Dashboard (Port: 3000^)
)
echo.
echo Log files in: %LOG_DIR%\
echo.
echo To stop all services: %0 stop
echo.
pause
