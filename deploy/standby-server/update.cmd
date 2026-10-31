@echo off
rem Starts the standby, and keeps it on the same version as the main site: fetches main, and
rem rebuilds and restarts only when it changed (or when the app is not running).
rem See docs\SELF_HOST_STANDBY.md. Kept in plain ASCII: cmd reads a batch file in the console's code page.
rem
rem   First start:       double-click update.cmd
rem   Every 10 minutes:  in a cmd window opened in this folder run once
rem     schtasks /create /tn "SPIR standby update" /sc minute /mo 10 /tr "\"%CD%\update.cmd\""
cd /d "%~dp0"
if not exist .env (echo Copy .env.example to .env and fill it in first. & pause & exit /b 1)
git -C ..\.. fetch -q origin main || goto :fail
for /f %%a in ('git -C ..\.. rev-parse HEAD') do set "HEAD_SHA=%%a"
for /f %%a in ('git -C ..\.. rev-parse origin/main') do set "MAIN_SHA=%%a"
set "RUNNING="
for /f %%a in ('docker compose ps --status running -q app') do set "RUNNING=%%a"
if "%HEAD_SHA%"=="%MAIN_SHA%" if defined RUNNING exit /b 0
git -C ..\.. merge -q --ff-only origin/main || goto :fail
docker compose up -d --build || goto :fail
docker image prune -f >nul
exit /b 0
:fail
echo The update failed - see the messages above.
exit /b 1
