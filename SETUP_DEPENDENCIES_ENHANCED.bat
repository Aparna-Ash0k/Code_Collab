@echo off
setlocal enabledelayedexpansion

echo ========================================
echo CodeCollab - Complete Setup Script
echo (Includes Automatic Node.js Installation)
echo ========================================
echo.

:: Check if running as administrator
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] For best results, run as Administrator
    echo Right-click this file and select "Run as administrator"
    echo.
    timeout /t 3 /nobreak >nul
)

:: Check if Node.js is installed
echo [1/6] Checking Node.js installation...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo X Node.js is not installed!
    echo.
    echo [AUTO-INSTALL] Downloading and installing Node.js LTS...
    echo This will download approximately 30MB and install automatically.
    echo.
    
    :: Create temp directory
    if not exist "%temp%\codecollab" mkdir "%temp%\codecollab"
    
    :: Try multiple download methods
    set "DOWNLOAD_SUCCESS=0"
    
    :: Method 1: PowerShell download
    echo Attempting download via PowerShell...
    powershell -Command "try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.17.0/node-v20.17.0-x64.msi' -OutFile '%temp%\codecollab\nodejs-installer.msi' -UseBasicParsing; exit 0 } catch { exit 1 }"
    
    if exist "%temp%\codecollab\nodejs-installer.msi" (
        set "DOWNLOAD_SUCCESS=1"
        echo + Download successful via PowerShell
    ) else (
        echo - PowerShell download failed, trying alternative...
        
        :: Method 2: Curl download (if available)
        curl --version >nul 2>&1
        if !errorlevel! equ 0 (
            echo Attempting download via curl...
            curl -L -o "%temp%\codecollab\nodejs-installer.msi" "https://nodejs.org/dist/v20.17.0/node-v20.17.0-x64.msi"
            if exist "%temp%\codecollab\nodejs-installer.msi" (
                set "DOWNLOAD_SUCCESS=1"
                echo + Download successful via curl
            )
        )
    )
    
    if !DOWNLOAD_SUCCESS! equ 0 (
        echo X All download methods failed!
        echo.
        echo Please manually:
        echo 1. Go to: https://nodejs.org/
        echo 2. Download the LTS version for Windows x64
        echo 3. Install it
        echo 4. Run this script again
        echo.
        pause
        exit /b 1
    )
    
    :: Verify download
    if not exist "%temp%\codecollab\nodejs-installer.msi" (
        echo X Node.js installer not found after download
        echo Please manually install from: https://nodejs.org/
        pause
        exit /b 1
    )
    
    :: Install Node.js
    echo Installing Node.js (this may take 2-5 minutes)...
    echo Please wait, do not close this window...
    
    :: Silent installation
    msiexec /i "%temp%\codecollab\nodejs-installer.msi" /quiet /norestart ADDLOCAL=ALL
    
    if !errorlevel! neq 0 (
        echo X Installation failed with error code: !errorlevel!
        echo Trying interactive installation...
        msiexec /i "%temp%\codecollab\nodejs-installer.msi"
    )
    
    :: Wait for installation to complete
    echo Waiting for installation to complete...
    timeout /t 15 /nobreak >nul
    
    :: Update PATH for current session
    call :RefreshPath
    
    :: Verify installation
    echo Verifying Node.js installation...
    node --version >nul 2>&1
    if !errorlevel! neq 0 (
        echo X Node.js installation verification failed.
        echo.
        echo Please try:
        echo 1. Restart your computer
        echo 2. Run this script again
        echo.
        echo Or install manually from: https://nodejs.org/
        pause
        exit /b 1
    )
    
    :: Clean up
    del "%temp%\codecollab\nodejs-installer.msi" >nul 2>&1
    rmdir "%temp%\codecollab" >nul 2>&1
    
    echo + Node.js installed successfully!
    node --version
) else (
    echo + Node.js is already installed
    node --version
)

:: Check if npm is available
echo.
echo [2/6] Checking npm availability...
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo X npm is not available!
    echo This usually means Node.js installation is incomplete.
    echo Please reinstall Node.js from: https://nodejs.org/
    pause
    exit /b 1
) else (
    echo + npm is available
    npm --version
)

:: Install root dependencies
echo.
echo [3/6] Installing root project dependencies...
echo This may take a few minutes...
npm install
if %errorlevel% neq 0 (
    echo X Failed to install root dependencies
    echo.
    echo Trying with legacy peer deps...
    npm install --legacy-peer-deps
    if !errorlevel! neq 0 (
        echo X Still failed. Try manually:
        echo npm install --legacy-peer-deps --force
        pause
        exit /b 1
    )
)
echo + Root dependencies installed successfully

:: Install server dependencies
echo.
echo [4/6] Installing server dependencies...
cd server
npm install
if %errorlevel% neq 0 (
    echo X Failed to install server dependencies
    cd ..
    pause
    exit /b 1
)
echo + Server dependencies installed successfully
cd ..

:: Install client dependencies
echo.
echo [5/6] Installing client dependencies...
cd client
npm install
if %errorlevel% neq 0 (
    echo X Failed to install client dependencies
    echo Trying with legacy peer deps...
    npm install --legacy-peer-deps
    if !errorlevel! neq 0 (
        echo X Client dependency installation failed
        cd ..
        pause
        exit /b 1
    )
)
echo + Client dependencies installed successfully
cd ..

:: Final verification
echo.
echo [6/6] Final verification...
if exist "node_modules" (
    echo + Root node_modules found
) else (
    echo X Root node_modules missing
)

if exist "server\node_modules" (
    echo + Server node_modules found
) else (
    echo X Server node_modules missing
)

if exist "client\node_modules" (
    echo + Client node_modules found
) else (
    echo X Client node_modules missing
)

echo.
echo ========================================
echo + SETUP COMPLETE!
echo ========================================
echo.
echo To start the application:
echo 1. Double-click: START_APPLICATION.bat
echo.
echo Or manually:
echo 1. Open terminal in 'server' folder and run: node index.js
echo 2. Open another terminal in 'client' folder and run: npm start
echo.
echo The application will be available at:
echo ^ Frontend: http://localhost:3000
echo ^ Backend:  http://localhost:5000
echo.
echo Setup completed successfully! Ready to launch CodeCollab.
echo.
pause
goto :eof

:: Function to refresh PATH environment variable
:RefreshPath
for /f "usebackq tokens=2,*" %%A in (`reg query HKCU\Environment /v PATH`) do set "UserPath=%%B"
for /f "usebackq tokens=2,*" %%A in (`reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v PATH`) do set "SystemPath=%%B"
set "PATH=%SystemPath%;%UserPath%"
goto :eof