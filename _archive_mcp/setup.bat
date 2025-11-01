@echo off
REM Windows wrapper for ClaudeTimeMCP setup

echo Running ClaudeTimeMCP global setup...
echo.

node "%~dp0setup.js"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Setup failed with error code %ERRORLEVEL%
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo Press any key to exit...
pause >nul
