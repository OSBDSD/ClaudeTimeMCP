import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);

// Check for help flag
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: node generate_timesheet.js [START_DATE] [END_DATE]

Generate a detailed timesheet report from the Claude Code time tracking database.

Arguments:
  START_DATE    Optional. Start date in YYYY-MM-DD format (default: today)
  END_DATE      Optional. End date in YYYY-MM-DD format (default: START_DATE)

Examples:
  node generate_timesheet.js                    # Report for today
  node generate_timesheet.js 2025-11-01         # Report for specific date
  node generate_timesheet.js 2025-11-01 2025-11-30  # Report for date range

NPM Scripts:
  npm run report                                # Same as: node generate_timesheet.js
  npm run report 2025-11-01                    # Report for specific date
  npm run report 2025-11-01 2025-11-30         # Report for date range

Output:
  - Detailed activity timeline grouped by session
  - Billable hours calculation (unique hours with activity)
  - Activity type breakdown (messages, responses, tool uses)
  - Top tools used
  - Files modified
  - Hourly activity distribution
`);
  process.exit(0);
}

let startDate, endDate;

if (args.length === 0) {
  // Default to today
  const today = new Date();
  startDate = endDate = today.toISOString().split('T')[0];
} else if (args.length === 1) {
  // Single date provided
  startDate = endDate = args[0];
} else {
  // Date range provided
  startDate = args[0];
  endDate = args[1];
}

console.log(`\nGenerating timesheet report from ${startDate} to ${endDate}\n`);

// Function to read activities from database
async function getActivities() {
  const dbPath = path.join(__dirname, 'time-tracker.db');
  const db = new Database(dbPath, { readonly: true });

  try {
    console.log(`Reading from database: ${dbPath}\n`);

    const rawActivities = db.prepare(`
      SELECT
        a.id,
        a.session_id,
        a.timestamp,
        a.activity_type,
        a.metadata,
        a.tool_detail,
        s.start_time,
        s.project_name
      FROM activities a
      LEFT JOIN sessions s ON a.session_id = s.id
      WHERE DATE(a.timestamp) BETWEEN DATE(?) AND DATE(?)
      ORDER BY a.timestamp
    `).all(startDate, endDate);

    // Parse JSON fields and flatten structure
    const activities = rawActivities.map(activity => {
      const parsed = {
        activity_id: activity.id,
        session_id: activity.session_id,
        timestamp: activity.timestamp,
        activity_type: activity.activity_type,
        session_start: activity.start_time,
        project_name: activity.project_name
      };

      // Parse metadata JSON
      if (activity.metadata) {
        try {
          const metadata = JSON.parse(activity.metadata);
          parsed['metadata.prompt'] = metadata.prompt;
          parsed['metadata.response_text'] = metadata.response_text;
          parsed['metadata.tool'] = metadata.tool;
          parsed['metadata.description'] = metadata.description;
        } catch (e) {
          // Invalid JSON, skip
        }
      }

      // Parse tool_detail JSON
      if (activity.tool_detail) {
        try {
          const toolDetail = JSON.parse(activity.tool_detail);
          parsed['tool_detail.tool_name'] = toolDetail.tool_name;
          parsed['tool_detail.tool_input'] = toolDetail.tool_input;
          if (toolDetail.tool_input && toolDetail.tool_input.file_path) {
            parsed['tool_detail.tool_input.file_path'] = toolDetail.tool_input.file_path;
          }
          if (toolDetail.tool_input && toolDetail.tool_input.description) {
            parsed['metadata.description'] = toolDetail.tool_input.description;
          }
        } catch (e) {
          // Invalid JSON, skip
        }
      }

      return parsed;
    });

    return activities;
  } finally {
    db.close();
  }
}

// Get short description of activity
function getActivityDescription(activity) {
  if (activity.activity_type === 'message') {
    const prompt = activity['metadata.prompt'] || '';
    return `USER: ${prompt.substring(0, 80)}${prompt.length > 80 ? '...' : ''}`;
  } else if (activity.activity_type === 'assistant_response') {
    const response = activity['metadata.response_text'] || '';
    return `CLAUDE: ${response.substring(0, 80)}${response.length > 80 ? '...' : ''}`;
  } else if (activity.activity_type === 'tool_use') {
    const tool = activity['tool_detail.tool_name'] || activity['metadata.tool'] || 'unknown';
    const file = activity['tool_detail.tool_input.file_path'];
    const desc = activity['metadata.description'];

    if (file) return `TOOL: ${tool} - ${path.basename(file)}`;
    if (desc) return `TOOL: ${tool} - ${desc}`;
    return `TOOL: ${tool}`;
  }
  return 'Unknown activity';
}

// Count activity types
function countActivityTypes(activities) {
  const counts = { message: 0, assistant_response: 0, tool_use: 0 };
  const toolCounts = new Map();

  activities.forEach(activity => {
    counts[activity.activity_type] = (counts[activity.activity_type] || 0) + 1;
    if (activity.activity_type === 'tool_use' && activity['tool_detail.tool_name']) {
      const toolName = activity['tool_detail.tool_name'];
      toolCounts.set(toolName, (toolCounts.get(toolName) || 0) + 1);
    }
  });

  return { counts, toolCounts };
}

// Get file edits
function getFileEdits(activities) {
  const files = new Set();
  activities.forEach(activity => {
    if (activity.activity_type === 'tool_use') {
      const toolName = activity['tool_detail.tool_name'];
      if (toolName === 'Edit' || toolName === 'Write') {
        const filePath = activity['tool_detail.tool_input.file_path'];
        if (filePath) files.add(filePath);
      }
    }
  });
  return Array.from(files);
}

// Calculate billable hours - count unique hours with activity
function calculateBillableHours(activities) {
  const activeHours = new Set();

  activities.forEach(activity => {
    const timestamp = new Date(activity.timestamp);
    // Create a unique key for each hour: YYYY-MM-DD-HH
    const hourKey = `${timestamp.getFullYear()}-${String(timestamp.getMonth() + 1).padStart(2, '0')}-${String(timestamp.getDate()).padStart(2, '0')}-${String(timestamp.getHours()).padStart(2, '0')}`;
    activeHours.add(hourKey);
  });

  return activeHours.size;
}

// Main function
async function generateReport() {
  const activities = await getActivities();

  // Group activities by session
  const sessionMap = new Map();
  activities.forEach(activity => {
    if (!sessionMap.has(activity.session_id)) {
      sessionMap.set(activity.session_id, {
        session_id: activity.session_id,
        session_start: activity.session_start,
        project_name: activity.project_name,
        activities: []
      });
    }
    sessionMap.get(activity.session_id).activities.push(activity);
  });

  // Sort activities by timestamp within each session
  sessionMap.forEach(session => {
    session.activities.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  });

  const sessions = Array.from(sessionMap.values()).sort((a, b) =>
    new Date(a.session_start) - new Date(b.session_start)
  );

  console.log('═══════════════════════════════════════════════════════════════════════════════════');
  console.log(`                    DETAILED TIMESHEET REPORT: ${startDate} to ${endDate}`);
  console.log('═══════════════════════════════════════════════════════════════════════════════════\n');

  let totalBillableHours = 0;

  // DETAILED TIMESHEET - LINE BY LINE
  sessions.forEach((session, sessionIndex) => {
    const sessionActivities = session.activities;
    const sessionBillableHours = calculateBillableHours(sessionActivities);
    totalBillableHours += sessionBillableHours;

    console.log(`\n${'═'.repeat(87)}`);
    console.log(`SESSION ${sessionIndex + 1}: ${session.project_name}`);
    console.log(`Session ID: ${session.session_id}`);
    console.log(`Started: ${new Date(session.session_start).toLocaleString()}`);
    console.log(`Billable Hours: ${sessionBillableHours}h (${sessionActivities.length} activities)`);
    console.log(`${'─'.repeat(87)}`);
    console.log(`${'Time'.padEnd(12)} Activity`);
    console.log(`${'─'.repeat(87)}`);

    sessionActivities.forEach((activity) => {
      const timestamp = new Date(activity.timestamp);
      const timeStr = timestamp.toLocaleTimeString();
      const description = getActivityDescription(activity);

      console.log(`${timeStr.padEnd(12)} ${description}`);
    });

    console.log(`${'─'.repeat(87)}`);

    const { counts, toolCounts } = countActivityTypes(sessionActivities);
    const filesEdited = getFileEdits(sessionActivities);

    console.log(`\nSession Summary:`);
    console.log(`  Billable Hours: ${sessionBillableHours}h`);
    console.log(`  Activities: ${sessionActivities.length} (${counts.message} messages, ${counts.assistant_response} responses, ${counts.tool_use} tool uses)`);

    if (toolCounts.size > 0) {
      const topTools = Array.from(toolCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
      console.log(`  Top Tools: ${topTools.map(([tool, count]) => `${tool}(${count})`).join(', ')}`);
    }

    if (filesEdited.length > 0) {
      console.log(`  Files Modified: ${filesEdited.length} files`);
      filesEdited.slice(0, 3).forEach(file => console.log(`    - ${file}`));
      if (filesEdited.length > 3) console.log(`    ... and ${filesEdited.length - 3} more`);
    }
  });

  // SUMMARY SECTION
  const allActivities = activities;
  const { counts: totalCounts, toolCounts: totalToolCounts } = countActivityTypes(allActivities);

  console.log('\n\n');
  console.log('═══════════════════════════════════════════════════════════════════════════════════');
  console.log('                              SUMMARY STATISTICS');
  console.log('═══════════════════════════════════════════════════════════════════════════════════\n');

  console.log('OVERALL TOTALS');
  console.log('─────────────────────────────────────────────────────────────────');
  console.log(`Date Range: ${startDate} to ${endDate}`);
  console.log(`Total Sessions: ${sessionMap.size}`);
  console.log(`TOTAL BILLABLE HOURS: ${totalBillableHours}h`);
  console.log(`Total Activities: ${allActivities.length}`);
  console.log(`  - User Messages: ${totalCounts.message || 0}`);
  console.log(`  - Claude Responses: ${totalCounts.assistant_response || 0}`);
  console.log(`  - Tool Uses: ${totalCounts.tool_use || 0}`);

  console.log('\n\nTOP TOOLS USED');
  console.log('─────────────────────────────────────────────────────────────────');
  const sortedTools = Array.from(totalToolCounts.entries()).sort((a, b) => b[1] - a[1]);
  sortedTools.slice(0, 15).forEach(([tool, count]) => {
    console.log(`  ${tool.padEnd(40)} ${count.toString().padStart(4)} times`);
  });

  console.log('\n\nBILLABLE HOURS BY HOUR');
  console.log('─────────────────────────────────────────────────────────────────');
  console.log('(Any activity during an hour = 1 billable hour)');
  console.log('');

  const hourlyActivity = new Map();
  allActivities.forEach(activity => {
    const timestamp = new Date(activity.timestamp);
    const date = timestamp.toISOString().split('T')[0];
    const hour = timestamp.getHours();
    const hourKey = `${date} ${String(hour).padStart(2, '0')}:00`;

    if (!hourlyActivity.has(hourKey)) {
      hourlyActivity.set(hourKey, 0);
    }
    hourlyActivity.set(hourKey, hourlyActivity.get(hourKey) + 1);
  });

  const sortedHours = Array.from(hourlyActivity.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  sortedHours.forEach(([hourKey, count]) => {
    const bar = '█'.repeat(Math.ceil(count / 5));
    console.log(`${hourKey} │ ${bar} ${count} activities = 1h billable`);
  });

  console.log(`\n${'─'.repeat(65)}`);
  console.log(`TOTAL: ${sortedHours.length} billable hours`);

  console.log('\n═══════════════════════════════════════════════════════════════════════════════════');
  console.log('                              END OF REPORT');
  console.log('═══════════════════════════════════════════════════════════════════════════════════');
}

// Run the report
generateReport().catch(error => {
  console.error('Error generating report:', error.message);
  process.exit(1);
});
