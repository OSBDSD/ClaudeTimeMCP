import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Data file paths
const dataDir = join(__dirname, 'data');
const sessionsFile = join(dataDir, 'sessions.json');
const activitiesFile = join(dataDir, 'activities.json');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize data files if they don't exist
if (!fs.existsSync(sessionsFile)) {
  fs.writeFileSync(sessionsFile, JSON.stringify([], null, 2));
}
if (!fs.existsSync(activitiesFile)) {
  fs.writeFileSync(activitiesFile, JSON.stringify([], null, 2));
}

// Helper functions to read/write data
function readSessions() {
  const data = fs.readFileSync(sessionsFile, 'utf8');
  return JSON.parse(data);
}

function writeSessions(sessions) {
  fs.writeFileSync(sessionsFile, JSON.stringify(sessions, null, 2));
}

function readActivities() {
  const data = fs.readFileSync(activitiesFile, 'utf8');
  return JSON.parse(data);
}

function writeActivities(activities) {
  fs.writeFileSync(activitiesFile, JSON.stringify(activities, null, 2));
}

// Database operations

export function createSession(projectPath, timestamp) {
  const id = randomUUID();
  const projectName = projectPath.split(/[\\/]/).pop() || 'Unknown';

  const session = {
    id,
    project_path: projectPath,
    project_name: projectName,
    start_time: timestamp,
    end_time: null,
    duration_minutes: null,
    message_count: 0,
    tool_use_count: 0,
    created_at: new Date().toISOString()
  };

  const sessions = readSessions();
  sessions.push(session);
  writeSessions(sessions);

  return {
    id,
    project_path: projectPath,
    project_name: projectName,
    start_time: timestamp
  };
}

export function endSession(sessionId, timestamp) {
  const sessions = readSessions();
  const sessionIndex = sessions.findIndex(s => s.id === sessionId);

  if (sessionIndex === -1) {
    throw new Error(`Session ${sessionId} not found`);
  }

  const session = sessions[sessionIndex];

  // Calculate duration in minutes
  const startTime = new Date(session.start_time);
  const endTime = new Date(timestamp);
  const durationMs = endTime - startTime;
  const durationMinutes = durationMs / (1000 * 60);

  // Update session
  session.end_time = timestamp;
  session.duration_minutes = durationMinutes;

  writeSessions(sessions);

  return {
    session_id: sessionId,
    end_time: timestamp,
    duration_minutes: durationMinutes
  };
}

export function logActivity(sessionId, activityType, timestamp, metadata = null) {
  const id = randomUUID();

  const activity = {
    id,
    session_id: sessionId,
    activity_type: activityType,
    timestamp,
    metadata,
    created_at: new Date().toISOString()
  };

  const activities = readActivities();
  activities.push(activity);
  writeActivities(activities);

  // Update session counters
  const sessions = readSessions();
  const session = sessions.find(s => s.id === sessionId);

  if (session) {
    if (activityType === 'tool_use') {
      session.tool_use_count++;
    } else if (activityType === 'message') {
      session.message_count++;
    }
    writeSessions(sessions);
  }

  return {
    id,
    session_id: sessionId,
    activity_type: activityType,
    timestamp
  };
}

export function getTimeReport(startDate, endDate = null, projectPath = null) {
  const endDateStr = endDate || new Date().toISOString().split('T')[0];

  const sessions = readSessions();
  const activities = readActivities();

  // Filter sessions by date range and project
  const filteredSessions = sessions.filter(session => {
    const sessionDate = session.start_time.split('T')[0];
    const inDateRange = sessionDate >= startDate && sessionDate <= endDateStr;
    const matchesProject = !projectPath || session.project_path === projectPath;
    return inDateRange && matchesProject;
  });

  // Calculate totals and apply active time logic
  const MAX_IDLE_MINUTES = 30;
  let totalActiveMinutes = 0;
  const sessionDetails = [];

  for (const session of filteredSessions) {
    let activeMinutes = 0;

    if (session.duration_minutes) {
      // Get activities for this session
      const sessionActivities = activities
        .filter(a => a.session_id === session.id)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      if (sessionActivities.length > 1) {
        // Calculate active time based on activity gaps
        for (let i = 1; i < sessionActivities.length; i++) {
          const prevTime = new Date(sessionActivities[i - 1].timestamp);
          const currTime = new Date(sessionActivities[i].timestamp);
          const gapMinutes = (currTime - prevTime) / (1000 * 60);
          activeMinutes += Math.min(gapMinutes, MAX_IDLE_MINUTES);
        }
        activeMinutes += 5; // Add base time for first and last activity
      } else {
        // No activities or single activity, use duration with cap
        activeMinutes = Math.min(session.duration_minutes || 0, MAX_IDLE_MINUTES);
      }
    }

    totalActiveMinutes += activeMinutes;

    sessionDetails.push({
      ...session,
      active_minutes: activeMinutes,
      active_hours: activeMinutes / 60
    });
  }

  // Group by date
  const dailyBreakdown = {};
  const projectBreakdown = {};

  for (const session of sessionDetails) {
    const date = session.start_time.split('T')[0];

    if (!dailyBreakdown[date]) {
      dailyBreakdown[date] = { sessions: 0, minutes: 0 };
    }
    dailyBreakdown[date].sessions++;
    dailyBreakdown[date].minutes += session.active_minutes;

    if (!projectBreakdown[session.project_name]) {
      projectBreakdown[session.project_name] = { sessions: 0, minutes: 0 };
    }
    projectBreakdown[session.project_name].sessions++;
    projectBreakdown[session.project_name].minutes += session.active_minutes;
  }

  return {
    total_hours: totalActiveMinutes / 60,
    total_minutes: totalActiveMinutes,
    total_sessions: filteredSessions.length,
    start_date: startDate,
    end_date: endDateStr,
    daily_breakdown: dailyBreakdown,
    project_breakdown: projectBreakdown,
    sessions: sessionDetails
  };
}

export function getSessionStats(limit = 10, projectPath = null) {
  const sessions = readSessions();

  // Filter by project if specified
  let filteredSessions = projectPath
    ? sessions.filter(s => s.project_path === projectPath)
    : sessions;

  // Sort by start time descending and limit
  filteredSessions = filteredSessions
    .sort((a, b) => new Date(b.start_time) - new Date(a.start_time))
    .slice(0, limit);

  return filteredSessions;
}

export function getCurrentSession(projectPath) {
  const sessions = readSessions();

  // Find most recent session without end_time for this project
  const openSessions = sessions
    .filter(s => s.project_path === projectPath && !s.end_time)
    .sort((a, b) => new Date(b.start_time) - new Date(a.start_time));

  return openSessions[0] || null;
}

export function closeDatabase() {
  // No-op for JSON file storage, but kept for API compatibility
}
