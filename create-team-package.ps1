# Script to create a complete team package excluding only build artifacts and dependencies

$sourceDir = "d:\v2"
$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$zipName = "codecollab_v2_complete_$timestamp.zip"
$zipPath = Join-Path $sourceDir $zipName

# Folders to exclude
$excludeFolders = @(
    'node_modules',
    '.git',
    'build',
    'dist',
    'lib',
    '.playwright-mcp'
)

Write-Host "Creating comprehensive team package..." -ForegroundColor Green
Write-Host "Excluding folders: $($excludeFolders -join ', ')" -ForegroundColor Yellow

# Get all files recursively, excluding specified folders
$filesToZip = Get-ChildItem -Path $sourceDir -Recurse -File -Force | Where-Object {
    $filePath = $_.FullName
    $shouldExclude = $false
    
    foreach ($excludeFolder in $excludeFolders) {
        if ($filePath -like "*\$excludeFolder\*") {
            $shouldExclude = $true
            break
        }
    }
    
    # Also exclude the zip file itself if it exists
    if ($filePath -eq $zipPath) {
        $shouldExclude = $true
    }
    
    # Also exclude any previous zip files
    if ($_.Extension -eq '.zip' -and $_.DirectoryName -eq $sourceDir) {
        $shouldExclude = $true
    }
    
    -not $shouldExclude
}

Write-Host "Found $($filesToZip.Count) files to package" -ForegroundColor Cyan

# Create a temporary folder structure
$tempDir = Join-Path $env:TEMP "codecollab_package_$timestamp"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

Write-Host "Copying files to temporary location..." -ForegroundColor Green

# Copy files maintaining directory structure
foreach ($file in $filesToZip) {
    $relativePath = $file.FullName.Substring($sourceDir.Length + 1)
    $destPath = Join-Path $tempDir $relativePath
    $destDir = Split-Path $destPath -Parent
    
    if (-not (Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }
    
    Copy-Item -Path $file.FullName -Destination $destPath -Force
}

Write-Host "Creating zip file..." -ForegroundColor Green

# Create the zip file
Compress-Archive -Path "$tempDir\*" -DestinationPath $zipPath -CompressionLevel Optimal -Force

# Clean up temp directory
Remove-Item -Path $tempDir -Recurse -Force

Write-Host "`nPackage created successfully!" -ForegroundColor Green
Write-Host "Location: $zipPath" -ForegroundColor Cyan
Write-Host "Size: $([math]::Round((Get-Item $zipPath).Length / 1MB, 2)) MB" -ForegroundColor Cyan

# List what's included
Write-Host "`nPackage includes:" -ForegroundColor Yellow
Write-Host "+ All source code (src, functions, landing, dev-server, codecollab01)" -ForegroundColor White
Write-Host "+ Configuration files (package.json, tsconfig.json, vite.config.ts, etc.)" -ForegroundColor White
Write-Host "+ Environment files (.env* files)" -ForegroundColor White
Write-Host "+ Firebase configuration (firebase.json, firestore.rules, firestore.indexes.json)" -ForegroundColor White
Write-Host "+ Data Connect schemas and queries (dataconnect folder)" -ForegroundColor White
Write-Host "+ HTML files (index.html, landing/index.html)" -ForegroundColor White
Write-Host "+ Public assets (logos, icons, images)" -ForegroundColor White
Write-Host "+ All component code" -ForegroundColor White
Write-Host "+ Utility functions" -ForegroundColor White
Write-Host "+ Service files" -ForegroundColor White
Write-Host "+ Email setup documentation" -ForegroundColor White
Write-Host "`nExcluded (teammates will install these):" -ForegroundColor Yellow
Write-Host "- node_modules folders" -ForegroundColor Gray
Write-Host "- Build outputs (build, dist, lib folders)" -ForegroundColor Gray
Write-Host "- Git history (.git folder)" -ForegroundColor Gray
