# Removing the MCP Server from Claude Code

The MCP (Model Context Protocol) server has been archived in favor of direct script-based reporting.

## Why We Removed It

- MCP Read tool has 256KB limit, can't read its own exported activity files (~500KB)
- No practical advantage over direct SQLite queries
- Added complexity and walls without benefit
- Hooks provide all the data collection we need

## Manual Removal Steps

### 1. Remove from Claude Code Config

Edit your Claude Code configuration file (location varies by OS):
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

Remove the `claude-time-mcp` entry from the `mcpServers` section:

```json
{
  "mcpServers": {
    "claude-time-mcp": {
      "command": "node",
      "args": ["C:\\Users\\eric\\ClaudeTimeMCP\\index.js"]
    }
  }
}
```

Should become:

```json
{
  "mcpServers": {}
}
```

### 2. Restart Claude Code

After editing the config, restart Claude Code for changes to take effect.

### 3. Verify Removal

The following MCP tools should no longer be available:
- `mcp__time-tracker__log_session_start`
- `mcp__time-tracker__log_session_end`
- `mcp__time-tracker__log_activity`
- `mcp__time-tracker__get_time_report`
- `mcp__time-tracker__get_session_stats`
- `mcp__time-tracker__get_current_session`
- `mcp__time-tracker__get_activities`

## What Still Works

All the important functionality remains:

### Hooks (Data Collection)
The hooks continue to work and collect data to SQLite:
- `hooks/startup.bat` - Session start logging
- `hooks/shutdown.bat` - Session end logging
- `hooks/tool-use.bat` - Tool usage tracking
- `hooks/user-prompt-submit.bat` - Message tracking
- `hooks/assistant-response.bat` - Response tracking

### Scripts (Reporting)
Use these scripts for reporting:

```bash
# Generate timesheet report
npm run report

# Use the CLI tool
npm run cli
node cli.js --help
```

### Direct Database Access
Query the SQLite database directly:

```bash
sqlite3 time-tracker.db "SELECT * FROM sessions WHERE DATE(session_start) = DATE('now')"
```

Or with Node.js:

```javascript
const Database = require('better-sqlite3');
const db = new Database('time-tracker.db');
const sessions = db.prepare('SELECT * FROM sessions WHERE DATE(session_start) = DATE(?)').all('2025-11-01');
console.log(sessions);
```

## Archived Files

MCP-specific files have been moved to `_archive_mcp/`:
- `index.js` - MCP server
- `test.js` - MCP tests
- `setup.js`, `setup.bat`, `setup.sh` - MCP setup scripts
- `INSTALLATION.md` - MCP installation docs
- `hook-config-*.json` - MCP config examples
- `install-sqlite-*.sh/.bat` - SQLite install scripts

These can be deleted once you're confident you don't need them.
