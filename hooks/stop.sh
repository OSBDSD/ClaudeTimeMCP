#!/bin/bash
# Hook to log Claude's assistant responses
# Called when Claude finishes responding (not on ESC interrupt)

# Read hook input from stdin
read -r -d '' hook_input

# Extract session_id and transcript_path
session_id=$(echo "$hook_input" | grep -o '"session_id":"[^"]*"' | cut -d'"' -f4)
transcript_path=$(echo "$hook_input" | grep -o '"transcript_path":"[^"]*"' | cut -d'"' -f4)

# Expand tilde in path
transcript_path="${transcript_path/#\~/$HOME}"

# Get timestamp
timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

# Log file path
log_file="$HOME/ClaudeTimeMCP/data/claude_responses.log"
mkdir -p "$(dirname "$log_file")"

# Extract last assistant text response from transcript
if [ -f "$transcript_path" ]; then
  last_text=$(tac "$transcript_path" | while IFS= read -r line; do
    if echo "$line" | grep -q '"type":"assistant"'; then
      # Extract text content from this line
      text=$(echo "$line" | grep -o '"type":"text","text":"[^"]*"' | sed 's/"type":"text","text":"//; s/"$//')
      if [ -n "$text" ]; then
        echo "$text"
        break
      fi
    fi
  done)

  if [ -n "$last_text" ]; then
    echo "[$timestamp] Session: $session_id" >> "$log_file"
    echo "$last_text" >> "$log_file"
    echo "" >> "$log_file"
    echo "---" >> "$log_file"
    echo "" >> "$log_file"
  fi
fi

exit 0
