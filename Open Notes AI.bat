@echo off
title Video Notes AI - Open App
cd /d "%~dp0"

REM --- Use the same port the server reads (PORT env var, default 8080). ---
set "APP_PORT=8080"
if defined PORT set "APP_PORT=%PORT%"
set "APP_URL=http://127.0.0.1:%APP_PORT%"

REM --- If the app is already running, just open the browser. ---
curl -s -o nul --max-time 1 %APP_URL%/api/health
if %errorlevel%==0 goto open

echo Video Notes AI is not running yet. Starting it now...
echo The server starts in a small minimized window - keep it open while using the app.
echo.

set "PYTHONPATH=%~dp0src;%PYTHONPATH%"
set "PORT=%APP_PORT%"
start "Video Notes AI Server" /min cmd /k "python -m notes_ai.web_app"

REM --- Wait up to ~40 seconds for the server to come up. ---
set /a tries=0
:wait
set /a tries+=1
if %tries% gtr 40 (
  echo.
  echo Could not reach the app. Look at the server window for any error.
  pause
  exit /b 1
)
ping -n 2 127.0.0.1 >nul
curl -s -o nul --max-time 1 %APP_URL%/api/health
if not %errorlevel%==0 goto wait

:open
start "" "%APP_URL%"
exit /b 0
