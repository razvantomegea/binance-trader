@echo off
cd /d "%~dp0.."
where docker >nul 2>&1
if errorlevel 1 (
  echo docker not found on PATH. Install Docker Desktop or fix PATH, then retry.
  pause
  exit /b 1
)
where pnpm >nul 2>&1
if errorlevel 1 (
  echo pnpm not found on PATH. Install pnpm or fix PATH, then retry.
  pause
  exit /b 1
)
echo Starting Binance Trading from "%CD%"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-local.ps1"
if errorlevel 1 (
  echo Server exited with error %ERRORLEVEL%
  pause
)
