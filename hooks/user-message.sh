#!/bin/bash
# Hook to log user message - reads JSON from stdin
# Called whenever user submits a prompt

# Get the path to the CLI script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Read stdin (the hook JSON data)
HOOK_DATA=$(cat)

# Parse using Python or jq if available, otherwise fallback to basic approach
if command -v python3 >/dev/null 2>&1; then
    # Use Python to parse JSON and extract prompt
    METADATA=$(echo "$HOOK_DATA" | python3 -c "
import sys, json, base64
try:
    data = json.load(sys.stdin)
    # Try different possible field names for user prompt
    prompt = data.get('user_prompt', data.get('prompt', data.get('message', '[user message]')))
    metadata = {'prompt': prompt}
    metadata_json = json.dumps(metadata)
    encoded = base64.b64encode(metadata_json.encode()).decode()
    print(encoded)
except Exception as e:
    # Fallback
    print(base64.b64encode(b'{\"prompt\":\"[user message]\"}').decode())
")
elif command -v jq >/dev/null 2>&1; then
    # Use jq to parse JSON
    PROMPT=$(echo "$HOOK_DATA" | jq -r '.user_prompt // .prompt // .message // "[user message]"')
    JSON_DATA="{\"prompt\":\"$PROMPT\"}"
    METADATA=$(echo -n "$JSON_DATA" | base64 -w 0 2>/dev/null || echo -n "$JSON_DATA" | base64)
else
    # Fallback: just log that a message occurred
    METADATA=$(echo -n '{"prompt":"[user message]"}' | base64 -w 0 2>/dev/null || echo -n '{"prompt":"[user message]"}' | base64)
fi

# Get current ISO timestamp
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ" 2>/dev/null || date -u +"%Y-%m-%dT%H:%M:%SZ")

# Call the CLI to log message activity with base64-encoded metadata
node "${SCRIPT_DIR}/cli.js" log-activity message "$TIMESTAMP" --metadata-base64 "$METADATA"

# Exit successfully
exit 0
