@echo off
REM Hook to log tool usage
REM Called whenever Claude uses a tool

REM Call the CLI to log activity (suppress output)
node "C:\Users\eric\ClaudeTimeMCP\cli.js" log-activity tool_use > nul 2>&1

REM Exit successfully
exit /b 0
