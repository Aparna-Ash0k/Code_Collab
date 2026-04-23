@echo off
echo ========================================
echo CodeCollab Package Creator
echo ========================================
echo.
echo This will create a complete zip package of your CodeCollab project
echo including all source code, configuration files, and setup scripts.
echo.
echo The package will be saved to your Desktop.
echo.
pause

echo Running package creator...
powershell.exe -ExecutionPolicy Bypass -File "CREATE_PACKAGE.ps1"

if %errorlevel% equ 0 (
    echo.
    echo ✅ Package created successfully!
) else (
    echo.
    echo ❌ Error creating package
    echo Try running CREATE_PACKAGE.ps1 directly in PowerShell
)

echo.
pause