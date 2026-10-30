# Project HQ 4.6 — first-use setup of the two open-source audio utilities.
# Sources: yt-dlp/yt-dlp GitHub releases; gyan.dev FFmpeg essentials release.
# Downloads and checksum-verifies official releases; extracts only ffmpeg.exe.
param()
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$here = $PSScriptRoot
$staging = Join-Path $here '.download-audio-tmp'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
function DownloadFile([string]$url,[string]$dest) {
  Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $dest -TimeoutSec 220 -MaximumRedirection 5
}
function ReadSha256([string]$url,[string]$filename) {
  $checksumFile=Join-Path $staging ([Guid]::NewGuid().ToString()+'.txt')
  DownloadFile $url $checksumFile
  $lines=Get-Content $checksumFile
  if ($filename) {
    foreach ($line in $lines) { if ($line -match ('^([0-9a-fA-F]{64})\s+\*?' + [regex]::Escape($filename) + '$')) { return $Matches[1].ToLowerInvariant() } }
    throw "Kontrollsumma för $filename saknas hos utgivaren"
  }
  foreach ($line in $lines) { if ($line -match '[0-9a-fA-F]{64}') { return $Matches[0].ToLowerInvariant() } }
  throw 'Kontrollsumma från FFmpeg-utgivaren saknas'
}
function VerifySha256([string]$file,[string]$expected) {
  $actual=(Get-FileHash -Algorithm SHA256 -Path $file).Hash.ToLowerInvariant()
  if ($actual -ne $expected) { throw "SHA-256 stämmer inte för $file" }
}
try {
  New-Item -ItemType Directory -Force -Path $staging | Out-Null
  $ytPath=Join-Path $here 'yt-dlp.exe'
  $ffPath=Join-Path $here 'ffmpeg.exe'
  $ytInstalled=[bool](Get-Command yt-dlp.exe -ErrorAction SilentlyContinue)
  $ffInstalled=[bool](Get-Command ffmpeg.exe -ErrorAction SilentlyContinue)
  if (-not (Test-Path $ytPath) -and -not $ytInstalled) {
    Write-Output 'Laddar ned yt-dlp från officiella GitHub-releasen ...'
    $exe=Join-Path $staging 'yt-dlp.exe'
    DownloadFile 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' $exe
    $sha=ReadSha256 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/SHA2-256SUMS' 'yt-dlp.exe'
    VerifySha256 $exe $sha
    Move-Item -Force $exe $ytPath
  }
  if (-not (Test-Path $ffPath) -and -not $ffInstalled) {
    Write-Output 'Laddar ned FFmpeg essentials från gyan.dev. Filen kan vara cirka 110 MB ...'
    $archive=Join-Path $staging 'ffmpeg.zip'
    $url='https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip'
    DownloadFile $url $archive
    $sha=ReadSha256 ($url+'.sha256') ''
    VerifySha256 $archive $sha
    $dest=Join-Path $staging 'unpacked'
    Expand-Archive -LiteralPath $archive -DestinationPath $dest -Force
    $ff=Get-ChildItem -Path $dest -Filter 'ffmpeg.exe' -Recurse -File | Select-Object -First 1
    if (-not $ff) { throw 'ffmpeg.exe saknas i FFmpeg-arkivet' }
    Copy-Item -LiteralPath $ff.FullName -Destination $ffPath -Force
  }
  Write-Output 'Verktygen är klara.'
  exit 0
} catch {
  Write-Error ('Ljudverktyg kunde inte förberedas: ' + $_.Exception.Message)
  exit 1
} finally {
  Remove-Item -LiteralPath $staging -Force -Recurse -ErrorAction SilentlyContinue
}
