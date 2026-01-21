@echo off
setlocal EnableDelayedExpansion
title MT5 Trading Bot - Complete Setup
color 0B
cls

echo ============================================================
echo   MT5 TRADING BOT - COMPLETE SETUP
echo ============================================================
echo.
echo This script will:
echo   1. Start MT5 API Service
echo   2. Start ngrok tunnel (creates public URL)
echo   3. Update VPS backend configuration
echo   4. Test the connection
echo.
echo ============================================================
echo.

REM ========================================
REM STEP 1: Check and install ngrok
REM ========================================
echo [STEP 1/5] Checking ngrok installation...

set NGROK_PATH=
if exist "C:\ngrok\ngrok.exe" set NGROK_PATH=C:\ngrok\ngrok.exe
if exist "%USERPROFILE%\ngrok\ngrok.exe" set NGROK_PATH=%USERPROFILE%\ngrok\ngrok.exe
if exist "%~dp0ngrok.exe" set NGROK_PATH=%~dp0ngrok.exe

if "%NGROK_PATH%"=="" (
    echo.
    echo [!] ngrok not found. Downloading...
    echo.
    
    REM Create ngrok directory
    if not exist "C:\ngrok" mkdir "C:\ngrok"
    
    REM Download ngrok
    echo Downloading ngrok...
    powershell -Command "Invoke-WebRequest -Uri 'https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip' -OutFile '%TEMP%\ngrok.zip'"
    
    if not exist "%TEMP%\ngrok.zip" (
        echo.
        echo [ERROR] Failed to download ngrok
        echo Please download manually from: https://ngrok.com/download
        echo Extract ngrok.exe to C:\ngrok\
        pause
        exit /b 1
    )
    
    echo Extracting ngrok...
    powershell -Command "Expand-Archive -Path '%TEMP%\ngrok.zip' -DestinationPath 'C:\ngrok' -Force"
    del "%TEMP%\ngrok.zip" >nul 2>&1
    
    set NGROK_PATH=C:\ngrok\ngrok.exe
    
    if not exist "!NGROK_PATH!" (
        echo [ERROR] Failed to extract ngrok
        pause
        exit /b 1
    )
    
    echo [OK] ngrok downloaded and installed
)

echo [OK] ngrok found at: %NGROK_PATH%

REM Check ngrok auth
echo.
echo Checking ngrok authentication...
"%NGROK_PATH%" config check >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ============================================================
    echo   NGROK SETUP REQUIRED (one-time only)
    echo ============================================================
    echo.
    echo 1. Go to: https://dashboard.ngrok.com/signup
    echo 2. Sign up for FREE
    echo 3. Copy your authtoken from:
    echo    https://dashboard.ngrok.com/get-started/your-authtoken
    echo.
    set /p NGROK_TOKEN="Paste your ngrok authtoken here: "
    
    if "!NGROK_TOKEN!"=="" (
        echo [ERROR] No token provided
        pause
        exit /b 1
    )
    
    "%NGROK_PATH%" config add-authtoken !NGROK_TOKEN!
    
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to configure ngrok
        pause
        exit /b 1
    )
    
    echo [OK] ngrok configured
)
echo [OK] ngrok authenticated

REM ========================================
REM STEP 2: Kill existing processes
REM ========================================
echo.
echo [STEP 2/5] Stopping existing services...
taskkill /IM python.exe /F /T >nul 2>&1
taskkill /IM ngrok.exe /F /T >nul 2>&1
timeout /t 2 /nobreak >nul
echo [OK] Cleaned up

REM ========================================
REM STEP 3: Start MT5 API
REM ========================================
echo.
echo [STEP 3/5] Starting MT5 API Service...

REM Start MT5 Terminal if not running
tasklist /FI "IMAGENAME eq terminal64.exe" 2>NUL | find /I /N "terminal64.exe">NUL
if "%ERRORLEVEL%"=="1" (
    echo Starting MetaTrader 5 Terminal...
    if exist "C:\Program Files\MetaTrader\terminal64.exe" (
        start "" "C:\Program Files\MetaTrader\terminal64.exe"
    ) else if exist "C:\Program Files\MetaTrader 5\terminal64.exe" (
        start "" "C:\Program Files\MetaTrader 5\terminal64.exe"
    ) else (
        echo [WARNING] MT5 Terminal not found at default location
        echo Please start MetaTrader 5 manually
    )
    timeout /t 3 /nobreak >nul
)

REM Start MT5 API
cd /d "%~dp0trading-engine"
if not exist "venv\Scripts\python.exe" (
    echo [ERROR] Virtual environment not found
    echo Please run: python -m venv venv
    echo Then: venv\Scripts\pip install -r requirements.txt
    pause
    exit /b 1
)

start "MT5 API" cmd /k "title MT5 API Service - KEEP OPEN && color 0A && echo Starting MT5 API... && venv\Scripts\python.exe mt5_api.py"
cd /d "%~dp0"

echo Waiting for MT5 API to start...
timeout /t 5 /nobreak >nul

REM Test MT5 API
set API_OK=0
for /L %%i in (1,1,5) do (
    curl -s http://localhost:5001/health >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        set API_OK=1
        goto :api_ok
    )
    timeout /t 2 /nobreak >nul
)

:api_ok
if %API_OK%==0 (
    echo [ERROR] MT5 API failed to start
    echo Check the MT5 API window for errors
    pause
    exit /b 1
)
echo [OK] MT5 API running on port 5001

REM ========================================
REM STEP 4: Start ngrok
REM ========================================
echo.
echo [STEP 4/5] Starting ngrok tunnel...

start "ngrok" cmd /k "title ngrok Tunnel - KEEP OPEN && color 0E && "%NGROK_PATH%" http 5001 --log stdout"

echo Waiting for ngrok to initialize...
timeout /t 8 /nobreak >nul

REM Get ngrok URL
set NGROK_URL=
for /L %%i in (1,1,5) do (
    for /f "tokens=*" %%a in ('curl -s http://localhost:4040/api/tunnels 2^>nul ^| findstr "https://"') do (
        set TEMP_LINE=%%a
    )
    if defined TEMP_LINE goto :got_url
    timeout /t 2 /nobreak >nul
)

:got_url
REM Extract URL from JSON
if defined TEMP_LINE (
    for /f "tokens=2 delims=:" %%a in ("!TEMP_LINE!") do (
        set PART=%%a
        set PART=!PART:"=!
        set PART=!PART:,=!
        if "!PART:~0,5!"=="//www" set NGROK_URL=https:!PART!
        if "!PART:~0,2!"=="//" set NGROK_URL=https:!PART!
    )
)

REM Try PowerShell extraction if that failed
if not defined NGROK_URL (
    for /f "tokens=*" %%a in ('powershell -Command "(Invoke-WebRequest -Uri 'http://localhost:4040/api/tunnels' -UseBasicParsing).Content | ConvertFrom-Json | Select-Object -ExpandProperty tunnels | Where-Object { $_.proto -eq 'https' } | Select-Object -ExpandProperty public_url" 2^>nul') do (
        set NGROK_URL=%%a
    )
)

if not defined NGROK_URL (
    echo.
    echo ============================================================
    echo   MANUAL STEP REQUIRED
    echo ============================================================
    echo.
    echo Could not auto-detect ngrok URL.
    echo.
    echo Look at the ngrok window and find the HTTPS URL like:
    echo   Forwarding  https://xxxx-xx-xx-xx-xx.ngrok-free.app
    echo.
    set /p NGROK_URL="Paste the HTTPS URL here: "
)

if not defined NGROK_URL (
    echo [ERROR] No ngrok URL provided
    pause
    exit /b 1
)

echo.
echo [OK] ngrok URL: %NGROK_URL%

REM ========================================
REM STEP 5: Update VPS
REM ========================================
echo.
echo [STEP 5/5] Updating VPS configuration...
echo.

REM Create a temporary script to update VPS
echo cd /home/scalpingbot/app/server > "%TEMP%\update_vps.sh"
echo sed -i 's|^MT5_API_URL=.*|MT5_API_URL=%NGROK_URL%|' .env >> "%TEMP%\update_vps.sh"
echo grep -q "MT5_API_URL" .env ^|^| echo "MT5_API_URL=%NGROK_URL%" ^>^> .env >> "%TEMP%\update_vps.sh"
echo echo "Updated .env:" >> "%TEMP%\update_vps.sh"
echo grep MT5_API_URL .env >> "%TEMP%\update_vps.sh"
echo cd /home/scalpingbot/app >> "%TEMP%\update_vps.sh"
echo pm2 restart backend --update-env >> "%TEMP%\update_vps.sh"
echo pm2 status >> "%TEMP%\update_vps.sh"
echo echo "Testing connection..." >> "%TEMP%\update_vps.sh"
echo sleep 3 >> "%TEMP%\update_vps.sh"
echo curl -s %NGROK_URL%/health ^|^| echo "Note: First request may be slow" >> "%TEMP%\update_vps.sh"

echo Connecting to VPS (may ask for password)...
ssh root@72.62.185.168 "bash -s" < "%TEMP%\update_vps.sh"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ============================================================
    echo   MANUAL VPS UPDATE REQUIRED
    echo ============================================================
    echo.
    echo SSH connection failed. Please update VPS manually:
    echo.
    echo 1. Open a NEW terminal and run:
    echo    ssh root@72.62.185.168
    echo.
    echo 2. Then run these commands:
    echo    cd /home/scalpingbot/app/server
    echo    nano .env
    echo.
    echo 3. Find or add this line:
    echo    MT5_API_URL=%NGROK_URL%
    echo.
    echo 4. Save (Ctrl+X, Y, Enter) and run:
    echo    cd /home/scalpingbot/app
    echo    pm2 restart backend --update-env
    echo.
    echo 5. Test with:
    echo    curl %NGROK_URL%/health
    echo.
    pause
) else (
    echo.
    echo [OK] VPS updated and backend restarted
)

del "%TEMP%\update_vps.sh" >nul 2>&1

REM ========================================
REM COMPLETE
REM ========================================
echo.
echo ============================================================
echo   SETUP COMPLETE!
echo ============================================================
echo.
echo   MT5 API:     http://localhost:5001
echo   ngrok URL:   %NGROK_URL%
echo.
echo   IMPORTANT: Keep these windows open:
echo     - MT5 API Service (green window)
echo     - ngrok Tunnel (yellow window)
echo.
echo ============================================================
echo   TEST YOUR BOT NOW
echo ============================================================
echo.
echo 1. Open: https://aibotrades.com
echo 2. Login to your account
echo 3. Go to Dashboard - should show MT5 account data
echo 4. If onboarding, connect your MT5 account
echo.
echo If connection fails:
echo   - Check MT5 API window for errors
echo   - Check ngrok window shows "online"
echo   - Verify MT5 Terminal is logged in
echo.
echo ============================================================
echo.
echo Press any key to open the website...
pause >nul
start "" "https://aibotrades.com"
