@echo off
title Video Notes AI - Personal App
cd /d "%~dp0"

set "PYTHONPATH=%~dp0src;%PYTHONPATH%"
set "VN_OPEN_BROWSER=1"

echo ============================================================
echo   Video Notes AI  -  Personal Web App
echo ============================================================
echo.
echo   Starting server... your browser will open automatically.
echo   Keep this window open while using the app.
echo.
echo   Private: runs on localhost only - not exposed to your network.
echo.
echo ============================================================

python -m notes_ai.web_app

echo.
echo   Server stopped.
pause
