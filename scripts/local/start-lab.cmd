@echo off
rem The lab's local copy on this computer (Windows): http://localhost:3000/welcome
rem Needs Node.js 20 or newer. The first run installs the packages and builds the app (a few
rem minutes); later runs start at once. After updating the project, delete the .next folder so it
rem is built again. The data is kept in the lab-data folder next to the project (PGLITE_DATA_DIR).
rem See docs\CONTINUITY.md. Kept in plain ASCII: cmd reads a batch file in the console's code page.
cd /d "%~dp0\..\.."
where node >nul 2>nul || (echo Install Node.js 20 or newer from https://nodejs.org & pause & exit /b 1)
if not exist node_modules (call npm ci || goto :fail)
if not exist .next\BUILD_ID (call npm run build || goto :fail)
if "%PORT%"=="" set PORT=3000
if "%PGLITE_DATA_DIR%"=="" set "PGLITE_DATA_DIR=%CD%\lab-data"
set NEXT_TELEMETRY_DISABLED=1
rem Other computers of the lab can sign in to the admin panel over http://192.168.x.x too.
set LAB_LOCAL_HTTP=1
echo Open in the browser: http://localhost:%PORT%/welcome  (close this window to stop)
start "" cmd /c "timeout /t 8 >nul & start http://localhost:%PORT%/welcome"
call npm start
exit /b 0
:fail
echo The setup failed - see the messages above.
pause
exit /b 1
