@echo off
rem النسخة المحلية: يشغّل التطبيق على هذا الحاسوب (Windows) على http://localhost:3000
rem يحتاج Node.js 20 أو أحدث. أول تشغيل يثبّت الحزم ويبني التطبيق (دقائق)، وبعده يبدأ فوراً.
rem بعد تحديث المشروع احذف المجلد .next ليُبنى من جديد. البيانات في المجلد lab-data بجانب المشروع.
chcp 65001 >nul
cd /d "%~dp0\..\.."
where node >nul 2>nul || (echo Install Node.js 20 or newer from https://nodejs.org & pause & exit /b 1)
if not exist node_modules (call npm ci || goto :fail)
if not exist .next\BUILD_ID (call npm run build || goto :fail)
if "%PORT%"=="" set PORT=3000
if "%PGLITE_DATA_DIR%"=="" set PGLITE_DATA_DIR=%CD%\lab-data
set NEXT_TELEMETRY_DISABLED=1
rem Other computers of the lab can sign in to the admin panel over http://192.168.x.x too.
set LAB_LOCAL_HTTP=1
start "" cmd /c "timeout /t 8 >nul & start http://localhost:%PORT%/welcome"
call npm start
exit /b 0
:fail
echo The setup failed - see the messages above.
pause
exit /b 1
