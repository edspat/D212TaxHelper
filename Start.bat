@echo off
title D212 Tax Helper
echo.
echo   ===================================
echo    D212 Tax Helper
echo    Starting server...
echo   ===================================
echo.

cd /d "%~dp0"
start /b "" node server.js >nul 2>&1
timeout /t 2 /nobreak >nul
start http://localhost:3000

exit
