@echo off
echo =====================================
echo   FGD Complete Stack - Starting...
echo =====================================
echo.
echo This will start BOTH:
echo   1. Backend Server (http://localhost:3000)
echo   2. Frontend App (http://localhost:5173)
echo.
echo Opening in separate windows...
echo.

REM Start backend in new window
echo Starting backend server...
start "FGD Backend" cmd /k "C:\Users\Admin\Desktop\FGD-main\start-backend.bat"

REM Wait 5 seconds for backend to start
echo Waiting 5 seconds for backend to initialize...
timeout /t 5 /nobreak >nul

REM Start frontend in new window (ELECTRON)
echo Starting Electron Desktop App...
start "FGD Desktop" cmd /k "C:\Users\Admin\Desktop\FGD-main\desktop-app\start-electron.bat"

echo.
echo =====================================
echo   All systems are starting!
echo =====================================
echo.
echo Backend:  http://localhost:3000
echo GUI:      Native Window (Electron)
echo.
echo Two separate windows have opened.
echo Close this window - the servers will continue running.
echo.
echo To stop servers: Close the individual terminal windows
echo.

pause
