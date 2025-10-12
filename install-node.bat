@echo off
REM ============================================
REM Node.js and npm Installation Script
REM ============================================
echo.
echo ========================================
echo Node.js and npm Installation Helper
echo ========================================
echo.

REM Check if Node.js is already installed
where node >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [INFO] Node.js is already installed!
    echo.
    node --version
    npm --version
    echo.
    echo If you want to update Node.js, please visit:
    echo https://nodejs.org/
    echo.
    pause
    exit /b 0
)

echo [INFO] Node.js is not installed on this system.
echo.
echo ========================================
echo Installation Options
echo ========================================
echo.
echo Option 1: Download and Install Node.js Manually (Recommended)
echo   - Most reliable method
echo   - Includes npm automatically
echo   - LTS version recommended for production
echo.
echo Option 2: Install using Chocolatey (if you have it)
echo   - Quick automated installation
echo   - Requires Chocolatey package manager
echo.
echo Option 3: Install using Winget (Windows Package Manager)
echo   - Built into Windows 10/11
echo   - Automated installation
echo.

:MENU
echo.
echo What would you like to do?
echo.
echo [1] Open Node.js download page (Manual Install - Recommended)
echo [2] Install via Chocolatey
echo [3] Install via Winget
echo [4] Check if Node.js is installed
echo [5] Exit
echo.
set /p choice="Enter your choice (1-5): "

if "%choice%"=="1" goto MANUAL
if "%choice%"=="2" goto CHOCO
if "%choice%"=="3" goto WINGET
if "%choice%"=="4" goto CHECK
if "%choice%"=="5" goto END

echo Invalid choice. Please try again.
goto MENU

:MANUAL
echo.
echo Opening Node.js download page in your browser...
echo.
echo Please download and install:
echo   - Node.js LTS (Long Term Support) - Recommended
echo   - OR Node.js Current (Latest Features)
echo.
echo After installation, restart this script to verify.
echo.
start https://nodejs.org/en/download/
pause
goto END

:CHOCO
echo.
echo Checking for Chocolatey...
where choco >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Chocolatey is not installed!
    echo.
    echo To install Chocolatey, run PowerShell as Administrator and execute:
    echo Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    echo.
    echo Or visit: https://chocolatey.org/install
    echo.
    pause
    goto MENU
)

echo [INFO] Chocolatey found! Installing Node.js...
echo.
echo This requires Administrator privileges.
echo Please confirm the UAC prompt if it appears.
echo.
choco install nodejs-lts -y
if %ERRORLEVEL% EQU 0 (
    echo.
    echo [SUCCESS] Node.js installed successfully!
    echo.
    echo Please close and reopen your terminal, then run:
    echo   node --version
    echo   npm --version
    echo.
) else (
    echo.
    echo [ERROR] Installation failed. Please try manual installation.
    echo.
)
pause
goto END

:WINGET
echo.
echo Checking for Winget...
where winget >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Winget is not available!
    echo.
    echo Winget comes with Windows 10 (version 1809+) and Windows 11.
    echo If you don't have it, please use Option 1 (Manual Install).
    echo.
    pause
    goto MENU
)

echo [INFO] Winget found! Installing Node.js...
echo.
echo This may require Administrator privileges.
echo.
winget install OpenJS.NodeJS.LTS
if %ERRORLEVEL% EQU 0 (
    echo.
    echo [SUCCESS] Node.js installed successfully!
    echo.
    echo Please close and reopen your terminal, then run:
    echo   node --version
    echo   npm --version
    echo.
) else (
    echo.
    echo [ERROR] Installation failed. Please try manual installation.
    echo.
)
pause
goto END

:CHECK
echo.
echo Checking for Node.js and npm...
echo.
where node >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Node.js is installed!
    echo.
    node --version
    npm --version
    echo.
) else (
    echo [ERROR] Node.js is not installed.
    echo Please choose an installation option from the menu.
    echo.
)
pause
goto MENU

:END
echo.
echo ========================================
echo Next Steps After Installation
echo ========================================
echo.
echo 1. Close and reopen your terminal/command prompt
echo 2. Verify installation:
echo    node --version
echo    npm --version
echo.
echo 3. Install project dependencies:
echo    npm install
echo    cd functions ^&^& npm install
echo    cd ../landing ^&^& npm install
echo    cd ../dev-server ^&^& npm install
echo.
echo 4. Run the development server:
echo    npm run dev
echo.
echo For more help, visit: https://nodejs.org/en/docs/
echo.
pause
