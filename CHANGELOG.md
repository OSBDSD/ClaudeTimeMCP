# Changelog

All notable changes to ClaudeTimeMCP will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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

### Fixed
- **MCP token limit errors**: No more "response exceeds maximum allowed tokens (25000)" errors
  - Server proactively limits response size before sending to MCP client
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

- **0.3.0** (2025-10-30): Enhanced tool detail tracking with JSON flattening and field filtering
- **0.2.1** (2025-10-30): Removed outdated documentation
- **0.2.0** (2025-10-30): Detailed activity tracking with full metadata capture and error logging
- **0.1.0** (2025-10-29): SQLite storage and global configuration setup
- **0.0.1** (2025-10-29): Initial release with basic time tracking functionality
