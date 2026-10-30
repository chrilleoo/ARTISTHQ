# One-time, opt-in setup for the MIT licensed Beat This! beat tracker.
# Installs only inside ProjectHQ/system/runtime/beatlab; no global PATH or Python changes.
param()
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$runtime = Join-Path (Split-Path $PSScriptRoot -Parent) 'runtime\beatlab'
$tools = Join-Path $runtime 'tools'
$uvExe = Join-Path $tools 'uv.exe'
$staging = Join-Path $runtime '.setup-tmp'
$zip = Join-Path $staging 'uv.zip'
$urlBase = 'https://github.com/astral-sh/uv/releases/latest/download/'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
try {
  if (-not (Test-Path $uvExe)) {
    New-Item -ItemType Directory -Force -Path $staging,$tools | Out-Null
    Write-Output 'Hämtar portabel uv från astral-sh/uv (GitHub) ...'
    Invoke-WebRequest -UseBasicParsing -Uri ($urlBase+'uv-x86_64-pc-windows-msvc.zip') -OutFile $zip -TimeoutSec 240
    $checksum = Join-Path $staging 'uv.zip.sha256'
    Invoke-WebRequest -UseBasicParsing -Uri ($urlBase+'uv-x86_64-pc-windows-msvc.zip.sha256') -OutFile $checksum -TimeoutSec 90
    $expected = [regex]::Match((Get-Content $checksum -Raw), '[A-Fa-f0-9]{64}').Value.ToLowerInvariant()
    if ($expected.Length -ne 64) { throw 'Officiell SHA-256-kontrollsumma saknas.' }
    $actual = (Get-FileHash -Algorithm SHA256 -Path $zip).Hash.ToLowerInvariant()
    if ($actual -ne $expected) { throw 'SHA-256 matchar inte. Nedladdningen avbröts.' }
    Expand-Archive -LiteralPath $zip -DestinationPath $staging -Force
    $binary = Get-ChildItem -LiteralPath $staging -Filter 'uv.exe' -Recurse -File | Select-Object -First 1
    if (-not $binary) { throw 'uv.exe saknas i det officiella arkivet.' }
    Copy-Item -LiteralPath $binary.FullName -Destination $uvExe -Force
  }
  & $uvExe --version
  if ($LASTEXITCODE -ne 0) { throw 'Kunde inte verifiera uv.exe.' }
  exit 0
} catch {
  Write-Error ('Beat Lab AI-installation misslyckades: '+$_.Exception.Message)
  exit 1
} finally {
  Remove-Item -LiteralPath $staging -Force -Recurse -ErrorAction SilentlyContinue
}
