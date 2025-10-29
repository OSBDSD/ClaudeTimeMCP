#!/usr/bin/env node

/**
 * CLI wrapper for the time tracking database
 * Used by hooks to log session data
 */

import * as db from './database.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Session ID storage file
const sessionIdFile = join(__dirname, '.current-session-id');

// Get command and arguments
const [command, ...args] = process.argv.slice(2);

// Helper to store session ID
function storeSessionId(sessionId) {
  fs.writeFileSync(sessionIdFile, sessionId, 'utf8');
}

// Helper to get stored session ID
function getStoredSessionId() {
  try {
    return fs.readFileSync(sessionIdFile, 'utf8').trim();
  } catch (error) {
    return null;
  }
}

// Helper to clear session ID
function clearSessionId() {
  try {
    fs.unlinkSync(sessionIdFile);
  } catch (error) {
    // Ignore if file doesn't exist
  }
}

// Command handlers
const commands = {
  'session-start': () => {
    const projectPath = args[0] || process.cwd();
    const timestamp = args[1] || new Date().toISOString();

    // Check if there's an existing session that wasn't closed
    const existingSessionId = getStoredSessionId();
    if (existingSessionId) {
      try {
        // Try to close the previous session
        // Use current timestamp as end time (approximation)
        db.endSession(existingSessionId, timestamp);
        console.log(`Previous session auto-closed: ${existingSessionId}`);
      } catch (error) {
        // Session might already be closed, ignore error
      }
    }

    const session = db.createSession(projectPath, timestamp);
    storeSessionId(session.id);

    console.log(`Session started: ${session.id}`);
    console.log(`Project: ${session.project_name}`);
    console.log(`Time: ${timestamp}`);
  },

  'session-end': () => {
    const sessionId = getStoredSessionId();

    if (!sessionId) {
      console.error('No active session found');
      process.exit(1);
    }

    const timestamp = args[0] || new Date().toISOString();

    try {
      const result = db.endSession(sessionId, timestamp);
      clearSessionId();

      console.log(`Session ended: ${sessionId}`);
      console.log(`Duration: ${result.duration_minutes.toFixed(2)} minutes`);
      console.log(`Time: ${timestamp}`);
    } catch (error) {
      console.error(`Error ending session: ${error.message}`);
      process.exit(1);
    }
  },

  'log-activity': () => {
    const sessionId = getStoredSessionId();

    if (!sessionId) {
      // Silently ignore if no active session
      process.exit(0);
    }

    const activityType = args[0] || 'tool_use';
    const timestamp = args[1] || new Date().toISOString();
    const metadata = args[2] ? JSON.parse(args[2]) : null;

    try {
      db.logActivity(sessionId, activityType, timestamp, metadata);
      // Silent success - don't spam logs
    } catch (error) {
      // Silently ignore errors in activity logging
      process.exit(0);
    }
  },

  'current-session': () => {
    const sessionId = getStoredSessionId();

    if (!sessionId) {
      console.log('No active session');
      process.exit(0);
    }

    const projectPath = args[0] || process.cwd();
    const session = db.getCurrentSession(projectPath);

    if (session) {
      console.log(`Active session: ${session.id}`);
      console.log(`Project: ${session.project_name}`);
      console.log(`Started: ${session.start_time}`);
    } else {
      console.log('No active session found for this project');
    }
  },

  'report': () => {
    const startDate = args[0];
    const endDate = args[1];
    const projectPath = args[2];

    if (!startDate) {
      console.error('Usage: report <start-date> [end-date] [project-path]');
      console.error('Example: report 2024-10-01');
      process.exit(1);
    }

    const report = db.getTimeReport(startDate, endDate, projectPath);

    console.log(`\n=== Time Report: ${report.start_date} to ${report.end_date} ===\n`);
    console.log(`Total Active Time: ${report.total_hours.toFixed(2)} hours (${Math.round(report.total_minutes)} minutes)`);
    console.log(`Total Sessions: ${report.total_sessions}\n`);

    if (Object.keys(report.project_breakdown).length > 0) {
      console.log('By Project:');
      const sortedProjects = Object.entries(report.project_breakdown)
        .sort(([, a], [, b]) => b.minutes - a.minutes);

      for (const [project, data] of sortedProjects) {
        const hours = (data.minutes / 60).toFixed(2);
        console.log(`  ${project}: ${hours}h (${data.sessions} sessions)`);
      }
      console.log('');
    }

    if (Object.keys(report.daily_breakdown).length > 0) {
      console.log('By Day:');
      const sortedDays = Object.entries(report.daily_breakdown).sort();

      for (const [date, data] of sortedDays) {
        const hours = (data.minutes / 60).toFixed(2);
        console.log(`  ${date}: ${hours}h (${data.sessions} sessions)`);
      }
    }
  },

  'stats': () => {
    const limit = parseInt(args[0]) || 10;
    const projectPath = args[1];

    const sessions = db.getSessionStats(limit, projectPath);

    console.log(`\n=== Recent ${sessions.length} Sessions ===\n`);

    sessions.forEach((session, index) => {
      const duration = session.duration_minutes
        ? `${session.duration_minutes.toFixed(2)} min`
        : 'In progress';

      console.log(`${index + 1}. ${session.project_name}`);
      console.log(`   Started: ${session.start_time}`);
      console.log(`   Duration: ${duration}`);
      console.log(`   Messages: ${session.message_count}, Tools: ${session.tool_use_count}`);
      console.log('');
    });
  },

  'help': () => {
    console.log(`
Claude Time MCP - CLI Tool

Commands:
  session-start [project-path] [timestamp]   Start a new session
  session-end [timestamp]                    End the current session
  log-activity [type] [timestamp] [metadata] Log an activity
  current-session [project-path]             Show current session info
  report <start-date> [end-date] [path]      Generate time report
  stats [limit] [project-path]               Show recent sessions
  help                                       Show this help

Examples:
  node cli.js session-start
  node cli.js session-end
  node cli.js log-activity tool_use
  node cli.js report 2024-10-01
  node cli.js stats 5
    `);
  }
};

// Execute command
if (!command || !commands[command]) {
  console.error(`Unknown command: ${command}`);
  console.error('Run "node cli.js help" for usage');
  process.exit(1);
}

try {
  commands[command]();
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}
