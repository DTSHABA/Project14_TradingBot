@echo off
REM MT5 API Service Startup Script
REM This runs the Python MT5 API service for the Node.js server

echo Starting MT5 API Service...
echo =============================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python is not installed or not in PATH
    echo Please install Python 3.8+ from python.org
    pause
    exit /b 1
)

REM Check if virtual environment exists
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
    if errorlevel 1 (
        echo Error: Failed to create virtual environment
        pause
        exit /b 1
    )
)

REM Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat

REM Install/update dependencies
echo Installing dependencies...
pip install -r requirements.txt --quiet

echo.
echo =============================
echo MT5 API Service is starting...
echo =============================
echo.
echo Service will be available at: http://127.0.0.1:5001
echo Health check: http://127.0.0.1:5001/health
echo.
echo Press Ctrl+C to stop the service
echo.

REM Run the MT5 API service
python mt5_api.py

pause





