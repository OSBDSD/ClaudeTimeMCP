@echo off
REM Hook to log tool usage - reads JSON from stdin
REM Called whenever Claude uses a tool

REM Read stdin (the hook JSON data) and pass to PowerShell for parsing
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
"$input = [Console]::In.ReadToEnd(); " ^
"$hookData = $input | ConvertFrom-Json; " ^
"$toolName = $hookData.tool_name; " ^
"$toolInput = $hookData.tool_input | ConvertTo-Json -Compress -Depth 5; " ^
"$timestamp = [DateTime]::UtcNow.ToString('o'); " ^
"$metadata = @{ tool = $toolName; input = ($toolInput | ConvertFrom-Json) } | ConvertTo-Json -Compress -Depth 5; " ^
"$metadataBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($metadata)); " ^
"& node 'C:\Users\eric\ClaudeTimeMCP\cli.js' log-activity tool_use $timestamp --metadata-base64 $metadataBase64"

exit /b 0
