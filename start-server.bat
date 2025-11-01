@echo off
REM ============================================================================
REM AICraft Cluster Dashboard - Windows Startup Script
REM
REM This script handles all pre-flight checks and starts the server on Windows
REM
REM Usage:
REM   start-server.bat [mode] [options]
REM
REM Modes:
REM   prod      - Production mode (default)
REM   dev       - Development mode with hot-reload
REM   test      - Run tests only
REM
REM Examples:
REM   start-server.bat
REM   start-server.bat dev
REM   start-server.bat prod
REM ============================================================================

setlocal EnableDelayedExpansion

REM Configuration
set "MODE=%~1"
if "%MODE%"=="" set "MODE=prod"
if "%MODE%"=="--help" goto :show_help
if "%MODE%"=="-h" goto :show_help

REM Colors (using Windows color codes where possible)
set "CHECK=[ OK ]"
set "CROSS=[FAIL]"
set "WARN=[WARN]"
set "INFO=[INFO]"

cls
echo ╔══════════════════════════════════════════════════════════════════╗
echo ║                                                                  ║
echo ║           AICraft Cluster Dashboard - Server Startup            ║
echo ║                  Windows Edition                                 ║
echo ║                                                                  ║
echo ╚══════════════════════════════════════════════════════════════════╝
echo.
echo.

REM ============================================================================
REM Pre-flight Checks
REM ============================================================================
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo   Pre-flight Checks
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

REM Check Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo %CROSS% Node.js is not installed
    echo.
    echo   Please install Node.js from https://nodejs.org/
    echo   Download the LTS version for Windows
    echo.
    echo   After installation, restart your terminal and try again.
    echo.
    pause
    exit /b 1
) else (
    for /f "delims=" %%i in ('node --version') do set NODE_VERSION=%%i
    echo %CHECK% Node.js installed: !NODE_VERSION!
)

REM Check npm
where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo %CROSS% npm is not installed
    echo   npm should come with Node.js. Please reinstall Node.js.
    pause
    exit /b 1
) else (
    for /f "delims=" %%i in ('npm --version') do set NPM_VERSION=%%i
    echo %CHECK% npm installed: v!NPM_VERSION!
)

REM Check package.json
if not exist "package.json" (
    echo %CROSS% package.json not found
    echo   Make sure you're in the FGD project directory
    pause
    exit /b 1
) else (
    echo %CHECK% package.json found
)

REM Check server.js
if not exist "server.js" (
    echo %CROSS% server.js not found
    echo   Make sure you're in the FGD project directory
    pause
    exit /b 1
) else (
    echo %CHECK% server.js found
)

REM Check and install dependencies
if not exist "node_modules\" (
    echo %WARN% Dependencies not installed, running npm install...
    echo.
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo %CROSS% Failed to install dependencies
        pause
        exit /b 1
    )
    echo.
    echo %CHECK% Dependencies installed
) else (
    echo %CHECK% Dependencies already installed
)

REM Ensure data directory exists
if not exist "data\" (
    echo %WARN% Data directory not found, creating...
    mkdir data
    echo %CHECK% Data directory created
) else (
    echo %CHECK% Data directory exists
)

echo.
echo.

REM ============================================================================
REM Environment Setup
REM ============================================================================
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo   Environment Setup
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

if "%MODE%"=="dev" (
    set NODE_ENV=development
    echo %INFO% Mode: Development (hot-reload enabled)
) else (
    set NODE_ENV=production
    echo %INFO% Mode: Production
)

if not defined PORT set PORT=3000
if not defined LOG_LEVEL set LOG_LEVEL=INFO

echo %INFO% Port: %PORT%
echo %INFO% Log Level: %LOG_LEVEL%
echo.
echo.

REM ============================================================================
REM Starting Server
REM ============================================================================
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo   Starting Server
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

if "%MODE%"=="test" (
    echo %INFO% Running tests...
    echo.
    if exist "test\npc_system.test.js" (
        node test\npc_system.test.js
    ) else (
        echo %CROSS% Test file not found
        pause
        exit /b 1
    )
) else if "%MODE%"=="dev" (
    echo %INFO% Starting server with: npm run dev
    echo.
    echo Server will be available at: http://localhost:%PORT%
    echo Press Ctrl+C to stop the server
    echo.
    call npm run dev
) else (
    echo %INFO% Starting server with: npm start
    echo.
    echo Server will be available at: http://localhost:%PORT%
    echo Press Ctrl+C to stop the server
    echo.
    call npm start
)

goto :eof

:show_help
echo AICraft Cluster Dashboard - Windows Startup Script
echo.
echo This script handles all pre-flight checks and starts the server on Windows
echo.
echo Usage:
echo   start-server.bat [mode]
echo.
echo Modes:
echo   prod      - Production mode (default)
echo   dev       - Development mode with hot-reload
echo   test      - Run tests only
echo.
echo Examples:
echo   start-server.bat
echo   start-server.bat dev
echo   start-server.bat prod
echo.
exit /b 0
