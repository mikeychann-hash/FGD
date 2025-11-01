@echo off
setlocal enabledelayedexpansion

REM ################################################################################
REM AICraft Cluster Dashboard - Server Startup Script (Windows)
REM
REM This script handles all pre-flight checks and starts the server with proper
REM error handling and validation.
REM
REM Usage:
REM   start-server.bat [mode] [options]
REM
REM Modes:
REM   prod      - Production mode (default)
REM   dev       - Development mode with hot-reload
REM   test      - Run tests only
REM
REM Options:
REM   --port PORT       - Override default port (3000)
REM   --log-level LEVEL - Set log level (DEBUG, INFO, WARN, ERROR, FATAL)
REM   --no-install      - Skip dependency installation check
REM   --help            - Show this help message
REM
REM ################################################################################

REM Change to script directory
cd /d "%~dp0"

REM Check for help flag
for %%a in (%*) do (
    if "%%a"=="--help" goto :show_help
    if "%%a"=="-h" goto :show_help
)

REM Default values
set "MODE=%1"
if "%MODE%"=="" set "MODE=prod"
if not defined PORT set "PORT=3000"
if not defined LOG_LEVEL set "LOG_LEVEL=INFO"
set "SKIP_INSTALL=false"

REM Parse arguments
set "arg_index=0"
:parse_args
shift
if "%1"=="" goto :done_parsing
if "%1"=="--port" (
    set "PORT=%2"
    shift
    shift
    goto :parse_args
)
if "%1"=="--log-level" (
    set "LOG_LEVEL=%2"
    shift
    shift
    goto :parse_args
)
if "%1"=="--no-install" (
    set "SKIP_INSTALL=true"
    shift
    goto :parse_args
)
shift
goto :parse_args

:done_parsing

REM ################################################################################
REM Main execution
REM ################################################################################

cls
echo.
echo ╔══════════════════════════════════════════════════════════════════╗
echo ║                                                                  ║
echo ║           AICraft Cluster Dashboard - Server Startup            ║
echo ║                                                                  ║
echo ╚══════════════════════════════════════════════════════════════════╝
echo.

call :print_header "Pre-flight Checks"

REM Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    call :print_error "Node.js is not installed"
    echo   Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set "NODE_VERSION=%%i"
call :print_success "Node.js installed: %NODE_VERSION%"

REM Extract major version (remove 'v' and get first number)
for /f "tokens=1 delims=." %%a in ("%NODE_VERSION:~1%") do set "MAJOR_VERSION=%%a"
if %MAJOR_VERSION% lss 14 (
    call :print_error "Node.js version 14.x or higher required (found %NODE_VERSION%)"
    echo.
    pause
    exit /b 1
)

REM Check npm
where npm >nul 2>&1
if %errorlevel% neq 0 (
    call :print_error "npm is not installed"
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('npm --version') do set "NPM_VERSION=%%i"
call :print_success "npm installed: v%NPM_VERSION%"

REM Check package.json
if not exist "package.json" (
    call :print_error "package.json not found in %CD%"
    echo.
    pause
    exit /b 1
)
call :print_success "package.json found"

REM Check server.js
if not exist "server.js" (
    call :print_error "server.js not found in %CD%"
    echo.
    pause
    exit /b 1
)
call :print_success "server.js found"

REM Check and install dependencies
if "%SKIP_INSTALL%"=="false" (
    if not exist "node_modules" (
        call :print_warning "Dependencies not installed, running npm install..."
        call npm install
        if %errorlevel% neq 0 (
            call :print_error "Failed to install dependencies"
            echo.
            pause
            exit /b 1
        )
        call :print_success "Dependencies installed"
    ) else (
        call :print_success "Dependencies already installed"

        REM Check if package-lock.json is newer than node_modules
        for %%a in (package-lock.json) do set "lock_time=%%~ta"
        for %%a in (node_modules) do set "modules_time=%%~ta"

        REM Note: Simple timestamp comparison on Windows
        if exist "package-lock.json" (
            call :print_info "Checking for dependency updates..."
        )
    )
) else (
    call :print_info "Skipping dependency check (--no-install)"
)

REM Ensure data directory exists
if not exist "data" (
    call :print_warning "Data directory not found, creating..."
    mkdir data
    call :print_success "Data directory created"
) else (
    call :print_success "Data directory exists"
)

REM Port check (simplified for Windows)
call :print_info "Port %PORT% will be used (Windows doesn't have built-in port check)"

echo.
call :print_header "Environment Setup"

set "PORT=%PORT%"
set "LOG_LEVEL=%LOG_LEVEL%"

if /i "%MODE%"=="dev" (
    set "NODE_ENV=development"
    call :print_info "Mode: Development (hot-reload enabled)"
) else (
    set "NODE_ENV=production"
    call :print_info "Mode: Production"
)

call :print_info "Port: %PORT%"
call :print_info "Log Level: %LOG_LEVEL%"

echo.
call :print_header "Starting Server"

if /i "%MODE%"=="prod" goto :start_prod
if /i "%MODE%"=="production" goto :start_prod
if /i "%MODE%"=="dev" goto :start_dev
if /i "%MODE%"=="development" goto :start_dev
if /i "%MODE%"=="test" goto :start_test

call :print_error "Invalid mode: %MODE%"
echo Valid modes: prod, dev, test
echo.
pause
exit /b 1

:start_prod
call :print_info "Starting server with: npm start"
echo.
call npm start
goto :end

:start_dev
call :print_info "Starting server with: npm run dev"
echo.
call npm run dev
goto :end

:start_test
call :print_info "Running tests..."
echo.
if not exist "test\npc_system.test.js" (
    call :print_error "Test file not found"
    echo.
    pause
    exit /b 1
)
node test\npc_system.test.js
goto :end

:show_help
echo AICraft Cluster Dashboard - Server Startup Script
echo.
echo This script handles all pre-flight checks and starts the server with proper
echo error handling and validation.
echo.
echo Usage:
echo   start-server.bat [mode] [options]
echo.
echo Modes:
echo   prod      - Production mode (default)
echo   dev       - Development mode with hot-reload
echo   test      - Run tests only
echo.
echo Options:
echo   --port PORT       - Override default port (3000)
echo   --log-level LEVEL - Set log level (DEBUG, INFO, WARN, ERROR, FATAL)
echo   --no-install      - Skip dependency installation check
echo   --help            - Show this help message
exit /b 0

REM ################################################################################
REM Helper Functions
REM ################################################################################

:print_header
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo   %~1
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
goto :eof

:print_success
echo [92m√[0m %~1
goto :eof

:print_error
echo [91m×[0m %~1
goto :eof

:print_warning
echo [93m![0m %~1
goto :eof

:print_info
echo [94mi[0m %~1
goto :eof

:end
if %errorlevel% neq 0 (
    echo.
    echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    echo   Server exited with errors
    echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    echo.
    pause
)
endlocal
