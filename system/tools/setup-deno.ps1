# Deno runtime for yt-dlp JavaScript challenges when Node < 22.
# Download from official denoland/deno release and verify its SHA-256 sidecar.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$here = $PSScriptRoot
$dest = Join-Path $here 'deno.exe'
$temp = Join-Path $here '.deno-download'
if (Test-Path $dest) { exit 0 }
New-Item -ItemType Directory -Force -Path $temp | Out-Null
try {
  $base='https://github.com/denoland/deno/releases/latest/download/deno-x86_64-pc-windows-msvc.zip'
  $zip=Join-Path $temp 'deno.zip'
  $sum=Join-Path $temp 'deno.sha256sum'
  Invoke-WebRequest -UseBasicParsing -Uri $base -OutFile $zip -TimeoutSec 240
  Invoke-WebRequest -UseBasicParsing -Uri ($base+'.sha256sum') -OutFile $sum -TimeoutSec 120
  $content=Get-Content -LiteralPath $sum -Raw
  if ($content -notmatch '(?i)\b([0-9a-f]{64})\b') { throw 'Saknar officiell kontrollsumma för Deno.' }
  $expected=$Matches[1].ToLowerInvariant();$actual=(Get-FileHash -Algorithm SHA256 $zip).Hash.ToLowerInvariant()
  if($expected -ne $actual){throw 'Deno-kontrollsumman stämmer inte.'}
  Expand-Archive -LiteralPath $zip -DestinationPath $temp -Force
  $exe=Join-Path $temp 'deno.exe';if(!(Test-Path $exe)){throw 'deno.exe saknas i arkivet.'}
  Move-Item -LiteralPath $exe -Destination $dest -Force
  exit 0
} catch {
  Write-Error ('Deno kunde inte installeras: '+$_.Exception.Message)
  exit 1
} finally {
  Remove-Item -LiteralPath $temp -Force -Recurse -ErrorAction SilentlyContinue
}
