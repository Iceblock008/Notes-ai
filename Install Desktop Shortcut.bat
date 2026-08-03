@echo off
title Video Notes AI - Install Desktop Link
cd /d "%~dp0"

set "APP_DIR=%~dp0"

echo ============================================================
echo   Video Notes AI - adding a clickable link to your Desktop
echo ============================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws=New-Object -ComObject WScript.Shell; $lnk=$ws.CreateShortcut([Environment]::GetFolderPath('Desktop')+'\Video Notes AI.lnk'); $lnk.TargetPath='%APP_DIR%Open Notes AI.bat'; $lnk.WorkingDirectory='%APP_DIR%'; $lnk.IconLocation='%SystemRoot%\System32\shell32.dll,13'; $lnk.Save()"

if %errorlevel%==0 (
  echo Done! You now have a "Video Notes AI" shortcut on your Desktop.
  echo Double-click it anytime to open the app - it starts the server
  echo automatically if it isn't already running.
) else (
  echo Could not create the shortcut. As a fallback, copy the file
  echo "Notes AI.url" from this folder onto your Desktop and use that.
)
echo.
pause
