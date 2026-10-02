@echo off
setlocal
set "APP_DIR=%~dp0."

start "Qwen TTS SSH tunnel" cmd /k ssh -N -o ExitOnForwardFailure=yes -L 18020:127.0.0.1:8020 -p 2222 sorry@176.125.193.183

echo Waiting for Qwen API. Enter the SSH password in the tunnel window.
powershell -NoProfile -Command "$deadline=(Get-Date).AddMinutes(3); while((Get-Date)-lt $deadline){ try { $r=Invoke-RestMethod -Uri 'http://127.0.0.1:18020/health' -TimeoutSec 2; if ($r.ready) { exit 0 } } catch {}; Start-Sleep -Seconds 2 }; exit 1"

if errorlevel 1 (
  echo Qwen API did not become available. Check the SSH tunnel and server.
  pause
  exit /b 1
)

start "Practice website" cmd /k python -m http.server 8765 --bind 127.0.0.1 --directory "%APP_DIR%"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8765/"
endlocal