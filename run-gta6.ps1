$ErrorActionPreference = 'Stop'
Set-Location 'E:\GTA6'

# Держим сервер в этом процессе (не job: job умирает вместе с shell-сессией).
$log = 'E:\GTA6\server-console.log'
$proc = Start-Process -FilePath 'node' -ArgumentList 'server.js' -WorkingDirectory 'E:\GTA6' `
  -RedirectStandardOutput $log -RedirectStandardError 'E:\GTA6\server-console.err.log' -PassThru

Start-Sleep -Seconds 4

$ok = $false
for ($i = 0; $i -lt 10; $i++) {
  try {
    $r = Invoke-WebRequest -Uri 'http://127.0.0.1:3000' -UseBasicParsing -TimeoutSec 3
    Write-Output "HTTP $($r.StatusCode), $($r.RawContentLength) bytes"
    $ok = $true
    break
  } catch {
    Start-Sleep -Milliseconds 800
  }
}

if (-not $ok) {
  Write-Output 'SERVER NOT UP'
  Get-Content $log -Tail 20 -ErrorAction SilentlyContinue
  Get-Content 'E:\GTA6\server-console.err.log' -Tail 20 -ErrorAction SilentlyContinue
  exit 1
}

Write-Output "node pid=$($proc.Id)"
Get-Content $log -Tail 10 -ErrorAction SilentlyContinue
