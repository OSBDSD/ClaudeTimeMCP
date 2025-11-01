# ClaudeTime

**Formerly ClaudeTimeMCP** - Automatic time tracking for Claude Code CLI sessions using hooks and direct SQLite reporting.

> **⚠️ Important Change (v2.0.0):** This project has been renamed from **ClaudeTimeMCP** to **ClaudeTime** and the MCP server has been removed. The MCP layer proved impractical due to Read tool limitations (256KB) that cannot handle activity exports after just a few days of use (~500KB, 5,000+ lines). All functionality now uses direct SQLite scripts with zero limitations. See [CHANGELOG.md](./CHANGELOG.md#200---2025-11-01) for details.

## Features

- **Automatic time tracking**: Hooks log session start/end automatically
- **Activity monitoring**: Track tool usage, messages, and responses
- **Smart duration calculation**: Caps idle periods to get accurate active time
- **Project-based tracking**: See time breakdown per project
- **Flexible reporting**: Generate detailed timesheets for any date range
- **SQLite storage**: Fast, reliable database with no size limits
- **Direct script access**: No MCP constraints, handle thousands of activities
- **100% local**: All data stored locally, no cloud services
- **Easy export**: Export to JSON, CSV, or query database directly

## Installation

### Prerequisites

- **Node.js** (v14 or higher)
- **npm** (comes with Node.js)

### Quick Install

**Step 1: Clone and install dependencies**
```bash
cd C:\Users\eric\ClaudeTimeMCP
npm install
```

**Step 2: Run automated hooks setup (REQUIRED)**
```bash
node setup-hooks.js
```

**This step is required!** The script modifies your Claude Code configuration files to enable automatic tracking.

What it does:
- Verifies all hook scripts are present in `scripts/` directory
- Modifies `~/.claude/settings.json` to add hook configurations
- Modifies `~/AppData/Roaming/claude-code/config.json` (if exists)
- Creates backups of existing config files before modifying
- Configures all 5 hooks (SessionStart, SessionEnd, UserPromptSubmit, PostToolUse, Stop)

Without running this script, time tracking will not work.

**Step 3: Restart Claude Code**

That's it! Hooks will now automatically track all sessions across all projects.

**Optional: Install SQLite CLI tools for database inspection**
```bash
# Windows
install-sqlite-windows.bat

# Mac/Linux
chmod +x install-sqlite-unix.sh
./install-sqlite-unix.sh
```

> **Note:** The old MCP server setup has been archived. If you previously used the MCP server, see [MCP_REMOVAL.md](./MCP_REMOVAL.md) for migration instructions.

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

## Usage

### Generating Timesheet Reports

The main reporting tool is `generate_timesheet.js`:

```bash
# Report for yesterday (default)
npm run report

# Report for specific date
npm run report 2025-11-01

# Report for date range
npm run report 2025-10-01 2025-11-07
```

This generates a comprehensive timesheet with:
- Line-by-line activity log per session
- Billable hours calculation (unique hours with activity)
- Session summaries with file edits and tool usage
- Overall statistics and top tools used
- Hourly breakdown with visual activity indicators

### CLI Commands

Use `cli.js` for database queries and manual session control:

```bash
# Generate time report
node cli.js report 2025-11-01

# View recent sessions
node cli.js stats 10

# Check current session
node cli.js current-session

# Manual session control
node cli.js session-start
node cli.js session-end

# Get help
node cli.js help
```

## Automatic Tracking with Hooks

Hooks are configured in your Claude Code settings and automatically log all session activity to SQLite.

**What Hooks Track:**
1. **Session Start** - When Claude Code launches (logs project path, timestamp)
2. **User Messages** - Every prompt you send (logs message content)
3. **Tool Usage** - Every tool Claude uses (logs tool name, inputs, outputs)
4. **Assistant Responses** - Claude's text responses (logs response content)
5. **Session End** - When Claude Code exits (calculates duration)

**Hook Configuration:**
- Hooks are defined in `hooks/` directory as Node.js scripts
- Configured in Claude Code settings: `claude_desktop_config.json`
- Work across all your projects automatically
- Write directly to SQLite database (`time-tracker.db`)

**Hook Scripts:**
- `scripts/onSessionStart.js` - Logs session starts
- `scripts/onSessionEnd.js` - Logs session ends
- `scripts/onUserPromptSubmit.js` - Logs your messages
- `scripts/onPostToolUse.js` - Logs tool usage
- `scripts/onStop.js` - Logs Claude's responses

All hooks write to a unified log file (`data/hooks.log`) for debugging.

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

### Test Hook Scripts

You can test individual hook scripts by piping JSON data to them:

```bash
# Test session start hook
echo '{"project_path":"C:\\test","timestamp":"2025-11-01T12:00:00Z"}' | node scripts/onSessionStart.js

# Test user message hook
echo '{"prompt":"Test message"}' | node scripts/onUserPromptSubmit.js

# Check the database
node cli.js stats 5
```

### Test CLI Tools

```bash
# Start a manual session
node cli.js session-start C:\test\project

# Generate a report
node cli.js report 2025-11-01

# View session stats
node cli.js stats 10
```

### Verify Hooks Are Working

After configuring hooks in Claude Code:

1. Start Claude Code in any project
2. Send a message to Claude
3. Check the database:
   ```bash
   node cli.js current-session
   node cli.js stats 1
   ```
4. Verify session and activities are logged

## Troubleshooting

### Hooks Not Logging

1. Verify hooks are configured in Claude Code settings (`claude_desktop_config.json`)
2. Check `data/hooks.log` for error messages
3. Verify Node.js is installed: `node --version`
4. Test hook scripts manually:
   ```bash
   echo '{"project_path":"C:\\test"}' | node scripts/onSessionStart.js
   ```
5. Restart Claude Code after configuration changes

### Data Storage Issues

The SQLite database `time-tracker.db` is created automatically on first run.

To reset all data:
```bash
rm time-tracker.db
node cli.js session-start  # Will recreate database and tables
```

To inspect the database directly:
```bash
# Windows (if SQLite CLI installed)
C:\sqlite\sqlite3.exe time-tracker.db

# Or use a GUI like DB Browser for SQLite
# https://sqlitebrowser.org/
```

### Permission Issues

Make sure the ClaudeTime folder has write permissions for creating the SQLite database file.

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

### ✅ Complete - Core Functionality
- ✅ Hook-based automatic tracking (session, messages, tools, responses)
- ✅ SQLite database storage with no size limits
- ✅ Comprehensive timesheet reporting (`generate_timesheet.js`)
- ✅ CLI tools for queries and manual control
- ✅ Active time calculation (30-minute idle cap)
- ✅ Project-based tracking
- ✅ Cross-platform support (Windows, macOS, Linux)

### ⚠️ Removed - MCP Server
- ❌ MCP server archived (Read tool 256KB limit made it impractical)
- ✅ All functionality replaced with superior script-based approach

## Future Roadmap

### Phase 3: Enhanced Reporting
- Weekly/monthly summary reports
- Visual productivity charts (hours per day, tool usage trends)
- Cost tracking per project (billable rates)
- Export to external formats (Excel, PDF timesheets)

### Phase 4: Advanced Features
- Web dashboard for visual analytics
- Integration with external time tracking services (Toggl, Harvest, Clockify)
- Team time tracking (multi-user support)
- Automated invoicing based on tracked hours

## License

MIT

## Support

For issues or questions, create an issue in the project repository.
