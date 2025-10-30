# Claude Time MCP

An MCP (Model Context Protocol) server for automatically tracking time spent in Claude Code CLI sessions.

## Features

- **Automatic time tracking**: Log session start/end automatically
- **Activity monitoring**: Track tool usage and messages
- **Smart duration calculation**: Caps idle periods to get accurate active time
- **Project-based tracking**: See time breakdown per project
- **Flexible reporting**: Generate reports for any date range
- **SQLite storage**: Fast, reliable database that scales with heavy use
- **100% local**: All data stored locally, no cloud services
- **Easy export**: Export to JSON, CSV, or copy database directly

## Installation

**📖 [Complete Installation Guide →](./INSTALLATION.md)**

### Prerequisites

ClaudeTimeMCP uses **SQLite** for fast, reliable local storage. Installation is handled by automated scripts.

### Quick Install

**Step 1: Install SQLite**
```bash
# Windows
cd C:\Users\eric\ClaudeTimeMCP
install-sqlite-windows.bat

# Mac/Linux
cd /path/to/ClaudeTimeMCP
chmod +x install-sqlite-unix.sh
./install-sqlite-unix.sh
```

**Step 2: Configure globally (works across ALL projects)**
```bash
# Windows
setup.bat

# Mac/Linux
./setup.sh
```

**Step 3: Reload VS Code or restart terminal**

That's it! Time tracking is now automatic across all your projects.

**📖 See [INSTALLATION.md](./INSTALLATION.md) for detailed step-by-step instructions and troubleshooting.**

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

**Hooks are configured globally by the setup script!** See [INSTALLATION.md](./INSTALLATION.md) Appendix for details on how hooks work.

Hooks automatically:
1. Log session start when Claude Code begins
2. Log user messages and tool usage as you work
3. Log session end when you exit

Hooks are configured in `~/.claude/settings.json` and work across all your projects automatically.

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

Data is stored in a SQLite database: `time-tracker.db`

### `sessions` table

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PRIMARY KEY | Unique session identifier |
| `project_path` | TEXT | Full path to project directory |
| `project_name` | TEXT | Extracted project name |
| `start_time` | TEXT | ISO timestamp |
| `end_time` | TEXT | ISO timestamp (null if session still open) |
| `duration_minutes` | REAL | Calculated duration |
| `message_count` | INTEGER | Number of messages in session |
| `tool_use_count` | INTEGER | Number of tools used in session |
| `created_at` | TEXT | Record creation timestamp |

### `activities` table

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PRIMARY KEY | Unique activity identifier |
| `session_id` | TEXT | Reference to session (foreign key) |
| `activity_type` | TEXT | Type of activity |
| `timestamp` | TEXT | ISO timestamp |
| `metadata` | TEXT | JSON string with additional data |
| `created_at` | TEXT | Record creation timestamp |

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

1. Check MCP is registered: `claude mcp list` (should show `time-tracker: ✓ Connected`)
2. Verify Node.js is installed: `node --version`
3. If not listed, run setup again: `setup.bat` (Windows) or `./setup.sh` (Unix)
4. Reload VS Code or restart terminal
5. Try running the server manually: `node index.js` (it should wait for input)

### Data Storage Issues

The SQLite database `time-tracker.db` is created automatically on first run.

To reset all data:
```bash
rm time-tracker.db
node test.js  # Will recreate database and tables
```

To inspect the database directly:
```bash
C:\sqlite\sqlite3.exe time-tracker.db
sqlite> .tables
sqlite> SELECT * FROM sessions LIMIT 10;
```

### Permission Issues

Make sure the ClaudeTimeMCP folder has write permissions for creating the SQLite database file.

## Data Export

To export your time data:

1. **SQLite format**: Copy `time-tracker.db` directly (standard SQLite database)
2. **JSON export**: Use SQLite to export:
   ```bash
   C:\sqlite\sqlite3.exe time-tracker.db ".mode json" ".output sessions.json" "SELECT * FROM sessions;"
   ```
3. **CSV export**: Use SQLite to export:
   ```bash
   C:\sqlite\sqlite3.exe time-tracker.db ".mode csv" ".output sessions.csv" "SELECT * FROM sessions;"
   ```
4. **Use MCP/CLI tools**: Get formatted reports via `get_time_report` or `cli.js report`

## Privacy

- All data is stored locally on your machine
- No data is sent to external services
- No API keys or authentication required
- You have full control over your data

## Current Status

### ✅ Phase 1: Complete - MCP Server
- MCP server with query tools
- SQLite database storage
- Active time calculation
- Project-based tracking
- Global configuration (works across all projects)

### ✅ Phase 2: Complete - Hook Integration
- Automatic session start/end tracking
- Automatic activity logging
- CLI tools for manual control
- Cross-platform hook scripts
- Global hooks configuration

## Future Roadmap

### Phase 3: Enhanced Reporting
- Custom slash commands (`/timereport`, `/timelog`)
- Weekly/monthly summaries
- Productivity insights
- Team time tracking

### Phase 4: Advanced Features
- Web dashboard
- Integration with external time tracking services (Toggl, Harvest, etc.)
- Cost tracking per project
- Team collaboration features

## License

MIT

## Support

For issues or questions, create an issue in the project repository.
