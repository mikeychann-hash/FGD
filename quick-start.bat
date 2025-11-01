@echo off
REM ################################################################################
REM Quick Start Script for Windows
REM
REM This is a simple wrapper that starts the server with default settings.
REM For advanced options, use start-server.bat --help
REM ################################################################################

REM Run the main startup script with production mode
call "%~dp0start-server.bat" prod %*
