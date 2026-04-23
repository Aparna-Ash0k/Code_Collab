@echo off
echo ========================================
echo CodeCollab - Complete Setup Script
echo ========================================
echo.

:: Check if Node.js is installed
echo [1/6] Checking Node.js installation...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo X Node.js is not installed!
    echo.
    echo [AUTO-INSTALL] Downloading and installing Node.js...
    echo This will download Node.js LTS and install it automatically.
    echo.
    
    :: Create temp directory
    if not exist "%temp%\codecollab" mkdir "%temp%\codecollab"
    
    :: Download Node.js LTS installer
    echo Downloading Node.js installer...
    powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.17.0/node-v20.17.0-x64.msi' -OutFile '%temp%\codecollab\nodejs-installer.msi'}"
    
    if not exist "%temp%\codecollab\nodejs-installer.msi" (
        echo X Failed to download Node.js installer
        echo Please manually download from: https://nodejs.org/
        pause
        exit /b 1
    )
    
    :: Install Node.js
    echo Installing Node.js (this may take a few minutes)...
    msiexec /i "%temp%\codecollab\nodejs-installer.msi" /quiet /norestart
    
    :: Wait for installation to complete
    echo Waiting for installation to complete...
    timeout /t 10 /nobreak >nul
    
    :: Refresh environment variables
    call refreshenv >nul 2>&1 || (
        echo Please close and reopen this command prompt, then run this script again.
        pause
        exit /b 1
    )
    
    :: Verify installation
    node --version >nul 2>&1
    if %errorlevel% neq 0 (
        echo X Node.js installation may not be complete.
        echo Please restart your computer and run this script again.
        echo Or manually install from: https://nodejs.org/
        pause
        exit /b 1
    )
    
    :: Clean up
    del "%temp%\codecollab\nodejs-installer.msi" >nul 2>&1
    rmdir "%temp%\codecollab" >nul 2>&1
    
    echo + Node.js installed successfully!
) else (
    echo + Node.js is already installed
    node --version
)

:: Check if npm is available
echo.
::
echo [2/6] Checking npm availability...
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo X npm is not available!
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
    echo Try running: npm install --legacy-peer-deps
    echo Or delete node_modules folder and try again
    pause
    exit /b 1
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
    cd ..
    pause
    exit /b 1
)
echo + Client dependencies installed successfully
cd ..

echo.
echo ========================================
echo + SETUP COMPLETE!
echo ========================================
echo.
echo To start the application:
echo 1. Run: START_APPLICATION.bat
echo.
echo Or manually:
echo 1. Open terminal in 'server' folder and run: node index.js
echo 2. Open another terminal in 'client' folder and run: npm start
echo.
echo The application will be available at:
echo ^ Frontend: http://localhost:3000
echo ^ Backend:  http://localhost:5000
echo.
pause