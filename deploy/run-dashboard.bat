@echo off
REM ============================================================
REM  Snowman Ops Dashboard launcher
REM  - starts the all-in-one server (API + built frontend, :4000)
REM  - the server refreshes the data itself nightly at 2:30 AM
REM  - if the server ever crashes, this restarts it after 5s
REM  Run this from Windows Task Scheduler at startup.
REM ============================================================

setlocal

REM --- Node location. Edit if Node is installed somewhere else. ---
set "NODE_EXE=C:\Users\Anurag\AppData\Local\node-portable\node-v22.23.1-win-x64\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=node"

cd /d "%~dp0..\backend"

:loop
echo [%date% %time%] starting server...
"%NODE_EXE%" src\server.js
echo [%date% %time%] server exited (code %errorlevel%). Restarting in 5s...
timeout /t 5 /nobreak >nul
goto loop
