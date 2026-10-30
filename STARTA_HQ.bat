@echo off
setlocal
cd /d "%~dp0"
title Project HQ - 4.54
cls
echo.
echo  ======================================
echo    PROJECT HQ 4.54  -  DIN HQ-APP
echo  ======================================
echo.
echo  Skapar appikon pa skrivbordet och i Start-menyn...
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0system\create-shortcut.ps1" >nul 2>nul
echo  Startar HQ...
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0system\start.ps1"
set "EXITCODE=%ERRORLEVEL%"
if not "%EXITCODE%"=="0" (
 echo.
 echo  Startfel: se data\startup-error.txt och data\server-errors.log.
 pause
)
exit /b %EXITCODE%
