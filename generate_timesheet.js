import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
let startDate, endDate;

if (args.length === 0) {
  // Default to yesterday
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  startDate = endDate = yesterday.toISOString().split('T')[0];
} else if (args.length === 1) {
  // Single date provided
  startDate = endDate = args[0];
} else {
  // Date range provided
  startDate = args[0];
  endDate = args[1];
}

console.log(`\nGenerating timesheet report from ${startDate} to ${endDate}\n`);

// Function to read activities from file
async function getActivities() {
  const dataDir = path.join(__dirname, 'data');

  if (!fs.existsSync(dataDir)) {
    throw new Error(`Data directory not found: ${dataDir}`);
  }

  const files = fs.readdirSync(dataDir).filter(f => f.startsWith('claude_activities_'));

  if (files.length > 0) {
    const latestFile = files.sort().reverse()[0];
    const filePath = path.join(dataDir, latestFile);
    console.log(`Reading from: ${filePath}\n`);
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  throw new Error('No activities export file found in data directory. Please run the MCP get_activities tool first.');
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
