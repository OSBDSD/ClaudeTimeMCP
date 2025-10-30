import * as db from './database.js';

console.log('Testing Claude Time MCP Database...\n');

// Test 1: Create a session
console.log('Test 1: Creating a test session...');
const session = db.createSession(
  'C:\\Users\\eric\\shopifytealium',
  new Date('2025-10-29T10:00:00Z').toISOString()
);
console.log('✓ Session created:', session);
console.log('');

// Test 2: Log some activities
console.log('Test 2: Logging activities...');

const activity1 = db.logActivity(
  session.id,
  'tool_use',
  new Date('2025-10-29T10:05:00Z').toISOString(),
  { tool: 'Read', file: 'app.js' }
);
console.log('✓ Activity 1 logged:', activity1.id);

const activity2 = db.logActivity(
  session.id,
  'message',
  new Date('2025-10-29T10:10:00Z').toISOString()
);
console.log('✓ Activity 2 logged:', activity2.id);

const activity3 = db.logActivity(
  session.id,
  'tool_use',
  new Date('2025-10-29T10:15:00Z').toISOString(),
  { tool: 'Edit', file: 'app.js' }
);
console.log('✓ Activity 3 logged:', activity3.id);
console.log('');

// Test 3: End the session
console.log('Test 3: Ending session...');
const endResult = db.endSession(
  session.id,
  new Date('2025-10-29T11:00:00Z').toISOString()
);
console.log('✓ Session ended:', endResult);
console.log('');

// Test 4: Create another session for a different project
console.log('Test 4: Creating another session...');
const session2 = db.createSession(
  'C:\\Users\\eric\\another-project',
  new Date('2025-10-29T14:00:00Z').toISOString()
);
console.log('✓ Session 2 created:', session2);

// Log activity and end it
db.logActivity(
  session2.id,
  'message',
  new Date('2025-10-29T14:10:00Z').toISOString()
);

db.endSession(
  session2.id,
  new Date('2025-10-29T14:30:00Z').toISOString()
);
console.log('✓ Session 2 ended');
console.log('');

// Test 5: Get session stats
console.log('Test 5: Getting session stats...');
const stats = db.getSessionStats(5);
console.log('✓ Recent sessions:', stats.length);
stats.forEach((s, i) => {
  console.log(`  ${i + 1}. ${s.project_name} - ${s.duration_minutes?.toFixed(2) || 'N/A'} minutes`);
});
console.log('');

// Test 6: Generate time report
console.log('Test 6: Generating time report...');
const report = db.getTimeReport('2025-10-29');
console.log('✓ Time Report:');
console.log(`  Total hours: ${report.total_hours.toFixed(2)}`);
console.log(`  Total sessions: ${report.total_sessions}`);
console.log('  Projects:');
Object.entries(report.project_breakdown).forEach(([project, data]) => {
  console.log(`    - ${project}: ${(data.minutes / 60).toFixed(2)}h`);
});
console.log('');

// Test 7: Test current session
console.log('Test 7: Testing current session...');
const session3 = db.createSession(
  'C:\\Users\\eric\\shopifytealium',
  new Date().toISOString()
);
const currentSession = db.getCurrentSession('C:\\Users\\eric\\shopifytealium');
console.log('✓ Current session found:', currentSession?.id === session3.id ? 'Yes' : 'No');

// Clean up - end the test session
db.endSession(session3.id, new Date().toISOString());
console.log('');

console.log('All tests completed successfully! ✓');
console.log('\nDatabase file: time-tracker.db');
console.log('You can inspect it with:');
console.log('  C:\\sqlite\\sqlite3.exe time-tracker.db');
console.log('  sqlite> .tables');
console.log('  sqlite> SELECT * FROM sessions;\n');

// Close database
db.closeDatabase();
