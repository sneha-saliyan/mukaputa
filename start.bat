@echo off
TITLE Mukaputa Launcher
COLOR 0A

:: Ensure the script runs in the correct directory
cd /d "%~dp0"

echo =======================================
echo     Starting Mukaputa Setup and Server
echo =======================================
echo.

:: Check if Python is installed globally
python --version >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    COLOR 0C
    echo ERROR: Python is not installed or not added to your PATH!
    echo Please install Python 3 from https://www.python.org/downloads/
    echo Make sure to check the box "Add Python to PATH" during installation.
    echo.
    pause
    exit /b
)

:: Set VENV path outside of OneDrive to prevent Sync locks and WinError 32
set "VENV_DIR=%LOCALAPPDATA%\Mukaputa_Venv"

echo [1/3] Setting up Python Virtual Environment...
IF NOT EXIST "%VENV_DIR%\Scripts\pip.exe" (
    echo Creating virtual environment, this may take a few seconds...
    python -m venv "%VENV_DIR%"
)

echo [2/3] Installing/Updating required dependencies...
"%VENV_DIR%\Scripts\python.exe" -m pip install --upgrade pip >nul 2>&1
"%VENV_DIR%\Scripts\pip.exe" install -r requirements.txt

echo.
echo [3/3] Starting the Server...
:: Launch server using the isolated python executable
start "Mukaputa Server" cmd /k "TITLE Mukaputa Server && COLOR 0B && "%VENV_DIR%\Scripts\python.exe" run.py"

echo Waiting for the server to boot up...
timeout /t 5 /nobreak > nul

echo Opening Mukaputa in your default web browser...
start http://localhost:5000

echo Done! You can close this launcher window now.
echo Please leave the new "Mukaputa Server" window open while using the app!
timeout /t 5 > nul
