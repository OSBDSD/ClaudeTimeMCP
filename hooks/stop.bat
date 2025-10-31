@echo off
REM Hook to log Claude's assistant responses
REM Called when Claude finishes responding (not on ESC interrupt)

REM Use PowerShell to parse hook input and extract assistant response from transcript
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
"$input = [Console]::In.ReadToEnd(); " ^
"$hookData = $input | ConvertFrom-Json; " ^
"$sessionId = $hookData.session_id; " ^
"$transcriptPath = $hookData.transcript_path; " ^
"$timestamp = [DateTime]::UtcNow.ToString('o'); " ^
"$logFile = 'C:\Users\eric\ClaudeTimeMCP\data\claude_responses.log'; " ^
"$lastText = ''; " ^
"if (Test-Path $transcriptPath) { " ^
"  $lines = Get-Content $transcriptPath; " ^
"  for ($i = $lines.Count - 1; $i -ge 0; $i--) { " ^
"    try { " ^
"      $obj = $lines[$i] | ConvertFrom-Json; " ^
"      if ($obj.type -eq 'assistant' -and $obj.message.content) { " ^
"        foreach ($content in $obj.message.content) { " ^
"          if ($content.type -eq 'text') { " ^
"            $lastText = $content.text; " ^
"            break; " ^
"          } " ^
"        } " ^
"        if ($lastText) { break; } " ^
"      } " ^
"    } catch {} " ^
"  } " ^
"} " ^
"if ($lastText) { " ^
"  $logEntry = \"[$timestamp] Session: $sessionId`n$lastText`n`n---`n`n\"; " ^
"  Add-Content -Path $logFile -Value $logEntry -Encoding UTF8; " ^
"}"

exit /b 0
