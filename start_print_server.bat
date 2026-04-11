@echo off
title Atul POS Print Server
echo ================================
echo   Atul POS Print Server
echo   Port: 9191
echo   Printer: EPSON TM-T82 Receipt
echo ================================
echo.

REM Check if flask is installed
python -c "import flask" 2>nul
if errorlevel 1 (
    echo [INSTALL] Flask not found. Installing...
    pip install flask flask-cors
    echo.
)

REM Check if flask-cors is installed
python -c "import flask_cors" 2>nul
if errorlevel 1 (
    echo [INSTALL] flask-cors not found. Installing...
    pip install flask-cors
    echo.
)

REM Check if pywin32 is installed
python -c "import win32print" 2>nul
if errorlevel 1 (
    echo [INSTALL] pywin32 not found. Installing...
    pip install pywin32
    echo.
)

echo [START] Print server starting on http://127.0.0.1:9191
echo Keep this window open while POS is running.
echo.
python "%~dp0print_server.py"
pause
