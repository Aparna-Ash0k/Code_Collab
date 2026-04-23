@echo off
echo ========================================
echo CodeCollab - Application Launcher
echo ========================================
echo.

:: Check if dependencies are installed
echo [1/3] Checking if dependencies are installed...

if not exist "node_modules" (
    echo X Root dependencies not found!
    echo Please run SETUP_DEPENDENCIES.bat first
    pause
    exit /b 1
)

if not exist "server\node_modules" (
    echo X Server dependencies not found!
    echo Please run SETUP_DEPENDENCIES.bat first
    pause
    exit /b 1
)

if not exist "client\node_modules" (
    echo X Client dependencies not found!
    echo Please run SETUP_DEPENDENCIES.bat first
    pause
    exit /b 1
)

echo + All dependencies found

:: Start the server in background
echo.
echo [2/3] Starting backend server...
cd server
start "CodeCollab Server" cmd /c "node index.js & pause"
cd ..

:: Wait a moment for server to initialize
timeout /t 3 /nobreak >nul

:: Start the client
echo.
echo [3/3] Starting frontend client...
cd client
echo.
echo ^ Starting CodeCollab...
echo.
echo The application will open automatically in your browser.
echo.
echo Available at:
echo ^ Frontend: http://localhost:3000
echo ^ Backend:  http://localhost:5000
echo.
echo Press Ctrl+C in either window to stop the application.
echo.
npm start
cd ..