@echo off
title AICraft Federation - Unified Startup
color 0B
setlocal enabledelayedexpansion

echo.
echo ============================================
echo     🧠 AICraft Federation Unified Runtime
echo ============================================
echo.

REM --- Check Node.js installation ---
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found! Please install Node.js from https://nodejs.org/
    pause
    exit /b
)

REM --- Define paths ---
set SERVER_DIR=%~dp0
set MC_JAR=C:\Users\Admin\Desktop\FGD-main\minecraft-servers\paper-1.21.8-60.jar
set NODE_SCRIPT=%SERVER_DIR%server.js
set LOG_DIR=%SERVER_DIR%logs
set LOG_FILE=%LOG_DIR%\startup-%DATE:/=-%-%TIME::=-%.log

REM --- Create logs directory ---
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

echo [INFO] Starting Minecraft Server...
start "Minecraft Server" cmd /k "cd /d %~dp0minecraft-servers && java -Xms2G -Xmx4G -jar \"%MC_JAR%\" nogui"

timeout /t 5 >nul
echo [INFO] Waiting for Minecraft Server to initialize...

echo [INFO] Starting AICraft Federation Backend (Node.js)...
start "AICraft Backend" cmd /k "cd /d %SERVER_DIR% && node server.js"

echo.
echo [INFO] Both services launched successfully!
echo [INFO] Access your panel at: http://127.0.0.1:3000/admin.html
echo.
echo Press CTRL+C in either window to stop services.
echo Logs are stored in: %LOG_DIR%
echo.
pause
