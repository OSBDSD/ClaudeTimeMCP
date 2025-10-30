#!/bin/bash
# Hook to log session start
# Called when Claude Code session begins

# Get the project directory
PROJECT_DIR="${PWD}"

# Get the path to the CLI script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Call the CLI to start session
node "${SCRIPT_DIR}/cli.js" session-start "${PROJECT_DIR}"

# Exit successfully
exit 0
