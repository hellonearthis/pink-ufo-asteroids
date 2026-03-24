@echo off
cd /d "%~dp0"
echo Installing dependencies...
call npm install
echo.
echo Starting the Asteroids game...
call npm run dev
pause
