# Changelog

All notable changes to ClaudeTime (formerly ClaudeTimeMCP) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.0] - 2025-11-01

### Changed
- **Project renamed from ClaudeTimeMCP to ClaudeTime**
  - Focus shifted from MCP server to direct script-based reporting
  - Package name updated to `claude-time-tracker`
  - Main entry point now `cli.js` instead of `index.js`

### Removed
- **MCP server archived**: Moved all MCP-specific files to `_archive_mcp/` directory
  - `index.js` - MCP server implementation
  - `test.js` - MCP tests
  - `setup.js/bat/sh` - MCP setup scripts
  - `INSTALLATION.md` - MCP installation guide
  - `hook-config-*.json` - MCP configuration examples
  - `install-sqlite-*.sh/.bat` - SQLite installation scripts

### Why MCP Was Removed

The MCP (Model Context Protocol) layer proved to have critical limitations that made it impractical for time tracking and reporting:

1. **Read Tool Limitations**: Claude Code's Read tool has a hard 256KB limit, but activity exports grow to ~500KB after just a few days of use
   - Cannot read the exported activity JSON files that the MCP itself generates
   - 5,000+ lines of activity data exceed tool capacity
   - Even with field filtering, exports quickly become too large

2. **No Practical Advantage**: The MCP tools provide no benefit over direct SQLite access
   - Direct queries via `better-sqlite3` have zero limitations
   - Script-based reporting (Node.js) can handle arbitrarily large datasets
   - MCP adds complexity and artificial walls without delivering value

3. **Export Paradox**: The `get_activities` tool exports data to files that Claude Code cannot read
   - Tool creates JSON exports to work around token limits
   - But those exports exceed Read tool capacity
   - User forced to use external scripts anyway, defeating MCP purpose

4. **Hooks Provide Data Collection**: All valuable functionality comes from hooks, not MCP
   - Session tracking: Provided by startup/shutdown hooks
   - Activity logging: Provided by tool-use and message hooks
   - MCP was just an unnecessary abstraction layer

### What Still Works (Better Than Before)

All core functionality remains intact and more powerful without MCP constraints:

- **Hooks**: Continue to automatically collect all session and activity data
- **SQLite Database**: Full access with no size limits
- **Scripts**:
  - `generate_timesheet.js` - Comprehensive timesheet reports
  - `cli.js` - Database CLI for queries and reports
  - Direct SQLite access for custom queries
- **No Limitations**: Can process thousands of activities without artificial caps

### Migration

Users should:
1. Remove `claude-time-mcp` from Claude Code MCP config manually (see `MCP_REMOVAL.md`)
2. Continue using hooks (no changes needed)
3. Use `npm run report` or `node cli.js` for reporting instead of MCP tools

## [0.6.0] - 2025-11-01

### Changed
- **Migrated to better-sqlite3**: Replaced execSync + sqlite3.exe CLI with native better-sqlite3 library
  - Eliminates ENOBUFS errors caused by buffer overflow on large result sets
  - Much faster - no process spawning overhead
  - No buffer limits - can handle arbitrarily large datasets
  - Parameterized queries prevent SQL injection vulnerabilities
  - Direct SQLite library access instead of shelling out to CLI

## [0.5.0] - 2025-11-01

### Added
- **Billable hours timesheet report**: New `generate_timesheet.js` script for professional time tracking
  - Calculates billable hours: any activity during an hour = 1 billable hour
  - Line-by-line detailed activity log with timestamps
  - Session summaries with file modifications and tool usage
  - Hourly breakdown showing activities per hour
  - Supports single date or date range: `node generate_timesheet.js 2025-10-31` or `node generate_timesheet.js 2025-10-30 2025-10-31`
  - npm script: `npm run report`
- **Unified hook logging**: All hooks now log to single `data/hooks.log` file
  - New `hookLogger.js` utility module for consistent logging across all hooks
  - Info, debug, and error levels with timestamps
  - Full error details including stack traces
  - Makes debugging hook failures much easier
- **Node.js hook scripts**: Replaced PowerShell one-liners with clean, readable Node.js scripts
  - `scripts/onSessionStart.js` - Logs session starts
  - `scripts/onSessionEnd.js` - Logs session ends
  - `scripts/onUserPromptSubmit.js` - Logs user messages
  - `scripts/onPostToolUse.js` - Logs tool usage (was causing errors with large outputs)
  - `scripts/onStop.js` - Logs Claude responses
  - Cross-platform compatible (Windows/Linux)
  - Human-readable code instead of PowerShell spaghetti
  - Easy to test manually by piping JSON to stdin
  - Proper error handling with try/catch blocks
- **Hook configuration examples**: New `hook-config-node.json` and `hook-config-node-unix.json`
  - Clean hook configurations using Node.js scripts instead of inline PowerShell
  - Ready to copy to `~/.claude/settings.json`

### Changed
- **Activities export location**: Moved from system temp directory to project data directory
  - Old: `C:\Users\<user>\AppData\Local\Temp\claude_activities_*.json` (hard to find)
  - New: `C:\Users\<user>\ClaudeTimeMCP\data\claude_activities_*.json` (organized)
  - `generate_timesheet.js` updated to read from new location
  - No more hunting through Windows temp folders
- **All hook scripts refactored**: Migrated from inline PowerShell/bash to external Node.js files
  - Easier to debug with console logging
  - Better error messages and stack traces
  - Can be tested independently without triggering hooks
  - Unified logging across all hooks

### Fixed
- **Hook execution errors**: Node.js scripts provide better error reporting than PowerShell one-liners
  - Exit codes properly captured and logged
  - Spawn errors caught and logged to unified log file
  - Large tool outputs (like report generation) no longer cause silent failures

## [Unreleased - Earlier]

### Fixed
- **Removed restrictive activity_type enums**: MCP tool schemas for `log_activity` and `get_activities` no longer enforce enum restrictions on activity_type parameter
  - Previously had `enum: ['tool_use', 'message', 'error', 'other']` which was documentation-only but could cause confusion
  - Database and code support any activity_type string (including `assistant_response` added in 0.4.0)
  - Enum restrictions were unnecessary protocol overhead that didn't match actual implementation
  - This fix ensures all activity types can be logged and queried without artificial restrictions

## [0.4.0] - 2025-10-31

### Added
- **Assistant response tracking**: New activity type captures Claude's full text responses
  - `assistant_response` activity type logged via Stop hook
  - Stores complete response text, character count, and session ID in database
  - Enables conversation flow analysis and context review
  - Responses saved to both database AND `data/claude_responses.log` file
- **Stop hook**: New hook that fires when Claude finishes responding
  - Parses transcript JSONL to extract last assistant text response
  - Logs to database with full metadata (response_text, response_length, session_id)
  - Also appends to timestamped log file for easy reading
  - Cross-platform support (PowerShell for Windows, bash for Unix)
- **assistant_response_count**: New column in sessions table
  - Tracks number of assistant responses per session
  - Displayed in session stats alongside message_count and tool_use_count
  - Auto-increments when assistant_response activities are logged
- **Token-based pagination**: Server-side token estimation prevents MCP 25k token limit errors
  - Automatically estimates tokens for each activity (~4 chars = 1 token)
  - Stops adding activities when approaching 20k token limit (safety margin)
  - Returns pagination metadata: `total_returned`, `has_more`, `continue_after`, `estimated_tokens`
- **continue_after parameter**: Continuation-based pagination for get_activities
  - Pass timestamp from previous response to fetch next page
  - Natural continuation from where you left off
- **token_limit parameter**: Optional override for token limit (max 20k)

### Changed
- **get_activities response format**: Now returns structured object instead of raw array
  - `activities`: Array of activity objects
  - `total_returned`: Count of activities in this response
  - `has_more`: Boolean indicating if more data is available
  - `continue_after`: Timestamp to use for next page (null if no more data)
  - `estimated_tokens`: Approximate token count of response
- **get_activities tool description**: Updated to mention automatic token limiting and pagination
- **CLI session stats**: Now displays assistant response count alongside messages and tool uses

### Fixed
- **MCP token limit errors**: No more "response exceeds maximum allowed tokens (25000)" errors
  - Server proactively limits response size before sending to MCP client
  - Excludes large fields by default (originalFile, file.content) that contain entire file contents
  - Large fields can still be explicitly requested via the fields parameter
  - All data remains accessible through continuation-based pagination

## [0.3.0] - 2025-10-30 (Commit: 8164bc7)

### Added
- **tool_detail field**: New database column to store complete hook JSON data for tool_use activities
  - Captures full context including tool_name, tool_input, tool_response, cwd, session_id, and more
  - Enables detailed queries like "what files did I edit?" or "what bash commands did I run?"
- **JSON flattening**: Automatic flattening of nested metadata and tool_detail JSON into dot-notation keys
  - Example: `tool_detail.tool_input.file_path` instead of nested objects
  - Significantly reduces output size and improves readability
- **fields parameter**: Filter get_activities results to specific flattened keys
  - Example: `fields: ["timestamp", "tool_detail.tool_name", "tool_detail.tool_input.file_path"]`
  - Returns only requested fields instead of all data
- **--tool-detail-base64 flag**: CLI support for passing full hook JSON as base64-encoded parameter

### Changed
- **PostToolUse hook**: Enhanced to capture and pass entire hook JSON as tool_detail
  - Previously only captured tool_name
  - Now captures tool_input, tool_response, cwd, and all hook metadata
- **getActivities()**: Refactored to flatten JSON and support field filtering
  - Returns flattened objects by default
  - Supports optional fields array to filter output
- **MCP get_activities tool**: Updated description and schema to document flattening and fields parameter
- **Database migration**: Automatic ALTER TABLE adds tool_detail column to existing databases

### Fixed
- SQL injection vulnerability in database queries (proper escaping added)
- Error handling in hooks and CLI now logs full stack traces for debugging

## [0.2.1] - 2025-10-30 (Commit: 43f364c)

### Removed
- **HOOKS-SETUP.md**: Deleted outdated documentation file
  - Information was outdated (referenced JSON storage instead of SQLite)
  - Had incorrect hook names and configurations
  - Would have caused user confusion

### Documentation
- Consolidated all hook-related documentation into INSTALLATION.md
- Removed all references to HOOKS-SETUP.md from other documentation files
- Simplified documentation structure (README → INSTALLATION → ARCHITECTURE)

## [0.2.0] - 2025-10-30 (Commit: 1e0e8b1)

### Added
- **Comprehensive error logging**: All errors now include stack traces, context, and detailed messages
  - Added to CLI (cli.js)
  - Added to database layer (database.js)
  - Added to MCP server (index.js)
  - Added to setup script (setup.js)
- **get_activities MCP tool**: Query detailed activity logs with flexible filtering
  - Filter by date range, session, activity type, project
  - Returns raw activity data with full metadata
  - Enables queries like "show me what I worked on today"
- **Enhanced metadata capture**: UserPromptSubmit and PostToolUse hooks now extract and store:
  - User prompt text for message activities
  - Tool names for tool_use activities
- **Base64 encoding**: Safe handling of special characters in hook data
  - PowerShell and bash scripts properly encode metadata
  - CLI decodes with comprehensive error handling

### Changed
- **Hook architecture**: Migrated from file-based scripts to inline PowerShell/bash commands in setup.js
  - SessionStart: Logs session start when Claude Code launches
  - SessionEnd: Logs session end when Claude Code exits
  - UserPromptSubmit: Captures user message content
  - PostToolUse: Captures tool usage with metadata
- **Removed output suppression**: Hooks now output to stdout/stderr for debugging visibility

### Fixed
- Hook JSON parsing errors now properly handled with fallbacks
- Session ID file errors distinguished (ENOENT ignored, others logged)

### Documentation
- Added "How Hooks Work" appendix to INSTALLATION.md
  - Explains session lifecycle in detail
  - Documents what gets tracked automatically
  - Provides manual session control commands
- Updated README.md to reference INSTALLATION.md for hook details

## [0.1.0] - 2025-10-29 (Commit: dc51f83)

### Added
- **SQLite storage**: Fast, reliable local database replacing JSON files
  - Sessions table with project tracking and duration calculation
  - Activities table with foreign key relationships
  - Indexed queries for performance
- **Global configuration**: MCP and hooks configured with user scope
  - Works across ALL projects automatically
  - No per-project configuration needed
- **Automated setup script**: One-command installation and configuration
  - `setup.bat` (Windows) and `setup.sh` (Unix)
  - Automatically installs SQLite
  - Configures MCP server globally
  - Configures hooks globally
  - Creates backups of existing configurations
- **Database migration**: Automatic schema updates on module load
- **CLI tool enhancements**:
  - Better error messages
  - Session statistics
  - Time reports with active time calculation

### Changed
- **Storage backend**: Migrated from JSON files to SQLite database
  - Better performance for large datasets
  - ACID compliance
  - Standard SQL queries
- **Configuration scope**: Changed from project-level to user-level (global)
  - MCP server: `claude mcp add --scope user`
  - Hooks: Configured in `~/.claude/settings.json`

### Removed
- JSON file storage (data/sessions.json, data/activities.json)
- Project-specific configuration files

### Documentation
- Complete rewrite of INSTALLATION.md with step-by-step instructions
- Added troubleshooting section
- Added configuration file location reference
- Updated README.md with SQLite information and global configuration details
- Added ARCHITECTURE.md explaining system design

## [0.0.1] - 2025-10-29 (Initial Release)

### Added
- Initial MCP server implementation
- Basic hook scripts for session tracking
- JSON-based data storage
- CLI tools for manual control
- Time report generation
- Active time calculation (30-minute idle cap)
- Cross-platform support (Windows, Mac, Linux)
- Basic documentation (README.md)

---

## Version History Summary

- **0.4.0** (2025-10-31): Assistant response tracking with Stop hook and pagination improvements
- **0.3.0** (2025-10-30): Enhanced tool detail tracking with JSON flattening and field filtering
- **0.2.1** (2025-10-30): Removed outdated documentation
- **0.2.0** (2025-10-30): Detailed activity tracking with full metadata capture and error logging
- **0.1.0** (2025-10-29): SQLite storage and global configuration setup
- **0.0.1** (2025-10-29): Initial release with basic time tracking functionality
