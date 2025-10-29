# Hooks Setup Guide

This guide shows you how to configure automatic time tracking using Claude Code hooks.

## Two Ways to Use ClaudeTimeMCP

### Option 1: Hooks Only (Automatic Tracking)
- Hooks automatically log session data to JSON files
- Use CLI commands to generate reports
- Simpler setup, no MCP configuration needed
- **Recommended for most users**

### Option 2: MCP + Hooks (Maximum Flexibility)
- Hooks automatically collect data
- MCP provides query tools for Claude
- Ask Claude directly: "Show my time since October 1st"
- More complex setup, but more powerful

## Option 1: Hooks Only Setup

### Step 1: Configure Hooks

Add hooks to your Claude Code configuration. You can configure them:
- **Globally**: `%APPDATA%\claude-code\config.json` (Windows) or `~/.config/claude-code/config.json` (Mac/Linux)
- **Per-project**: `.claude/config.json` in your project directory

**Windows Configuration:**
```json
{
  "hooks": {
    "user-prompt-submit-hook": {
      "command": "C:\\Users\\eric\\ClaudeTimeMCP\\hooks\\session-start.bat",
      "runOnce": true
    },
    "tool-use-hook": {
      "command": "C:\\Users\\eric\\ClaudeTimeMCP\\hooks\\tool-use.bat"
    }
  }
}
```

**Mac/Linux Configuration:**
```json
{
  "hooks": {
    "user-prompt-submit-hook": {
      "command": "/Users/yourusername/.claude-time-mcp/hooks/session-start.sh",
      "runOnce": true
    },
    "tool-use-hook": {
      "command": "/Users/yourusername/.claude-time-mcp/hooks/tool-use.sh"
    }
  }
}
```

**Note**: For Mac/Linux, make hook scripts executable:
```bash
chmod +x ~/.claude-time-mcp/hooks/*.sh
```

### Step 2: Use the CLI for Reports

Generate reports anytime:

```bash
# View recent sessions
node C:\Users\eric\ClaudeTimeMCP\cli.js stats

# Generate time report
node C:\Users\eric\ClaudeTimeMCP\cli.js report 2024-10-01

# See current session
node C:\Users\eric\ClaudeTimeMCP\cli.js current-session

# View help
node C:\Users\eric\ClaudeTimeMCP\cli.js help
```

### Step 3: (Optional) Add Aliases for Convenience

**Windows (PowerShell Profile):**
```powershell
function claude-time { node C:\Users\eric\ClaudeTimeMCP\cli.js $args }
```

**Mac/Linux (.bashrc or .zshrc):**
```bash
alias claude-time='node ~/.claude-time-mcp/cli.js'
```

Then you can run:
```bash
claude-time stats
claude-time report 2024-10-01
```

## Option 2: MCP + Hooks Setup

### Step 1: Configure Hooks (same as Option 1)

Follow Step 1 from Option 1 above.

### Step 2: Configure MCP Server

Add MCP server to Claude Code's MCP configuration.

**File**: `%APPDATA%\claude-code\mcp_settings.json` (Windows) or `~/.config/claude-code/mcp_settings.json` (Mac/Linux)

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

### Step 3: Restart Claude Code

Exit and restart Claude Code for both hooks and MCP to load.

### Step 4: Ask Claude for Reports

Now you can ask Claude directly:

```
Show me my time report since October 1st
```

```
How much time have I spent on this project?
```

```
What are my last 10 Claude Code sessions?
```

Claude will use the MCP tools to query your data and provide formatted reports.

## How It Works

### Session Lifecycle

1. **Session Start**
   - You start Claude Code and type first prompt
   - `user-prompt-submit-hook` runs (once)
   - Calls `cli.js session-start`
   - Session ID stored in `.current-session-id`
   - Session logged to `data/sessions.json`

2. **During Session**
   - Every time Claude uses a tool (Read, Write, Edit, etc.)
   - `tool-use-hook` runs
   - Calls `cli.js log-activity`
   - Activity logged to `data/activities.json`

3. **Session End**
   - Next time you start Claude Code
   - Previous session auto-closed with approximate end time
   - New session begins

### Data Storage

All data stored in `C:\Users\eric\ClaudeTimeMCP\data\`:
- `sessions.json` - Session records
- `activities.json` - Activity logs

## Testing Your Setup

### Test Hooks

1. Start a new Claude Code session
2. Type a prompt
3. Check if session was logged:
   ```bash
   node C:\Users\eric\ClaudeTimeMCP\cli.js current-session
   ```

4. Use some tools (ask Claude to read a file)
5. Check stats:
   ```bash
   node C:\Users\eric\ClaudeTimeMCP\cli.js stats
   ```

### Test MCP (if configured)

1. Start Claude Code
2. Ask: "Can you list your available MCP tools?"
3. You should see `time-tracker` tools
4. Ask: "Show me my recent Claude Code sessions"
5. Claude should query and display your data

## Troubleshooting

### Hooks Not Running

1. Check hook configuration path is correct
2. Verify file exists and has correct permissions
3. Check Claude Code logs for errors
4. Try running hook manually:
   ```bash
   C:\Users\eric\ClaudeTimeMCP\hooks\session-start.bat
   ```

### No Data Being Logged

1. Check that `data/` directory exists
2. Verify hooks are actually running (add `echo` statements to test)
3. Check for errors in CLI:
   ```bash
   node C:\Users\eric\ClaudeTimeMCP\cli.js session-start
   ```

### MCP Not Available

1. Verify `mcp_settings.json` exists and has correct syntax
2. Check that path to `index.js` is correct
3. Restart Claude Code after config changes
4. Check Claude Code startup logs

## Advanced Usage

### Manual Session Control

End current session manually:
```bash
node C:\Users\eric\ClaudeTimeMCP\cli.js session-end
```

Start session manually:
```bash
node C:\Users\eric\ClaudeTimeMCP\cli.js session-start
```

### Project-Specific Reports

Filter report by project:
```bash
node C:\Users\eric\ClaudeTimeMCP\cli.js report 2024-10-01 2024-10-31 "C:\Users\eric\myproject"
```

### Export Data

Data files are standard JSON, easily exportable:
```bash
# Copy to backup
copy C:\Users\eric\ClaudeTimeMCP\data\*.json C:\backup\

# Convert to CSV (using jq or custom script)
# Or import directly into spreadsheet software
```

## Next Steps

1. Use it for a week to collect data
2. Generate weekly reports to track your time
3. Analyze which projects take the most time
4. Use insights for billing, planning, or productivity tracking

## Getting Help

For issues or questions:
1. Check this guide first
2. Run test scripts: `node test.js` and `node test-cli.js`
3. Check data files manually
4. Review Claude Code documentation on hooks and MCP
