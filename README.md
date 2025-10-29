# Claude Time MCP

An MCP (Model Context Protocol) server for automatically tracking time spent in Claude Code CLI sessions.

## Features

- **Automatic time tracking**: Log session start/end automatically
- **Activity monitoring**: Track tool usage and messages
- **Smart duration calculation**: Caps idle periods to get accurate active time
- **Project-based tracking**: See time breakdown per project
- **Flexible reporting**: Generate reports for any date range
- **100% local**: All data stored in local JSON files, no cloud services
- **No native dependencies**: Pure JavaScript, works on any platform

## Quick Start

**Choose your setup:**

1. **Hooks Only** (Recommended) - Automatic tracking, CLI reports
   - See [HOOKS-SETUP.md](./HOOKS-SETUP.md) for step-by-step guide
   - Simpler setup, works immediately

2. **MCP + Hooks** - Automatic tracking + ask Claude for reports
   - See [HOOKS-SETUP.md](./HOOKS-SETUP.md) Option 2
   - More powerful, Claude can query your data directly

## Installation

### 1. No Dependencies Required!

The project uses only built-in Node.js modules, so no `npm install` needed.

### 2. Configure Hooks and/or MCP

Add the MCP server to your Claude Code configuration:

**Windows**: `%APPDATA%\claude-code\mcp_settings.json`
**Mac/Linux**: `~/.config/claude-code/mcp_settings.json`

Create or edit the file with:

```json
{
  "mcpServers": {
    "time-tracker": {
      "command": "node",
      "args": [
        "C:\\Users\\eric\\ClaudeTimeMCP\\index.js"
      ]
    }
  }
}
```

### 3. Restart Claude Code

Exit and restart Claude Code CLI for the MCP server to be loaded.

**Note**: The data directory will be created automatically on first use.

## CLI Tools

The CLI provides commands for manual control and reporting:

```bash
# Start a session
node cli.js session-start [project-path]

# End current session
node cli.js session-end

# Log an activity
node cli.js log-activity [type]

# View current session
node cli.js current-session

# Generate time report
node cli.js report <start-date> [end-date] [project-path]

# View recent sessions
node cli.js stats [limit]

# Show help
node cli.js help
```

### Examples

```bash
# Start tracking
cd C:\Users\eric\ClaudeTimeMCP
node cli.js session-start

# Check what's being tracked
node cli.js current-session

# End when done
node cli.js session-end

# View your time since October 1st
node cli.js report 2024-10-01

# See last 10 sessions
node cli.js stats 10
```

## MCP Usage

### Checking if MCP is Connected

In Claude Code, you can ask:

```
Can you list your available MCP tools?
```

You should see tools like `log_session_start`, `get_time_report`, etc.

### Manual Time Logging

You can manually log sessions (useful for testing):

```
Please use the log_session_start tool with:
- project_path: C:\Users\eric\shopifytealium
- timestamp: 2025-10-29T10:00:00Z
```

### Getting Time Reports

Ask Claude to generate a time report:

```
Show me my time report since October 1st, 2024
```

Or:

```
How much time have I spent on this project this week?
```

Claude will use the `get_time_report` tool to fetch and display your data.

### View Recent Sessions

```
Show me my last 10 Claude Code sessions
```

Claude will use `get_session_stats` to display recent activity.

## Automatic Tracking with Hooks

To enable automatic tracking (coming in Phase 2), you'll set up hooks that:

1. Log session start when Claude Code begins
2. Log activities as you work
3. Log session end when you exit

This will be configured in your project's `.claude/config.json` or globally.

## MCP Tools Reference

### `log_session_start`

Logs when a Claude Code session begins.

**Parameters:**
- `project_path` (string): Working directory path
- `timestamp` (string): ISO timestamp

**Returns:** Session object with ID

### `log_session_end`

Logs when a session ends and calculates duration.

**Parameters:**
- `session_id` (string): Session ID from start
- `timestamp` (string): ISO timestamp

**Returns:** Session summary with duration

### `log_activity`

Logs activity during a session.

**Parameters:**
- `session_id` (string): Session ID
- `activity_type` (string): Type (tool_use, message, error, other)
- `timestamp` (string): ISO timestamp
- `metadata` (object, optional): Additional data

**Returns:** Activity ID

### `get_time_report`

Generates a time report for a date range.

**Parameters:**
- `start_date` (string): Start date (YYYY-MM-DD)
- `end_date` (string, optional): End date, defaults to today
- `project_path` (string, optional): Filter by project

**Returns:** Formatted report with:
- Total active hours
- Sessions count
- Daily breakdown
- Project breakdown

### `get_session_stats`

Gets recent session statistics.

**Parameters:**
- `limit` (number, optional): Number of sessions (default 10)
- `project_path` (string, optional): Filter by project

**Returns:** Array of recent sessions with details

### `get_current_session`

Gets the current active session for a project.

**Parameters:**
- `project_path` (string): Project path to check

**Returns:** Current session object or null

## Data Storage

Data is stored in JSON files in the `data/` directory:

### `sessions.json`

Array of session objects, each containing:
- `id`: Unique session identifier
- `project_path`: Full path to project directory
- `project_name`: Extracted project name
- `start_time`: ISO timestamp
- `end_time`: ISO timestamp (null if session still open)
- `duration_minutes`: Calculated duration
- `message_count`: Number of messages in session
- `tool_use_count`: Number of tools used in session

### `activities.json`

Array of activity objects, each containing:
- `id`: Unique activity identifier
- `session_id`: Reference to session
- `activity_type`: Type of activity
- `timestamp`: ISO timestamp
- `metadata`: JSON string with additional data

## Active Time Calculation

To avoid counting idle time (e.g., leaving Claude Code open overnight), the system:

1. Calculates time between consecutive activities
2. Caps gaps at 30 minutes maximum
3. Provides accurate "active working time"

This is the same logic used in the `analyze_claude_time.js` script.

## Testing

### Manual Test

You can test the MCP server manually:

```bash
cd C:\Users\eric\ClaudeTimeMCP
node test.js
```

This will:
1. Start a test session
2. Log some activities
3. End the session
4. Generate a report

### Integration Test

Start Claude Code and ask:

```
Use the log_session_start tool to test the time tracker
```

Then check if it works by asking:

```
Get my session stats
```

## Troubleshooting

### MCP Server Not Loading

1. Check that `mcp_settings.json` path is correct
2. Verify Node.js is installed: `node --version`
3. Check Claude Code logs for errors
4. Try running the server manually: `node index.js` (it should wait for input)

### Data Storage Issues

The `data/` directory and JSON files are created automatically on first run.

To reset all data:
```bash
rm -rf data
node test.js  # Will recreate data directory and files
```

### Permission Issues

Make sure the ClaudeTimeMCP folder has write permissions for creating the data directory and JSON files.

## Data Export

To export your time data:

1. The data files are standard JSON, easily readable and parseable
2. Copy `data/sessions.json` and `data/activities.json` directly
3. Use the `get_time_report` tool and copy the formatted output
4. Write custom export scripts using the database.js functions

## Privacy

- All data is stored locally on your machine
- No data is sent to external services
- No API keys or authentication required
- You have full control over your data

## Roadmap

### Phase 2: Hook Integration
- Automatic session start/end tracking
- Automatic activity logging
- No manual intervention needed

### Phase 3: Enhanced Reporting
- Custom slash commands (`/timereport`, `/timelog`)
- Export to CSV/JSON
- Weekly/monthly summaries

### Phase 4: Advanced Features
- Web dashboard
- Integration with external time tracking services
- Cost tracking per project
- Team collaboration features

## License

MIT

## Support

For issues or questions, create an issue in the project repository.
