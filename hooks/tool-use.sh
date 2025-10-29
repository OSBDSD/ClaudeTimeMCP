#!/bin/bash
# Hook to log tool usage
# Called whenever Claude uses a tool

# Get the path to the CLI script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Call the CLI to log activity (suppress output)
node "${SCRIPT_DIR}/cli.js" log-activity tool_use > /dev/null 2>&1

# Exit successfully
exit 0
