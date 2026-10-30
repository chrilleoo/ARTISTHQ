# Project HQ Video Tools - install FFmpeg + FFprobe privately, no administrator privileges.
# Source: gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip + published SHA-256.
# Never modifies machine PATH, existing installations, or ProjectHQ data.
param()
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$destination = $PSScriptRoot
$temp = Join-Path $destination ('.video-tools-' + [Guid]::NewGuid().ToString('N'))
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
function Present([string]$name) {
    if (Test-Path -LiteralPath (Join-Path $destination ($name + '.exe')) -PathType Leaf) { return $true }
    return [bool](Get-Command ($name + '.exe') -ErrorAction SilentlyContinue)
}
try {
    $needFFmpeg = -not (Present 'ffmpeg')
    $needFFprobe = -not (Present 'ffprobe')
    if (-not $needFFmpeg -and -not $needFFprobe) {
        Write-Output 'FFmpeg och FFprobe finns redan. Ingen installation behövs.'
        exit 0
    }
    New-Item -ItemType Directory -Force -Path $temp | Out-Null
    $url = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip'
    $archive = Join-Path $temp 'ffmpeg-essentials.zip'
    $checksum = Join-Path $temp 'ffmpeg-essentials.sha256'
    Write-Output 'Hämtar FFmpeg Essentials (inklusive FFprobe) från gyan.dev. Nedladdningen kan ta några minuter...'
    Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $archive -TimeoutSec 240 -MaximumRedirection 5
    Invoke-WebRequest -UseBasicParsing -Uri ($url + '.sha256') -OutFile $checksum -TimeoutSec 60 -MaximumRedirection 5
    $raw = Get-Content -LiteralPath $checksum -Raw
    if ($raw -notmatch '(?i)\b([0-9a-f]{64})\b') { throw 'Utgivarens SHA-256-kontrollsumma kunde inte läsas.' }
    $expected = $Matches[1].ToLowerInvariant()
    $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $archive).Hash.ToLowerInvariant()
    if ($actual -ne $expected) { throw 'SHA-256-kontrollen misslyckades. Inga filer har installerats.' }
    Write-Output 'Kontrollsumma verifierad. Packar upp FFmpeg och FFprobe...'
    $extract = Join-Path $temp 'unpacked'
    Expand-Archive -LiteralPath $archive -DestinationPath $extract -Force
    foreach ($name in @('ffmpeg', 'ffprobe')) {
        if (-not (Present $name)) {
            $source = Get-ChildItem -Path $extract -Filter ($name + '.exe') -Recurse -File | Select-Object -First 1
            if (-not $source) { throw ($name + '.exe saknas i utgivarens arkiv.') }
            $target = Join-Path $destination ($name + '.exe')
            $part = Join-Path $destination ($name + '.' + [Guid]::NewGuid().ToString('N') + '.tmp')
            try {
                Copy-Item -LiteralPath $source.FullName -Destination $part -ErrorAction Stop
                Move-Item -LiteralPath $part -Destination $target -ErrorAction Stop
            } finally { Remove-Item -LiteralPath $part -Force -ErrorAction SilentlyContinue }
            Write-Output ($name + '.exe installerad i HQ.')
        }
    }
    foreach ($name in @('ffmpeg','ffprobe')) {
        if (-not (Present $name)) { throw ($name + ' kunde inte hittas efter installationen.') }
    }
    Write-Output 'Videomotorn är klar.'
    exit 0
} catch {
    Write-Error ('Installation misslyckades: ' + $_.Exception.Message)
    exit 1
} finally {
    Remove-Item -LiteralPath $temp -Recurse -Force -ErrorAction SilentlyContinue
}
