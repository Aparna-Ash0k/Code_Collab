# Script to create a complete team package including ALL necessary files
# This includes .gitignore, .env files, Firebase admin SDK, and all source code

$sourceDir = "d:\c1"
$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$zipName = "codecollab_v2_complete_$timestamp.zip"
$zipPath = Join-Path $sourceDir $zipName

# Only exclude build artifacts and dependencies that can be reinstalled
$excludeFolders = @(
    'node_modules',
    'build',
    'dist',
    'lib'
)

Write-Host "Creating comprehensive team package..." -ForegroundColor Green
Write-Host "Including: ALL source code, .gitignore, .env files, Firebase admin SDK, configurations" -ForegroundColor Cyan
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
Write-Host "+ All source code (src, functions, landing, dev-server)" -ForegroundColor White
Write-Host "+ .gitignore files (root and subdirectories)" -ForegroundColor White
Write-Host "+ .env and .env.example files" -ForegroundColor White
Write-Host "+ Firebase admin SDK (dev-server/codecollab-v2-firebase-adminsdk.json)" -ForegroundColor White
Write-Host "+ Configuration files (package.json, tsconfig.json, vite.config.ts, etc.)" -ForegroundColor White
Write-Host "+ Firebase configuration (firebase.json, firestore.rules, firestore.indexes.json)" -ForegroundColor White
Write-Host "+ Data Connect schemas and queries (dataconnect folder)" -ForegroundColor White
Write-Host "+ HTML files (index.html, landing/index.html)" -ForegroundColor White
Write-Host "+ Public assets (logos, icons, images)" -ForegroundColor White
Write-Host "+ All component code and utilities" -ForegroundColor White
Write-Host "+ Git repository (.git folder for version history)" -ForegroundColor White
Write-Host "+ Scripts (create-team-package.ps1, install-node.bat)" -ForegroundColor White
Write-Host "`nExcluded (teammates will install these):" -ForegroundColor Yellow
Write-Host "- node_modules folders (run 'npm install' to restore)" -ForegroundColor Gray
Write-Host "- Build outputs (build, dist, lib folders)" -ForegroundColor Gray
