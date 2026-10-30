# Project HQ 4.46 – skapa genvägar för appstart. Körs automatiskt från STARTA_HQ.bat.
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Icon = Join-Path $Root 'assets\ProjectHQ.ico'
$StartScript = Join-Path $PSScriptRoot 'start.ps1'
$Powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
if (-not (Test-Path -LiteralPath $Powershell -PathType Leaf)) { $Powershell = 'powershell.exe' }
$Shell = New-Object -ComObject WScript.Shell
$Locations = @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'))
foreach ($Folder in $Locations) {
    if (-not $Folder -or -not (Test-Path -LiteralPath $Folder -PathType Container)) { continue }
    try {
        $LinkPath = Join-Path $Folder 'Project HQ.lnk'
        $Shortcut = $Shell.CreateShortcut($LinkPath)
        $Shortcut.TargetPath = $Powershell
        $Shortcut.Arguments = '-NoLogo -NoProfile -ExecutionPolicy Bypass -File "' + $StartScript + '"'
        $Shortcut.WorkingDirectory = $Root
        $Shortcut.IconLocation = $Icon + ',0'
        $Shortcut.Description = 'Starta din lokala Project HQ-arbetsyta'
        $Shortcut.WindowStyle = 1
        $Shortcut.Save()
    } catch { Write-Warning ('Kunde inte skapa genväg i ' + $Folder + ': ' + $_.Exception.Message) }
}
