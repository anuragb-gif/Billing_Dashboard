@echo off
REM ============================================================
REM  Snowman Ops Dashboard - public tunnel
REM  - hosts the named dev tunnel "snowman-dash" -> localhost:4000
REM  - permanent public URL:  https://fd892mps-4000.inc1.devtunnels.ms/
REM  - if the tunnel host drops, this restarts it after 5s
REM
REM  Run from Windows Task Scheduler:
REM    Trigger : At startup
REM    User    : Anirudh   (the account that ran "devtunnel user login"
REM              = pbidev@SNOWMAN.IN - the login token is stored per Windows
REM              user, so the task MUST run as this account)
REM    Option  : "Run whether user is logged on or not"
REM    (no admin rights needed - "Run with highest privileges" can stay off)
REM
REM  Output goes to deploy\tunnel.log
REM ============================================================

setlocal

set "DEVTUNNEL_EXE=%~dp0devtunnel.exe"
if not exist "%DEVTUNNEL_EXE%" set "DEVTUNNEL_EXE=C:\Users\Anirudh\devtunnel.exe"

REM Fresh log file - the old deploy\tunnel.log is owned by another account
REM (SLL-BCD365\Anurag) and is not writable by the task's run-as user.
set "LOG=%~dp0tunnel-host.log"

:loop
echo [%date% %time%] starting tunnel host... >> "%LOG%"
"%DEVTUNNEL_EXE%" host snowman-dash >> "%LOG%" 2>&1
echo [%date% %time%] tunnel host exited (code %errorlevel%), restarting in 5s... >> "%LOG%"
ping 127.0.0.1 -n 6 >nul
goto loop
