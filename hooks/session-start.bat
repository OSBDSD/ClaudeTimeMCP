@echo off
REM Hook to log session start
REM Called when Claude Code session begins

REM Get the project directory from environment or use current directory
set PROJECT_DIR=%CD%

REM Call the CLI to start session
node "C:\Users\eric\ClaudeTimeMCP\cli.js" session-start "%PROJECT_DIR%" > nul 2>&1

REM Exit successfully
exit /b 0
