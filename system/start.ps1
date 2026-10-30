# Project HQ Windows launcher - use installed Node first; portable fallback.
# Does not run npm install, require admin permissions, or change the Windows PATH.
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$AppDir = Join-Path $Root 'app'
$Runtime = Join-Path $PSScriptRoot 'runtime'
$PortableNode = Join-Path $Runtime 'node.exe'
$DataDir = Join-Path $Root 'data'
# Read the real server version from this installation; do not hardcode old releases.
$Package = Get-Content -LiteralPath (Join-Path $AppDir 'package.json') -Raw | ConvertFrom-Json
$ExpectedVersion = ([string]$Package.version -split '\.')[0..1] -join '.'
$RootBytes = [System.Text.Encoding]::UTF8.GetBytes($Root.ToLowerInvariant())
$Sha = [System.Security.Cryptography.SHA256]::Create()
try { $RootHash = [BitConverter]::ToString($Sha.ComputeHash($RootBytes)).Replace('-', '').ToLowerInvariant() } finally { $Sha.Dispose() }
$InstallId = $RootHash.Substring(0, 16)
$PreferredPorts = @(3765..3899)
function Get-HomeUrl([int]$Port) { return ('http://127.0.0.1:' + $Port + '/workspace') }
function Get-HealthUrl([int]$Port) { return ('http://127.0.0.1:' + $Port + '/api/health') }
# A TCP connect timeout is NOT proof that a local port is occupied.
# Check by actually binding to localhost, which matches the Node server.
function Test-PortAvailable([int]$Port) {
    $listener = $null
    try {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
        $listener.Start()
        return $true
    } catch {
        return $false
    } finally {
        if ($null -ne $listener) { $listener.Stop() }
    }
}

function Find-AvailablePort {
    foreach ($candidate in $PreferredPorts) {
        if (Test-PortAvailable ([int]$candidate)) { return [int]$candidate }
    }
    # Last resort: let Windows select a free ephemeral localhost port.
    $listener = $null
    try {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
        $listener.Start()
        return [int]$listener.LocalEndpoint.Port
    } catch {
        throw ('Kunde inte hitta en tillganglig lokal port: ' + $_.Exception.Message)
    } finally {
        if ($null -ne $listener) { $listener.Stop() }
    }
}

function Test-HQ([int]$Port) {
    try {
        $data = Invoke-RestMethod -Uri (Get-HealthUrl $Port) -TimeoutSec 2
        return ($data.name -eq 'Project HQ' -and $data.ok -eq $true -and $data.version -eq $ExpectedVersion -and $data.installId -eq $InstallId)
    } catch { return $false }
}
function Open-HQ([int]$Port) {
    $url = Get-HomeUrl $Port
    Write-Host ('  HQ-adress: ' + $url) -ForegroundColor Green
    # Dedicated app-style window when Chrome/Edge is available.
    # The local server is still 127.0.0.1 only; no external hosting.
    $browsers = @(
      (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
      (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe')
    )
    if (${env:ProgramFiles(x86)}) {
      $browsers += Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'
      $browsers += Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'
    }
    $launched = $false
    foreach ($browser in $browsers) {
      if ($browser -and (Test-Path -LiteralPath $browser -PathType Leaf)) {
        try { Start-Process -FilePath $browser -ArgumentList ('--app=' + $url) | Out-Null; $launched = $true; break } catch { }
      }
    }
    if (-not $launched) {
      try { Start-Process $url | Out-Null } catch {
        Write-Host '  Webblasaren kunde inte oppnas automatiskt. Kopiera HQ-adressen ovan.' -ForegroundColor Yellow
      }
    }
}

function Get-CompatibleNode {
    # Get-Command detects both regular Node installations and versions managed by fnm/nvm/Volta.
    $candidates = New-Object System.Collections.Generic.List[string]
    foreach ($cmd in @(Get-Command -Name 'node.exe','node' -All -ErrorAction SilentlyContinue)) {
        if ($null -ne $cmd) {
            if ($cmd.Source) { $candidates.Add([string]$cmd.Source) }
            elseif ($cmd.Path) { $candidates.Add([string]$cmd.Path) }
        }
    }
    # Also look in standard installation paths when Windows' PATH hasn't refreshed.
    foreach ($base in @($env:ProgramFiles, ${env:ProgramFiles(x86)}, $env:NVM_SYMLINK, $env:LOCALAPPDATA, $env:USERPROFILE, $env:ChocolateyInstall)) {
        if (-not $base) { continue }
        $candidates.Add((Join-Path $base 'nodejs\node.exe'))
        $candidates.Add((Join-Path $base 'Programs\nodejs\node.exe'))
        $candidates.Add((Join-Path $base 'node.exe'))
        $candidates.Add((Join-Path $base '.volta\bin\node.exe'))
        $candidates.Add((Join-Path $base 'bin\node.exe'))
    }
    $candidates.Add($PortableNode)
    $checked = @{}
    $foundOldVersion = $false
    foreach ($candidate in $candidates) {
        if (-not $candidate -or $checked.ContainsKey($candidate.ToLowerInvariant())) { continue }
        $checked[$candidate.ToLowerInvariant()] = $true
        if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) { continue }
        try {
            $versionOutput = (& $candidate '--version' 2>$null | Select-Object -First 1)
            if ($versionOutput -match '^v(\d+)\.') {
                $major = [int]$Matches[1]
                if ($major -ge 20) {
                    Write-Host ('  Node.js found: ' + $versionOutput + ' (' + $candidate + ')') -ForegroundColor Green
                    return $candidate
                }
                $foundOldVersion = $true
            }
        } catch { continue }
    }
    if ($foundOldVersion) { Write-Host '  An old Node.js version was found; Project HQ needs v20 or later.' -ForegroundColor Yellow }
    return $null
}

function Install-PortableNode {
    # Fallback only when the PC has no compatible Node version already.
    # Node is extracted inside ProjectHQ\runtime: it is NOT installed into Windows.
    New-Item -ItemType Directory -Force -Path $Runtime | Out-Null
    $version = '22.16.0'
    $arch = 'x64'
    if ([Environment]::GetEnvironmentVariable('PROCESSOR_ARCHITECTURE') -eq 'ARM64') { $arch = 'arm64' }
    $name = 'node-v' + $version + '-win-' + $arch
    $checksums = @{
      x64='21c2d9735c80b8f86dab19305aa6a9f6f59bbc808f68de3eef09d5832e3bfbbd'
      arm64='31e885dcd06355f67b4be8cca86464270d83d0f5d4e3d4369c16ed22a5f4fa'
    }
    $archive = Join-Path $Runtime ($name + '.zip')
    $extract = Join-Path $Runtime 'unpack-temp'
    $sources = @(
        ('https://nodejs.org/dist/v' + $version + '/' + $name + '.zip'),
        ('https://r2.nodejs.org/dist/v' + $version + '/' + $name + '.zip')
    )
    Write-Host ''
    Write-Host '  No compatible local Node.js was found.' -ForegroundColor Yellow
    Write-Host '  Downloading a portable copy into ProjectHQ\runtime (one time)...'
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $success = $false
    foreach ($url in $sources) {
        try {
            if (Test-Path $archive) { Remove-Item -LiteralPath $archive -Force }
            $client = New-Object System.Net.WebClient
            try { $client.DownloadFile($url, $archive) } finally { $client.Dispose() }
            $actual = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
            if ($actual -ne $checksums[$arch]) { throw 'Downloaded file checksum did not match.' }
            $success = $true
            break
        } catch {
            Write-Host ('  Download failed: ' + $_.Exception.Message) -ForegroundColor Yellow
        }
    }
    if (-not $success) {
        if (Test-Path $archive) { Remove-Item -LiteralPath $archive -Force }
        throw 'Node could not be found or downloaded. Try running "node -v" in a new PowerShell window; if it works, send the version and the startup-error.txt file.'
    }
    try {
        if (Test-Path $extract) { Remove-Item -LiteralPath $extract -Recurse -Force }
        Expand-Archive -LiteralPath $archive -DestinationPath $extract -Force
        $binary = Join-Path $extract ($name + '\node.exe')
        if (-not (Test-Path -LiteralPath $binary -PathType Leaf)) { throw 'The Node archive did not contain node.exe.' }
        Copy-Item -LiteralPath $binary -Destination $PortableNode -Force
        $license = Join-Path $extract ($name + '\LICENSE')
        if (Test-Path $license) { Copy-Item -LiteralPath $license -Destination (Join-Path $Runtime 'NODE_LICENSE.txt') -Force }
    } finally {
        if (Test-Path $archive) { Remove-Item -LiteralPath $archive -Force }
        if (Test-Path $extract) { Remove-Item -LiteralPath $extract -Recurse -Force }
    }
    return $PortableNode
}


# First-run import: users never have to manually copy data between installations.
# Import never alters or deletes the old installation and only runs before HQ creates its own data.
function Offer-OldDataImport {
    $markers = @('workspace.json','ideas-workshop.json','autolyrical-outreach.json','artist-operators.json')
    foreach ($marker in $markers) {
        if (Test-Path -LiteralPath (Join-Path $DataDir $marker)) { return }
    }
    $candidates = New-Object System.Collections.Generic.List[string]
    $candidates.Add((Join-Path (Split-Path -Parent $Root) 'ProjectHQ-4.40'))
    $candidates.Add((Join-Path (Split-Path -Parent $Root) 'ProjectHQ-4.39.3'))
    $candidates.Add((Join-Path (Split-Path -Parent $Root) 'ProjectHQ-Startklar'))
    $candidates.Add((Join-Path (Split-Path -Parent $Root) 'ProjectHQ-Stabil'))
    $candidates.Add((Join-Path (Split-Path -Parent $Root) 'ProjectHQ'))
    try { $candidates.Add((Join-Path ([Environment]::GetFolderPath('Desktop')) 'ProjectHQ-4.40')) } catch { }
    try { $candidates.Add((Join-Path ([Environment]::GetFolderPath('Desktop')) 'ProjectHQ-Startklar')) } catch { }
    try { $candidates.Add((Join-Path ([Environment]::GetFolderPath('Desktop')) 'ProjectHQ-Stabil')) } catch { }
    try { $candidates.Add((Join-Path ([Environment]::GetFolderPath('Desktop')) 'ProjectHQ')) } catch { }
    if ($env:USERPROFILE) {
        $candidates.Add((Join-Path $env:USERPROFILE 'Desktop\ProjectHQ-Startklar'))
        $candidates.Add((Join-Path $env:USERPROFILE 'Desktop\ProjectHQ'))
        $candidates.Add((Join-Path $env:USERPROFILE 'OneDrive\Desktop\ProjectHQ'))
    }
    # Also discover newer side-by-side installs without guessing their exact folder names.
    foreach ($parent in @((Split-Path -Parent $Root), [Environment]::GetFolderPath('Desktop'))) {
        if ($parent -and (Test-Path -LiteralPath $parent -PathType Container)) {
            Get-ChildItem -LiteralPath $parent -Directory -Filter 'ProjectHQ*' -ErrorAction SilentlyContinue |
                Sort-Object LastWriteTime -Descending | ForEach-Object { $candidates.Add($_.FullName) }
        }
    }
    $oldData = $null
    $seen = @{}
    foreach ($candidate in $candidates) {
        if (-not $candidate -or $seen.ContainsKey($candidate.ToLowerInvariant())) { continue }
        $seen[$candidate.ToLowerInvariant()] = $true
        if (-not (Test-Path -LiteralPath $candidate -PathType Container)) { continue }
        if ([IO.Path]::GetFullPath($candidate).TrimEnd('\') -eq [IO.Path]::GetFullPath($Root).TrimEnd('\')) { continue }
        foreach ($rel in @('data','app\data')) {
            $possible = Join-Path $candidate $rel
            if (-not (Test-Path -LiteralPath $possible -PathType Container)) { continue }
            $found = $false
            foreach ($marker in $markers) { if (Test-Path -LiteralPath (Join-Path $possible $marker)) { $found = $true; break } }
            if ($found) { $oldData = $possible; break }
        }
        if ($oldData) { break }
    }
    if (-not $oldData) { return }
    Write-Host ''
    Write-Host '  En tidigare HQ-installation med sparade projekt hittades.' -ForegroundColor Cyan
    Write-Host ('  Kalla: ' + $oldData)
    Write-Host '  Det gamla HQ andras inte. Importera chattar, projekt och installningar automatiskt?'
    $answer = Read-Host '  Tryck Enter for JA, eller skriv N for ny tom installation'
    if ($answer -match '^(n|nej|no)$') {
        Write-Host '  Startar med en ny tom datauppsattning.' -ForegroundColor Yellow
        return
    }
    try {
        New-Item -ItemType Directory -Force -Path $DataDir | Out-Null
        # Copy all project data and optional private credentials only to this user's new local HQ.
        foreach ($item in @(Get-ChildItem -LiteralPath $oldData -Force -ErrorAction Stop)) {
            if ($item.Name -in @('server.pid','server-port.txt','server.log','server-errors.log','startup-error.txt')) { continue }
            Copy-Item -LiteralPath $item.FullName -Destination $DataDir -Recurse -Force -ErrorAction Stop
        }
        Set-Content -LiteralPath (Join-Path $DataDir 'imported-from.txt') -Value $oldData -Encoding UTF8
        Write-Host '  Dina gamla HQ-data har importerats till den nya installationen.' -ForegroundColor Green
    } catch {
        Write-Host ('  Importen misslyckades. Ditt gamla HQ ar orort: ' + $_.Exception.Message) -ForegroundColor Yellow
        throw 'Importfel. Stang gamla HQ och starta igen, eller kontrollera behorigheter i mapparna.'
    }
}

try {
    New-Item -ItemType Directory -Force -Path $DataDir | Out-Null
    # Clean-slate release: never import old personal projects or their credentials.
    Write-Host ''
    Write-Host ('  Project HQ ' + $ExpectedVersion + ' - kontrollerar server och portar...') -ForegroundColor Cyan

    # Reuse ONLY this installation's known port, not arbitrary old HQ windows.
    $previousPortFile = Join-Path $DataDir 'server-port.txt'
    if (Test-Path -LiteralPath $previousPortFile) {
        $previousRaw = (Get-Content -LiteralPath $previousPortFile -TotalCount 1 -ErrorAction SilentlyContinue)
        if ($previousRaw -match '^\s*\d{1,5}\s*$') {
            $previousPort = [int]$previousRaw.Trim()
            if ($previousPort -ge 1 -and $previousPort -le 65535) {
                if (Test-HQ $previousPort) {
                    Write-Host '  Denna installation ar redan igang.' -ForegroundColor Green
                    Open-HQ $previousPort
                    exit 0
                }
            }
        }
    }

    # Unlike the old version, a slow connection attempt cannot mark all ports occupied.
    $port = Find-AvailablePort
    Write-Host ('  Vald ledig port: ' + $port) -ForegroundColor Green
    Write-Host ('  Project HQ ' + $ExpectedVersion + ' - startar...') -ForegroundColor Magenta
    $startupErrorFile = Join-Path $DataDir 'startup-error.txt'
    if (Test-Path -LiteralPath $startupErrorFile) { Remove-Item -LiteralPath $startupErrorFile -Force -ErrorAction SilentlyContinue }
    $nodeExe = Get-CompatibleNode
    if (-not $nodeExe) { $nodeExe = Install-PortableNode }
    New-Item -ItemType Directory -Force -Path $DataDir | Out-Null
    $env:PROJECT_HQ_DATA_DIR = $DataDir
    $env:PROJECT_HQ_PORT = [string]$port
    $env:PROJECT_HQ_INSTALL_ID = $InstallId
    $stdout = Join-Path $DataDir 'server.log'
    $stderr = Join-Path $DataDir 'server-errors.log'
    Set-Content -LiteralPath $stdout -Value '' -Encoding UTF8
    Set-Content -LiteralPath $stderr -Value '' -Encoding UTF8
    $proc = Start-Process -FilePath $nodeExe -ArgumentList 'server.mjs' -WorkingDirectory $AppDir -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
    Set-Content -LiteralPath (Join-Path $DataDir 'server.pid') -Value ([string]$proc.Id) -Encoding ASCII
    Set-Content -LiteralPath (Join-Path $DataDir 'server-port.txt') -Value ([string]$port) -Encoding ASCII
    for ($i = 0; $i -lt 60; $i++) {
        Start-Sleep -Milliseconds 350
        if (Test-HQ $port) { Open-HQ $port; exit 0 }
        if ($proc.HasExited) { break }
    }
    $errorText = ''
    if (Test-Path $stderr) { $errorText = Get-Content -LiteralPath $stderr -Raw -ErrorAction SilentlyContinue }
    $hint = if ($proc.HasExited) { 'Node-servern avslutades. Se data\server-errors.log. ' } else { 'Servern startade men svarade inte med korrekt health. Se data\server.log och data\server-errors.log. ' }
    throw ('HQ kunde inte starta. ' + $hint + $errorText)

} catch {
    New-Item -ItemType Directory -Force -Path $DataDir | Out-Null
    $message = 'Project HQ startfel: ' + $_.Exception.Message
    Set-Content -LiteralPath (Join-Path $DataDir 'startup-error.txt') -Value $message -Encoding UTF8
    Write-Host $message -ForegroundColor Red
    Write-Host ('  Felrapport: ' + (Join-Path $DataDir 'startup-error.txt'))
    try {
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.MessageBox]::Show($message,'Project HQ - startup error','OK','Error') | Out-Null
    } catch { }
    exit 1
}
