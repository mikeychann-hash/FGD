@echo off
title AICraft Federation - Unified Startup
color 0B
setlocal enabledelayedexpansion

echo ============================================
echo     🧠 AICraft Federation Unified Runtime
echo ============================================
echo.

REM --- Check for Node.js ---
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found! Please install from https://nodejs.org/
    pause
    exit /b
)

REM --- Define paths ---
set BASE_DIR=%~dp0
set MC_JAR=C:\Users\Admin\Desktop\FGD-main\minecraft-servers\paper-1.21.8-60.jar
set NODE_SCRIPT=%BASE_DIR%server.js
set LOG_DIR=%BASE_DIR%logs

REM --- Ensure logs directory exists ---
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

echo [INFO] Starting Minecraft Server...
start "Minecraft Server" cmd /k "cd /d %~dp0minecraft-servers && java -Xms2G -Xmx4G -jar \"%MC_JAR%\" nogui"

echo [INFO] Waiting 10 seconds for server to initialize...
timeout /t 10 /nobreak >nul

echo [INFO] Starting AICraft Backend (server.js)...
start "AICraft Backend" cmd /k "cd /d %BASE_DIR% && node server.js"

echo.
echo [✅] Both services launched successfully!
echo [🌐] Access Admin Panel at: http://127.0.0.1:3000/admin.html
echo [🧠] API Key: admin123
echo.
pause
