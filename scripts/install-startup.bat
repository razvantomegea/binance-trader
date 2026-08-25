@echo off
setlocal
cd /d "%~dp0.."
set "WORKDIR=%CD%"
cd /d "%~dp0"
set "LNK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Binance Trading.lnk"
set "TARGET=%~dp0start-local.bat"

where docker >nul 2>&1
if errorlevel 1 (
  echo docker not found on PATH. Install Docker Desktop or fix PATH, then retry.
  exit /b 1
)
where pnpm >nul 2>&1
if errorlevel 1 (
  echo pnpm not found on PATH. Install pnpm or fix PATH, then retry.
  exit /b 1
)

powershell -NoProfile -Command ^
  "$s = (New-Object -ComObject WScript.Shell).CreateShortcut($env:LNK); $s.TargetPath = $env:TARGET; $s.WorkingDirectory = $env:WORKDIR; $s.Save()"
if errorlevel 1 (
  echo Failed to create Startup shortcut.
  exit /b 1
)
echo Installed Startup shortcut:
echo   "%LNK%"
echo Target:
echo   "%TARGET%"
endlocal
