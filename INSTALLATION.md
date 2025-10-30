# ClaudeTimeMCP Installation Guide

This guide walks you through a complete installation and setup of ClaudeTimeMCP with both MCP and hooks configured for automatic time tracking.

## Overview

You'll be setting up:
1. **SQLite** - Database for storing time tracking data
2. **MCP Server** - Allows Claude to query your time data
3. **Hooks** - Automatically tracks sessions and activities

Total time: ~15 minutes

---

## Part 1: Install SQLite

### Step 1.1: Run Installation Script

**Windows:**
```bash
cd C:\Users\eric\ClaudeTimeMCP
install-sqlite-windows.bat
```

**Mac/Linux:**
```bash
cd /path/to/ClaudeTimeMCP
chmod +x install-sqlite-unix.sh
./install-sqlite-unix.sh
```

You should see:
```
========================================
SQLite successfully installed!
Location: C:\sqlite\sqlite3.exe
Version: 3.50.4 ...
========================================
```

### Step 1.2: Verify SQLite Installation

Test that SQLite is accessible:

```bash
C:\sqlite\sqlite3.exe --version
```

Should output something like:
```
3.50.4 2025-07-30 ...
```

### Step 1.3: Test Database Operations

Run the test suite:

```bash
cd C:\Users\eric\ClaudeTimeMCP
node test.js
```

You should see:
```
Testing Claude Time MCP Database...

Test 1: Creating a test session...
✓ Session created: ...

Test 2: Logging activities...
✓ Activity 1 logged: ...
...

All tests completed successfully! ✓
```

**Database Location:**

The SQLite database file is created in the ClaudeTimeMCP directory:
- **Windows:** `C:\Users\YourUsername\ClaudeTimeMCP\time-tracker.db`
- **Mac/Linux:** `/path/to/ClaudeTimeMCP/time-tracker.db`

You can verify it was created:
```bash
# Windows
dir time-tracker.db

# Mac/Linux
ls -lh time-tracker.db
```

✅ **SQLite is now installed and working!**

---

## Part 2: Configure MCP and Hooks (GLOBAL)

We've automated this! Just run our setup script.

**Important:** This configures ClaudeTimeMCP **globally** with user scope, meaning it will work across ALL your projects automatically!

### Step 2.1: Run the Setup Script

**Windows:**
```bash
cd C:\Users\eric\ClaudeTimeMCP
setup.bat
```

**Mac/Linux:**
```bash
cd /path/to/ClaudeTimeMCP
chmod +x setup.sh
./setup.sh
```

The script will:
- ✅ Configure MCP server globally using `claude mcp add --scope user`
- ✅ Configure hooks globally in `~/.claude/settings.json`
- ✅ Backup existing configurations automatically
- ✅ Handle platform differences (Windows vs Unix)

You should see output like:
```
ClaudeTimeMCP - Global Setup
=============================

Step 1: Configuring MCP Server (Global)
----------------------------------------
Running: claude mcp add --scope user --transport stdio time-tracker -- node "..."

✓ MCP server configured globally (user scope)

Step 2: Configuring Hooks (Global)
-----------------------------------
✓ Read existing hooks configuration
✓ Backed up to: ~/.claude/settings.json.backup.1234567890
✓ Hooks configured globally
  Config: C:\Users\YourName\.claude\settings.json

Configuration Complete!
======================

What was configured:
  ✅ MCP Server: time-tracker (user scope - works in ALL projects)
  ✅ Hooks: Session tracking (global - works in ALL projects)
```

### Step 2.2: Verify Configuration

Check that MCP server was added:
```bash
claude mcp list
```

You should see:
```
time-tracker (user scope)
```

### Step 2.3: Restart Claude Code / VS Code

**If using VS Code:**
- Press `Ctrl+Shift+P`
- Type "Developer: Reload Window" and select it

**If using CLI:**
- Close and restart your terminal completely

### Step 2.4: Test MCP Connection

Start a new Claude Code session and ask:

```
Can you list your available MCP tools?
```

You should see tools like:
- `log_session_start`
- `log_session_end`
- `log_activity`
- `get_time_report`
- `get_session_stats`
- `get_current_session`

If you see these, MCP is working! ✅

---

## Part 3: Full System Test

Now let's verify everything works together!

### Step 3.1: Start a New Session

1. Start Claude Code in any project directory
2. Type any prompt (this is your test)

**Behind the scenes:**
- Hook fires automatically
- Session logged to database
- Session ID stored

### Step 3.2: Generate Some Activity

Ask Claude to do a few things:
```
Can you read the README.md file in this directory?
```

```
Can you list the files in this directory?
```

**Behind the scenes:**
- Each tool use (Read, Glob, etc.) triggers the hook
- Activities logged automatically

### Step 3.3: Check Via CLI

Open a **new terminal** (keep Claude Code running) and check:

```bash
cd C:\Users\eric\ClaudeTimeMCP
node cli.js stats
```

You should see your current session listed!

### Step 3.4: Check Via MCP

**In your Claude Code session**, ask:

```
Show me my recent Claude Code sessions
```

or

```
Use the get_session_stats tool to show my last 5 sessions
```

Claude should call the MCP tool and display your sessions!

### Step 3.5: Generate a Report

Ask Claude:

```
Show me my time report for today
```

or

```
Use get_time_report to show time since 2025-10-29
```

Claude should display a formatted time report!

✅ **If you see your session data in both CLI and MCP queries, everything is working!**

---

## Part 4: Verify Auto-Tracking

### Test Session End Behavior

1. Exit Claude Code (close the terminal/window)
2. Start Claude Code again in the same or different project
3. Type a prompt

**Behind the scenes:**
- Hook detects previous session wasn't closed
- Auto-closes previous session
- Starts new session

### Check the Results

```bash
cd C:\Users\eric\ClaudeTimeMCP
node cli.js stats 5
```

You should now see TWO sessions:
1. Previous session (with end time and duration)
2. Current session (still active)

✅ **Auto-tracking is working!**

---

## Troubleshooting

### SQLite Not Found

**Error:** `SQLite not found at C:\sqlite\sqlite3.exe`

**Solution:**
1. Run the install script again
2. Verify the file exists at `C:\sqlite\sqlite3.exe`
3. Check that `database.js` has correct path for your platform

### MCP Tools Not Showing

**Problem:** Claude says "I don't see any MCP tools"

**Solution:**
1. Verify MCP server is registered: `claude mcp list`
   - Should show: `time-tracker: ✓ Connected`
2. If not listed, run the setup again: `setup.bat` (Windows) or `./setup.sh` (Unix)
3. Check server details: `claude mcp get time-tracker`
4. Restart VS Code completely (Ctrl+Shift+P → "Developer: Reload Window")
5. Start a fresh Claude Code session

### Hooks Not Running

**Problem:** Sessions not logging automatically

**Solution:**
1. Verify hooks configuration exists: `cat ~/.claude/settings.json` (Unix) or `type %USERPROFILE%\.claude\settings.json` (Windows)
2. Check that hooks are configured correctly - should have UserPromptSubmit and ToolUse
3. If missing, run the setup again: `setup.bat` (Windows) or `./setup.sh` (Unix)
4. Restart VS Code completely (Ctrl+Shift+P → "Developer: Reload Window")
5. Start a fresh Claude Code session and type a prompt to trigger the hook

### No Data in Stats

**Problem:** `node cli.js stats` shows no sessions

**Solution:**
1. Check that hooks actually fired - start a new session and type a prompt
2. Check database file exists in the ClaudeTimeMCP directory:
   ```bash
   # Windows
   dir C:\Users\YourUsername\ClaudeTimeMCP\time-tracker.db

   # Mac/Linux
   ls -lh /path/to/ClaudeTimeMCP/time-tracker.db
   ```
3. Inspect database directly:
   ```bash
   # Windows
   C:\sqlite\sqlite3.exe C:\Users\YourUsername\ClaudeTimeMCP\time-tracker.db

   # Mac/Linux
   ~/.local/bin/sqlite3 /path/to/ClaudeTimeMCP/time-tracker.db

   # Then run:
   sqlite> .tables
   sqlite> SELECT COUNT(*) FROM sessions;
   sqlite> .quit
   ```
4. Check hook script is actually being called (add `echo "Hook fired"` to test)

### Session Not Auto-Closing

**Problem:** Multiple "active" sessions with no end time

**Solution:**
This is normal if Claude Code was force-closed or crashed. The next session start will auto-close the previous one. If you want to manually close:

```bash
node cli.js session-end
```

---

## Configuration File Locations Reference

### MCP Configuration (Managed by Claude CLI)

MCP servers configured with `--scope user` are stored by the Claude CLI. You don't need to edit these manually - use:
- `claude mcp list` - View configured servers
- `claude mcp get time-tracker` - View time-tracker configuration
- `claude mcp remove time-tracker` - Remove the server

### Hooks Configuration

**All Platforms:**

| File | Location |
|------|----------|
| Hooks (Global) | `~/.claude/settings.json` |
| Windows Path | `C:\Users\YourUsername\.claude\settings.json` |
| Mac/Linux Path | `~/.claude/settings.json` |

**Project-level hooks** (optional, not used by our setup):
- `.claude/settings.json` in project root
- `.claude/settings.local.json` for local-only settings

---

## What's Next?

Now that everything is configured:

1. **Use Claude Code normally** - tracking happens automatically
2. **Generate reports anytime:**
   ```bash
   cd C:\Users\YourUsername\ClaudeTimeMCP
   node cli.js report 2025-10-01
   ```
3. **Ask Claude for reports:**
   ```
   Show me my time since October 1st
   ```
4. **View stats:**
   ```bash
   cd C:\Users\YourUsername\ClaudeTimeMCP
   node cli.js stats
   ```
5. **Export data:**
   ```bash
   # Windows
   C:\sqlite\sqlite3.exe C:\Users\YourUsername\ClaudeTimeMCP\time-tracker.db ".mode csv" ".output sessions.csv" "SELECT * FROM sessions;"

   # Mac/Linux
   ~/.local/bin/sqlite3 /path/to/ClaudeTimeMCP/time-tracker.db ".mode csv" ".output sessions.csv" "SELECT * FROM sessions;"
   ```

## Your Data Location

**All your time tracking data is stored in:**
- **Windows:** `C:\Users\YourUsername\ClaudeTimeMCP\time-tracker.db`
- **Mac/Linux:** `/path/to/ClaudeTimeMCP/time-tracker.db`

This is a standard SQLite database file that you can:
- Copy/backup directly
- Query with any SQLite tool
- Export to CSV/JSON
- Open with database browsers like DB Browser for SQLite

Enjoy automatic time tracking! 🎉

---

---

## Appendix: How Hooks Work

### Session Lifecycle

Understanding what happens behind the scenes:

**1. Session Start**
- You start Claude Code in any project
- `SessionStart` hook fires automatically
- Calls `cli.js session-start`
- Session ID stored in `.current-session-id`
- Session logged to database with start time

**2. During Session**
- **Every user prompt:**
  - `UserPromptSubmit` hook fires (starts session on first prompt via `session-start.bat`)
  - `user-message-hook` fires to log user message content
  - Calls `cli.js log-activity message` with prompt text
  - Activity logged to database
- **Every tool use:** `tool-use-hook` fires (Read, Write, Edit, Bash, etc.)
  - Calls `cli.js log-activity tool_use` with tool name and parameters
  - Activity logged to database with full tool details (file paths, commands, etc.)

**3. Session End**
- You exit Claude Code (close terminal/window)
- `SessionEnd` hook fires automatically
- Calls `cli.js session-end`
- Session closed with end time and duration calculated

### What Gets Tracked

The hooks automatically log:
- **Session data:** Project path, start/end times, total duration
- **User messages:** Each prompt you submit to Claude (full text for keyword searching)
- **Tool usage:** Every file read, edit, command executed, etc.
- **Tool details:** File paths, bash commands, search patterns, edit changes
- **Activity metadata:** Timestamps for accurate time calculation

### Manual Session Control

If you need to manually control sessions (useful for testing or fixing states):

```bash
# Check current session
node cli.js current-session

# Manually end current session
node cli.js session-end

# Manually start a new session
node cli.js session-start

# Log an activity manually
node cli.js log-activity --type message
```

**Note:** Manual control is rarely needed - hooks handle everything automatically!

---

## Need Help?

- Check [README.md](./README.md) for feature overview
- Check [ARCHITECTURE.md](./ARCHITECTURE.md) for how it all works
- Report issues at: https://github.com/OSBDSD/ClaudeTimeMCP/issues
