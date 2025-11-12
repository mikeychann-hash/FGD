@echo off
REM ################################################################################
REM FGD Mineflayer Complete Startup Script
REM
REM Starts both Minecraft server and FGD backend with Mineflayer integration
REM This script requires:
REM   - Node.js (14.x or higher)
REM   - Java 17+ (for Minecraft server)
REM   - Paper/Spigot JAR file
REM
REM Usage:
REM   start-mineflayer.bat              - Start everything (Minecraft + FGD)
REM   start-mineflayer.bat --server-only - Start only FGD (no Minecraft)
REM   start-mineflayer.bat --help       - Show this help message
REM
REM ################################################################################

setlocal enabledelayedexpansion
cd /d "%~dp0"

REM ============================================================================
REM Configuration
REM ============================================================================

set "FGD_PORT=3000"
set "MINECRAFT_HOST=localhost"
set "MINECRAFT_PORT=25565"
set "MINECRAFT_VERSION=1.21.8"
set "MINECRAFT_JAR_NAME=paper-1.21.8-60.jar"
set "MINECRAFT_JAR_PATH=%~dp0minecraft-servers\%MINECRAFT_JAR_NAME%"
set "LOG_DIR=logs"
set "TIMESTAMP=%date:/=-%_%time::=-%"
set "SERVER_ONLY=false"

REM Parse command line arguments
if "%1"=="--help" goto :show_help
if "%1"=="-h" goto :show_help
if "%1"=="--server-only" set "SERVER_ONLY=true"
if "%1"=="--port" (
    set "FGD_PORT=%2"
)

REM ============================================================================
REM Port Detection - Find available port if 3000 is in use
REM ============================================================================

REM Determine an available port for the backend
set "CANDIDATE_PORTS=3000 3001 3002 4000 4001 4100 4200"
for %%P in (%CANDIDATE_PORTS%) do (
    netstat -ano | findstr ":%%P " >nul 2>&1
    if errorlevel 1 (
        set "FGD_PORT=%%P"
        goto :port_selected
    ) else (
        echo [!] Port %%P is in use, trying next option...
    )
)

echo [!] No preferred ports available; defaulting to 5000
set "FGD_PORT=5000"

:port_selected
echo [✓] FGD backend will listen on port %FGD_PORT%

REM ============================================================================
REM Display Banner
REM ============================================================================

cls
echo.
echo ╔══════════════════════════════════════════════════════════════════════════╗
echo ║                                                                          ║
echo ║   🎮 FGD Mineflayer - Complete Startup                                  ║
echo ║   Fusion Game Daemon with Real Minecraft Bot Control                    ║
echo ║                                                                          ║
echo ╚══════════════════════════════════════════════════════════════════════════╝
echo.

REM ============================================================================
REM Pre-flight Checks
REM ============================================================================

echo [*] Running pre-flight checks...
echo.

REM Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set "NODE_VERSION=%%i"
echo [✓] Node.js %NODE_VERSION% installed

REM Check npm
where npm >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] npm is not installed!
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('npm --version') do set "NPM_VERSION=%%i"
echo [✓] npm v%NPM_VERSION% installed

REM Check package.json
if not exist "package.json" (
    color 0C
    echo [ERROR] package.json not found!
    echo.
    pause
    exit /b 1
)
echo [✓] package.json found

REM Check server.js
if not exist "server.js" (
    color 0C
    echo [ERROR] server.js not found!
    echo.
    pause
    exit /b 1
)
echo [✓] server.js found

REM Create logs directory
if not exist "%LOG_DIR%" (
    mkdir "%LOG_DIR%"
    echo [✓] Created logs directory
)

REM Check for Java (only if starting Minecraft)
if "%SERVER_ONLY%"=="false" (
    where java >nul 2>&1
    if %errorlevel% neq 0 (
        color 0E
        echo [!] Java not found - Minecraft server will not start
        echo     Install Java 17+ from https://www.oracle.com/java/technologies/downloads/
        echo     You can still start the FGD server
        set "SERVER_ONLY=true"
    ) else (
        for /f "tokens=*" %%i in ('java -version 2^>^&1 ^| findstr /R "version"') do set "JAVA_VERSION=%%i"
        echo [✓] Java installed: !JAVA_VERSION!
    )
)

REM Check Minecraft JAR (only if starting Minecraft)
if "%SERVER_ONLY%"=="false" (
    if not exist "%MINECRAFT_JAR_PATH%" (
        color 0E
        echo [!] Minecraft server JAR not found at: %MINECRAFT_JAR_PATH%
        echo     Starting FGD server only
        set "SERVER_ONLY=true"
    ) else (
        echo [✓] Minecraft server JAR found
    )
)

echo.
color 0B

REM ============================================================================
REM Environment Setup
REM ============================================================================

echo [*] Setting up environment...
echo.

set "PORT=%FGD_PORT%"
set "MINECRAFT_HOST=%MINECRAFT_HOST%"
set "MINECRAFT_PORT=%MINECRAFT_PORT%"
set "MINECRAFT_VERSION=%MINECRAFT_VERSION%"

echo [✓] FGD Server Port: %PORT%
echo [✓] Minecraft Host: %MINECRAFT_HOST%:%MINECRAFT_PORT%
echo [✓] Minecraft Version: %MINECRAFT_VERSION%
echo [✓] Mineflayer Integration: ENABLED

echo.

REM ============================================================================
REM Startup Sequence
REM ============================================================================

if "%SERVER_ONLY%"=="true" (
    goto :start_server_only
)

echo [*] Starting Minecraft Server...
echo.
start "🎮 Minecraft Server (FGD)" cmd /k ^
    "cd /d %~dp0minecraft-servers && java -Xms2G -Xmx4G -jar ""%MINECRAFT_JAR_PATH%"" nogui"

echo [✓] Minecraft Server started in new window
echo.

echo [*] Waiting 10 seconds for Minecraft Server to initialize...
timeout /t 10 /nobreak >nul

echo.
echo [*] Starting FGD Backend Server...
echo.
start "🧠 FGD Backend (Mineflayer)" cmd /k ^
    "cd /d %~dp0 && set PORT=%FGD_PORT% && npm start"

echo [✓] FGD Backend started in new window
echo.

REM Give server time to start
timeout /t 3 /nobreak >nul

REM Open dashboard in default browser
echo [*] Opening FGD Dashboard...
start http://localhost:%PORT%/admin.html

goto :startup_complete

REM ============================================================================
REM Start Server Only (No Minecraft)
REM ============================================================================

:start_server_only
echo [*] Starting FGD Backend Server (Minecraft Server disabled)...
echo.
start "🧠 FGD Backend (Mineflayer)" cmd /k ^
    "cd /d %~dp0 && set PORT=%FGD_PORT% && npm start"

echo [✓] FGD Backend started in new window
echo.

timeout /t 3 /nobreak >nul

echo [*] Opening FGD Dashboard...
start http://localhost:%PORT%/admin.html

goto :startup_complete

REM ============================================================================
REM Startup Complete
REM ============================================================================

:startup_complete
echo.
echo ╔══════════════════════════════════════════════════════════════════════════╗
echo ║                                                                          ║
echo ║   ✅ STARTUP COMPLETE                                                   ║
echo ║                                                                          ║
echo ╠══════════════════════════════════════════════════════════════════════════╣
echo ║                                                                          ║
if "%SERVER_ONLY%"=="false" (
    echo ║   Minecraft Server:   localhost:25565                                ║
)
echo ║   FGD Backend:        http://localhost:%PORT%                           ║
echo ║   Admin Dashboard:    http://localhost:%PORT%/admin.html                ║
echo ║   API Base:           http://localhost:%PORT%/api                       ║
echo ║   NPC Endpoints:      http://localhost:%PORT%/api/npcs                  ║
echo ║   Mineflayer:         http://localhost:%PORT%/api/mineflayer            ║
echo ║                                                                          ║
echo ╠══════════════════════════════════════════════════════════════════════════╣
echo ║   🔌 Mineflayer Integration: ENABLED                                     ║
echo ║   📊 Real Bot Control: ACTIVE                                            ║
echo ║   🎯 Task Executors: mine, move, inventory, combat, craft               ║
echo ║                                                                          ║
echo ╠══════════════════════════════════════════════════════════════════════════╣
echo ║   💡 Tips:                                                               ║
echo ║   - Both windows must stay open for services to run                     ║
echo ║   - Press CTRL+C in a window to stop that service                       ║
echo ║   - Check logs/startup-*.log for detailed logs                          ║
echo ║   - Dashboard should open automatically in your browser                 ║
echo ║                                                                          ║
echo ╚══════════════════════════════════════════════════════════════════════════╝
echo.

pause
exit /b 0

REM ============================================================================
REM Help
REM ============================================================================

:show_help
echo.
echo FGD Mineflayer - Complete Startup Script
echo.
echo This script starts the FGD backend server with Mineflayer integration
echo and optionally starts a Minecraft server for real bot control.
echo.
echo Usage:
echo   start-mineflayer.bat              Start everything (Minecraft + FGD)
echo   start-mineflayer.bat --server-only Start FGD only (no Minecraft)
echo   start-mineflayer.bat --help       Show this help message
echo.
echo Requirements:
echo   - Node.js 14.x or higher
echo   - Java 17+ (for Minecraft server)
echo   - Paper/Spigot JAR in minecraft-servers folder
echo.
echo Features:
echo   ✓ Mineflayer integration for real bot control
echo   ✓ Task executors (mine, move, inventory, combat, craft)
echo   ✓ Real pathfinding and world awareness
echo   ✓ Automatic dashboard opening
echo   ✓ Comprehensive logging
echo   ✓ Database optional (works without PostgreSQL)
echo.
echo Environment Variables (optional):
echo   PORT=3000                  FGD server port
echo   MINECRAFT_HOST=localhost   Minecraft server hostname
echo   MINECRAFT_PORT=25565       Minecraft server port
echo   MINECRAFT_VERSION=1.20.1   Minecraft version
echo.
pause
exit /b 0
