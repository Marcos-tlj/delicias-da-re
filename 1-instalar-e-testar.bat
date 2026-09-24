@echo off
cd /d "%~dp0"
if not exist .env.local copy /Y env-local.txt .env.local >nul
echo === npm install === > build-log.txt
call npm install >> build-log.txt 2>&1
echo === npm run build === >> build-log.txt
call npm run build >> build-log.txt 2>&1
echo === FIM (exit %ERRORLEVEL%) === >> build-log.txt
exit
