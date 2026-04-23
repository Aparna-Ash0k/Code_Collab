@echo off
echo ============================================
echo CodeCollab - Automatic Node.js Installer
echo ============================================
echo.
echo This script will automatically download and install Node.js LTS
echo if it's not already installed on your system.
echo.

REM Check if Node.js is already installed
echo Checking for existing Node.js installation...
node --version >nul 2>&1
if %errorlevel% equ 0 (
    echo Node.js is already installed:
    node --version
    npm --version
    echo.
    echo Skipping installation. You can proceed with setup.
    goto :setup
)

echo Node.js not found. Starting automatic installation...
echo.

REM Create temp directory for download
set TEMP_DIR=%TEMP%\NodeJS_Install
if not exist "%TEMP_DIR%" mkdir "%TEMP_DIR%"

echo ============================================
echo Downloading Node.js LTS...
echo ============================================
echo.

REM Download Node.js LTS installer (64-bit)
set NODE_URL=https://nodejs.org/dist/v20.17.0/node-v20.17.0-x64.msi
set NODE_INSTALLER=%TEMP_DIR%\nodejs-installer.msi

echo Downloading from: %NODE_URL%
echo Please wait, this may take a few minutes...

REM Use PowerShell to download (more reliable than other methods)
powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%NODE_INSTALLER%' -UseBasicParsing}"

if not exist "%NODE_INSTALLER%" (
    echo ERROR: Failed to download Node.js installer!
    echo.
    echo Please manually download Node.js from https://nodejs.org/
    echo Choose the LTS version and run the installer.
    echo Then run this script again.
    pause
    exit /b 1
)

echo Download completed successfully!
echo.

echo ============================================
echo Installing Node.js...
echo ============================================
echo.
echo The Node.js installer will now open.
echo Please follow the installation wizard:
echo.
echo 1. Click "Next" through the setup
echo 2. Accept the license agreement
echo 3. Keep default installation path
echo 4. Make sure "Add to PATH" is checked
echo 5. Click "Install" and wait for completion
echo.

pause

REM Run the installer
echo Starting Node.js installer...
start /wait msiexec /i "%NODE_INSTALLER%" /quiet /norestart

REM Check if installation was successful
echo.
echo Verifying installation...

REM Refresh environment variables
call refreshenv.cmd >nul 2>&1

REM Check again for Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo Installation may need a system restart to complete.
    echo Please:
    echo 1. Restart your computer
    echo 2. Run this script again to verify installation
    echo 3. Or manually check by opening a new command prompt and typing: node --version
    echo.
    pause
    exit /b 1
)

echo.
echo ============================================
echo Node.js Installation Successful!
echo ============================================
echo.
echo Installed versions:
node --version
npm --version

REM Clean up downloaded installer
if exist "%NODE_INSTALLER%" del "%NODE_INSTALLER%"
if exist "%TEMP_DIR%" rmdir "%TEMP_DIR%"

:setup
echo.
echo ============================================
echo Ready for CodeCollab Setup!
echo ============================================
echo.
echo Node.js is now installed and ready.
echo.
echo Next steps:
echo 1. Extract the CodeCollab ZIP file if you haven't already
echo 2. Double-click QUICK_START.bat in the extracted folder
echo 3. Or run setup.bat for manual setup
echo.

set /p continue="Would you like to continue with CodeCollab setup now? (y/n): "
if /i "%continue%"=="y" (
    if exist "QUICK_START.bat" (
        echo Starting CodeCollab setup...
        call QUICK_START.bat
    ) else if exist "setup.bat" (
        echo Starting CodeCollab setup...
        call setup.bat
    ) else (
        echo Please extract the CodeCollab ZIP file first, then run QUICK_START.bat
    )
)

echo.
echo Installation complete! You can now use CodeCollab.
pause
