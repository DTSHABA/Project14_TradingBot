@echo off
REM Server Startup Script
echo Starting Server...
cd /d "%~dp0"
pnpm dev
pause

