@echo off
REM Hook to log user message - reads JSON from stdin
REM Called when user submits a prompt

REM Read stdin and extract user prompt
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
"$input = [Console]::In.ReadToEnd(); " ^
"$hookData = $input | ConvertFrom-Json; " ^
"$timestamp = [DateTime]::UtcNow.ToString('o'); " ^
"$prompt = ''; " ^
"if ($hookData.PSObject.Properties.Name -contains 'user_prompt') { $prompt = $hookData.user_prompt; } " ^
"$metadata = @{ prompt = $prompt } | ConvertTo-Json -Compress; " ^
"$metadataBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($metadata)); " ^
"& node 'C:\Users\eric\ClaudeTimeMCP\cli.js' log-activity message $timestamp --metadata-base64 $metadataBase64"

exit /b 0
