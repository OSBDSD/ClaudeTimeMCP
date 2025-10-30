#!/bin/bash

# Unix wrapper for ClaudeTimeMCP setup

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Running ClaudeTimeMCP global setup..."
echo ""

node "$SCRIPT_DIR/setup.js"

EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
    echo ""
    echo "ERROR: Setup failed with error code $EXIT_CODE"
    exit $EXIT_CODE
fi

echo ""
echo "Setup complete!"
