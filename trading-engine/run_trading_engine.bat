@echo off
REM Trading Engine Startup Script
echo Starting Trading Engine...
cd /d "%~dp0"
python -m src.main
pause

