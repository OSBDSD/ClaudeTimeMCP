# Architecture & Design Decisions

This document explains the design choices and architecture of ClaudeTimeMCP.

## Why Both MCP and Hooks?

A common question: "Why do we need both?"

### The One-Way vs Two-Way Distinction

**Hooks = One-Way (Logging)**
- Claude Code → Hooks → Write data to JSON
- Automatic data collection
- No response needed
- Simpler, direct writes

**MCP = Two-Way (Querying)**
- You ask Claude → Claude → MCP → Read/Calculate → Return results
- Interactive reporting
- Formatted responses
- Complex queries and aggregation

### When Each is Useful

**Use Hooks Alone When:**
- You just want automatic tracking
- You're comfortable with CLI commands for reports
- You want the simplest setup

**Add MCP When:**
- You want to ask Claude for reports conversationally
- You want Claude to analyze and format the data
- You want tools available in Claude's context

## Active Time Calculation

### The Problem

If we just use `end_time - start_time`, we get inflated numbers:
- Leaving Claude Code open overnight = 8 hours
- Taking a lunch break = 1 hour
- Multiple long pauses = lots of idle time

### The Solution

**Cap idle periods at 30 minutes:**
```
Activity at 10:00 AM
Activity at 10:05 AM  → Gap: 5 min   → Count: 5 min
Activity at 11:00 AM  → Gap: 55 min  → Count: 30 min (capped!)
Activity at 11:10 AM  → Gap: 10 min  → Count: 10 min
```

This gives **active working time** instead of **elapsed time**.

### Why 30 Minutes?

- Long enough to allow thinking/breaks
- Short enough to exclude lunch/meetings
- Can be adjusted in `database.js` (MAX_IDLE_MINUTES constant)

## Data Storage: Why JSON Instead of SQLite?

### Original Plan
Use `better-sqlite3` for a proper database.

### The Problem
Native compilation required on Windows, causing installation failures.

### The Solution
JSON file storage:
- No dependencies
- Works everywhere
- Easy to inspect/export
- Fast enough for personal use
- Simple backup (just copy files)

### Trade-offs
**Pros:**
- Zero setup
- Cross-platform
- Human-readable
- Easy debugging

**Cons:**
- Less efficient for large datasets
- No built-in indexing
- Manual file locking (not needed for single-user)

For tracking personal Claude Code usage, JSON is perfect. For team/enterprise, consider switching to SQLite.

## Session Tracking Strategy

### The Challenge
How do we know when a session starts and ends?

### The Solution

**Session Start:**
- Hook on `user-prompt-submit-hook` with `runOnce: true`
- Triggers only on first user prompt
- Stores session ID in `.current-session-id` file

**Session End:**
- No explicit exit hook available
- Next session start auto-closes previous session
- Uses current timestamp as approximation

**Activity Tracking:**
- Hook on `tool-use-hook` for every tool
- Logs to activities table
- Used for active time calculation

### Handling Edge Cases

**Force quit / crash:**
- Session left open (no end_time)
- Next session start auto-closes it
- Estimates end time = last activity + 5 minutes

**Multiple projects:**
- Each project can have its own open session
- Session ID stored per-directory (if needed)
- Reports can filter by project path

## CLI vs MCP Tools

Both provide the same functionality, different interfaces:

### CLI (`cli.js`)
**Use Case:** Direct commands, scripts, aliases
```bash
node cli.js report 2024-10-01
```

**Advantages:**
- Fast
- Scriptable
- No Claude Code needed
- Can be called from anywhere

### MCP Tools (`index.js`)
**Use Case:** Claude queries your data
```
You: "Show my time since October 1st"
Claude: [Calls get_time_report MCP tool]
```

**Advantages:**
- Conversational
- Claude formats the output
- Integrated with Claude's context
- Natural language queries

Both use the same `database.js` functions underneath.

## Comparison to Other Tools

### vs ccusage (GitHub)
- **ccusage**: Analyzes Claude Code terminal output/logs for cost tracking
- **ClaudeTimeMCP**: Tracks active session time with hooks
- **Different goals**: Cost vs time tracking
- **Can use both**: ccusage for API costs, ClaudeTimeMCP for billable hours

### vs Timing app (macOS)
- **Timing**: OS-level window/app tracking (macOS only)
- **ClaudeTimeMCP**: Claude Code specific, cross-platform
- **Different approach**: Passive monitoring vs active hooks
- **Can use both**: Timing for all apps, ClaudeTimeMCP for detailed Claude data

### vs ActivityWatch
- **ActivityWatch**: General activity tracking (browser, apps, windows)
- **ClaudeTimeMCP**: Claude Code specific with tool-level detail
- **Different scope**: Everything vs Claude only
- **Can use both**: ActivityWatch for overall time, ClaudeTimeMCP for Claude details

## Privacy & Data

### What Data is Collected

**Sessions:**
- Project path and name
- Start/end timestamps
- Message count
- Tool use count

**Activities:**
- Timestamp
- Activity type (tool_use, message)
- Optional metadata

**NOT Collected:**
- Actual message content
- Code you wrote
- Files you edited
- API keys or credentials

### Where Data Lives

- Local JSON files in `data/` directory
- Session ID in `.current-session-id` (temporary)
- No cloud, no external services
- No network requests
- You own 100% of the data

### Data Retention

- Forever, until you delete it
- Manual cleanup: `rm -rf data/`
- Or keep everything for historical analysis

## Performance Considerations

### JSON File Size
- ~1KB per session
- ~100 bytes per activity
- 1000 sessions ≈ 1MB
- Should handle years of data fine

### If You Have Performance Issues

Replace JSON storage with SQLite:
1. Install `better-sqlite3` (fix native compilation)
2. Update `database.js` to use SQLite
3. Keep same function signatures
4. CLI and MCP work unchanged

## Future Enhancements

### Potential Features
- Export to CSV for spreadsheets
- Integration with time tracking services (Toggl, Harvest)
- Cost tracking integration (combine with ccusage)
- Team/organization aggregation
- Web dashboard for visualization
- Productivity insights (most active hours, common patterns)
- Project categorization/tagging
- Goals and targets (40 hours/week)

### Extension Points
- `database.js`: Swap storage backend
- `cli.js`: Add new commands
- `index.js`: Add new MCP tools
- Hooks: Add new triggers

## Development

### Adding a New Report Type

1. Add function to `database.js`:
```javascript
export function getWeeklyReport() {
  // Your logic here
}
```

2. Add CLI command in `cli.js`:
```javascript
'weekly-report': () => {
  const report = db.getWeeklyReport();
  console.log(report);
}
```

3. Add MCP tool in `index.js` (optional):
```javascript
{
  name: 'get_weekly_report',
  description: 'Generate weekly time report',
  inputSchema: { /* ... */ }
}
```

### Testing

Always run tests after changes:
```bash
node test.js        # Test database operations
node test-cli.js    # Test CLI commands
```

## Credits

Developed to solve the problem of tracking time spent with Claude Code for billing and productivity analysis.

Inspired by:
- ccusage (cost tracking)
- Timing app (time tracking)
- ActivityWatch (activity monitoring)
- Claude Code's extensibility (hooks and MCP)
