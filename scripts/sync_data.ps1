$upstreamDir = Join-Path $PSScriptRoot "..\data\upstream"
if (-not (Test-Path $upstreamDir)) { 
    New-Item -ItemType Directory -Path $upstreamDir -Force | Out-Null
}

$zipPath = "$env:TEMP\marvelsdb-data.zip"
Write-Host "Downloading zzorba/marvelsdb-json-data archive from GitHub..."
Invoke-WebRequest -Uri "https://github.com/zzorba/marvelsdb-json-data/archive/refs/heads/master.zip" -OutFile $zipPath

Write-Host "Extracting into data/upstream..."
$tempExtract = "$env:TEMP\marvelsdb_temp"
if (Test-Path $tempExtract) { Remove-Item $tempExtract -Recurse -Force }
Expand-Archive -Path $zipPath -DestinationPath $tempExtract -Force

$extractedFolder = Get-ChildItem $tempExtract | Select-Object -First 1
Copy-Item -Path "$($extractedFolder.FullName)\*" -Destination $upstreamDir -Recurse -Force

Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
Remove-Item $tempExtract -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Data sync complete! Upstream files:"
Get-ChildItem -Path $upstreamDir | Select-Object Name, Length
