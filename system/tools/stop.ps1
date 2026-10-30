$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$PidFile = Join-Path $Root 'data\server.pid'
$AppServer = Join-Path $Root 'app\server.mjs'
if (-not (Test-Path -LiteralPath $PidFile)) { Write-Host 'Ingen registrerad HQ-server.'; exit 0 }
$ProjectPid = 0
if (-not [int]::TryParse((Get-Content -LiteralPath $PidFile -Raw).Trim(),[ref]$ProjectPid)) { throw 'Ogiltigt server.pid' }
$Proc = Get-CimInstance -ClassName Win32_Process -Filter ('ProcessId=' + $ProjectPid) -ErrorAction SilentlyContinue
if ($null -eq $Proc) { Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue; exit 0 }
if ($Proc.CommandLine -notlike '*server.mjs*') { throw 'Kan inte verifiera HQ-servern. Ingenting stoppades.' }
# This tool is intentionally optional and does not run during normal use.
Stop-Process -Id $ProjectPid -ErrorAction Stop
Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
Write-Host 'Project HQ stoppades.'
