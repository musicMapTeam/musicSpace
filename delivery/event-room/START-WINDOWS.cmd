@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js 24 or newer is required. This package does not install software.
  pause
  exit /b 1
)
node -e "if(Number(process.versions.node.split('.')[0])<24)process.exit(1)"
if errorlevel 1 (
  echo Please use Node.js 24 or newer.
  pause
  exit /b 1
)
set "HOST=127.0.0.1"
set "DATA_DIR=%~dp0data"
echo The exact local address will appear after startup.
echo Keep this window open while demonstrating. Ctrl+C stops the service.
node server/launch-local.js
pause
