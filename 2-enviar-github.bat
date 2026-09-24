@echo off
cd /d "%~dp0"
echo === git === > push-log.txt
if not exist .git git init -b main >> push-log.txt 2>&1
git config user.name "Marcos" >> push-log.txt 2>&1
git config user.email "lopestmarcos@gmail.com" >> push-log.txt 2>&1
git add -A >> push-log.txt 2>&1
git commit -m "Delicias da Re: primeira versao" >> push-log.txt 2>&1
git remote remove origin >nul 2>&1
git remote add origin https://github.com/Marcos-tlj/delicias-da-re.git >> push-log.txt 2>&1
git push -u origin main >> push-log.txt 2>&1
echo === FIM (exit %ERRORLEVEL%) === >> push-log.txt
git ls-files >> push-log.txt
exit
