@echo off
title Atul POS Print Server
echo ================================
echo   Atul POS Print Server
echo   Port: 6789
echo   Printer: EPSON TM-T81 Receipt
echo ================================
echo.

REM Check if pywin32 is installed
python -c "import win32print" 2>nul
if errorlevel 1 (
    echo [INSTALL] pywin32 not found. Installing...
    pip install pywin32
    echo.
)

echo [START] Print server starting...
echo Keep this window open while POS is running.
echo.
python "%~dp0print_server.py"
pause
