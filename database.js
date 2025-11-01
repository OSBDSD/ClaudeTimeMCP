import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';
import { writeFileSync, appendFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database file path
const DB_PATH = join(__dirname, 'time-tracker.db');

// Error log file path
const ERROR_LOG_PATH = join(__dirname, 'mcp-errors.log');

// Helper to log errors to file
function logError(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  try {
    appendFileSync(ERROR_LOG_PATH, logMessage, 'utf8');
  } catch (e) {
    // If we can't write to log file, at least try console
    console.error('Failed to write to log file:', e);
  }
  console.error(message);
}

// Create database connection
const db = new Database(DB_PATH);

// Initialize database and create tables
function initializeDatabase() {
  // Create tables if they don't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      project_path TEXT NOT NULL,
      project_name TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT,
      duration_minutes REAL,
      message_count INTEGER DEFAULT 0,
      tool_use_count INTEGER DEFAULT 0,
      assistant_response_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time);
    CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_path);

    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      activity_type TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      metadata TEXT,
      tool_detail TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    CREATE INDEX IF NOT EXISTS idx_activities_session ON activities(session_id);
    CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON activities(timestamp);
  `);

  // Migration: Add tool_detail column if it doesn't exist (for existing databases)
  try {
    db.exec(`ALTER TABLE activities ADD COLUMN tool_detail TEXT;`);
  } catch (error) {
    // Column already exists or other error - safe to ignore
  }

  // Migration: Add assistant_response_count column if it doesn't exist (for existing databases)
  try {
    db.exec(`ALTER TABLE sessions ADD COLUMN assistant_response_count INTEGER DEFAULT 0;`);
  } catch (error) {
    // Column already exists or other error - safe to ignore
  }
}

// Initialize on module load
initializeDatabase();

// Database operations

export function createSession(projectPath, timestamp) {
  const id = randomUUID();
  const projectName = projectPath.split(/[\\/]/).pop() || 'Unknown';

  const stmt = db.prepare(`
    INSERT INTO sessions (id, project_path, project_name, start_time)
    VALUES (?, ?, ?, ?)
  `);

  stmt.run(id, projectPath, projectName, timestamp);

  return {
    id,
    project_path: projectPath,
    project_name: projectName,
    start_time: timestamp
  };
}

export function endSession(sessionId, timestamp) {
  // Get session start time
  const stmt = db.prepare(`SELECT start_time FROM sessions WHERE id = ?`);
  const session = stmt.get(sessionId);

  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  // Calculate duration in minutes
  const startTime = new Date(session.start_time);
  const endTime = new Date(timestamp);
  const durationMs = endTime - startTime;
  const durationMinutes = durationMs / (1000 * 60);

  // Update session
  const updateStmt = db.prepare(`
    UPDATE sessions
    SET end_time = ?, duration_minutes = ?
    WHERE id = ?
  `);
  updateStmt.run(timestamp, durationMinutes, sessionId);

  return {
    session_id: sessionId,
    end_time: timestamp,
    duration_minutes: durationMinutes
  };
}

export function logActivity(sessionId, activityType, timestamp, metadata = null, toolDetail = null) {
  const id = randomUUID();
  const metadataJson = metadata ? JSON.stringify(metadata) : null;
  const toolDetailJson = toolDetail ? JSON.stringify(toolDetail) : null;

  const stmt = db.prepare(`
    INSERT INTO activities (id, session_id, activity_type, timestamp, metadata, tool_detail)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, sessionId, activityType, timestamp, metadataJson, toolDetailJson);

  // Update session counters
  if (activityType === 'tool_use') {
    db.prepare(`UPDATE sessions SET tool_use_count = tool_use_count + 1 WHERE id = ?`).run(sessionId);
  } else if (activityType === 'message') {
    db.prepare(`UPDATE sessions SET message_count = message_count + 1 WHERE id = ?`).run(sessionId);
  } else if (activityType === 'assistant_response') {
    db.prepare(`UPDATE sessions SET assistant_response_count = assistant_response_count + 1 WHERE id = ?`).run(sessionId);
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

  let sql = `
    SELECT id, project_path, project_name, start_time, end_time, duration_minutes,
           message_count, tool_use_count, assistant_response_count
    FROM sessions
    WHERE DATE(start_time) >= DATE(?) AND DATE(start_time) <= DATE(?)
  `;

  const params = [startDate, endDateStr];

  if (projectPath) {
    sql += ` AND project_path = ?`;
    params.push(projectPath);
  }

  sql += ` ORDER BY start_time DESC`;

  const stmt = db.prepare(sql);
  const sessions = stmt.all(...params);

  // Calculate totals and apply active time logic
  const MAX_IDLE_MINUTES = 30;
  let totalActiveMinutes = 0;
  const sessionDetails = [];

  for (const session of sessions) {
    let activeMinutes = 0;

    if (session.duration_minutes) {
      // Get activities for this session
      const activitiesStmt = db.prepare(`
        SELECT timestamp
        FROM activities
        WHERE session_id = ?
        ORDER BY timestamp ASC
      `);
      const activities = activitiesStmt.all(session.id);

      if (activities.length > 1) {
        // Calculate active time based on activity gaps
        for (let i = 1; i < activities.length; i++) {
          const prevTime = new Date(activities[i - 1].timestamp);
          const currTime = new Date(activities[i].timestamp);
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
    total_sessions: sessions.length,
    start_date: startDate,
    end_date: endDateStr,
    daily_breakdown: dailyBreakdown,
    project_breakdown: projectBreakdown,
    sessions: sessionDetails
  };
}

export function getSessionStats(limit = 10, projectPath = null) {
  let sql = `
    SELECT id, project_path, project_name, start_time, end_time, duration_minutes,
           message_count, tool_use_count, assistant_response_count
    FROM sessions
  `;

  const params = [];

  if (projectPath) {
    sql += ` WHERE project_path = ?`;
    params.push(projectPath);
  }

  sql += ` ORDER BY start_time DESC LIMIT ?`;
  params.push(limit);

  const stmt = db.prepare(sql);
  return stmt.all(...params);
}

export function getCurrentSession(projectPath) {
  const stmt = db.prepare(`
    SELECT id, project_path, project_name, start_time
    FROM sessions
    WHERE project_path = ? AND end_time IS NULL
    ORDER BY start_time DESC
    LIMIT 1
  `);

  return stmt.get(projectPath) || null;
}

// Helper function to flatten nested JSON objects
function flattenObject(obj, prefix = '', result = {}) {
  if (!obj || typeof obj !== 'object') {
    return result;
  }

  for (const key in obj) {
    const value = obj[key];
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flattenObject(value, newKey, result);
    } else {
      result[newKey] = value;
    }
  }

  return result;
}

export function getActivities(options = {}) {
  const {
    startDate = null,
    endDate = null,
    sessionId = null,
    activityType = null,
    projectPath = null,
    limit = null,
    fields = null
  } = options;

  let sql = `
    SELECT
      a.id,
      a.session_id,
      a.activity_type,
      a.timestamp,
      a.metadata,
      a.tool_detail,
      s.project_path,
      s.project_name,
      s.start_time as session_start
    FROM activities a
    JOIN sessions s ON a.session_id = s.id
  `;

  const whereClauses = [];
  const params = [];

  if (startDate) {
    whereClauses.push(`DATE(a.timestamp) >= DATE(?)`);
    params.push(startDate);
  }

  if (endDate) {
    whereClauses.push(`DATE(a.timestamp) <= DATE(?)`);
    params.push(endDate);
  }

  if (sessionId) {
    whereClauses.push(`a.session_id = ?`);
    params.push(sessionId);
  }

  if (activityType) {
    whereClauses.push(`a.activity_type = ?`);
    params.push(activityType);
  }

  if (projectPath) {
    whereClauses.push(`s.project_path = ?`);
    params.push(projectPath);
  }

  if (whereClauses.length > 0) {
    sql += ` WHERE ` + whereClauses.join(' AND ');
  }

  sql += ` ORDER BY a.timestamp DESC`;

  if (limit) {
    sql += ` LIMIT ?`;
    params.push(limit);
  }

  try {
    const stmt = db.prepare(sql);
    const activities = stmt.all(...params);

    // Process all activities
    const processedActivities = activities.map(activity => {

      // Parse metadata
      let parsedMetadata = null;
      if (activity.metadata) {
        try {
          parsedMetadata = JSON.parse(activity.metadata);
        } catch (e) {
          parsedMetadata = { raw: activity.metadata };
        }
      }

      // Parse tool_detail
      let parsedToolDetail = null;
      if (activity.tool_detail) {
        try {
          parsedToolDetail = JSON.parse(activity.tool_detail);
        } catch (e) {
          parsedToolDetail = { raw: activity.tool_detail };
        }
      }

      // Start with base activity fields (exclude raw JSON columns)
      const processedActivity = {
        id: activity.id,
        session_id: activity.session_id,
        activity_type: activity.activity_type,
        timestamp: activity.timestamp,
        project_path: activity.project_path,
        project_name: activity.project_name,
        session_start: activity.session_start
      };

      // Flatten metadata fields with prefix
      if (parsedMetadata) {
        const flatMetadata = flattenObject(parsedMetadata, 'metadata');
        Object.assign(processedActivity, flatMetadata);
      }

      // Flatten tool_detail fields with prefix
      if (parsedToolDetail) {
        const flatToolDetail = flattenObject(parsedToolDetail, 'tool_detail');
        Object.assign(processedActivity, flatToolDetail);
      }

      // Exclude large fields by default (unless explicitly requested via fields parameter)
      // These fields can be massive (entire file contents) and cause MCP token limit issues
      const largeFieldsToExclude = [
        'tool_detail.tool_response.originalFile',  // Edit tool - entire original file
        'tool_detail.tool_response.file.content',  // Read tool - entire file content
      ];

      // Only exclude if user hasn't specified custom fields
      if (!fields || fields.length === 0) {
        for (const fieldToExclude of largeFieldsToExclude) {
          delete processedActivity[fieldToExclude];
        }
      }

      // Filter by fields if specified
      let finalActivity = processedActivity;
      if (fields && Array.isArray(fields) && fields.length > 0) {
        const filtered = {};
        for (const field of fields) {
          if (field in processedActivity) {
            filtered[field] = processedActivity[field];
          }
        }
        finalActivity = filtered;
      }

      return finalActivity;
    });

    // Write to data directory
    const dataDir = join(__dirname, 'data');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `claude_activities_${timestamp}.json`;
    const filePath = join(dataDir, filename);

    try {
      writeFileSync(filePath, JSON.stringify(processedActivities, null, 2), 'utf8');
    } catch (error) {
      logError(`!!! ERROR writing activities to file:`);
      logError(`!!! File path: ${filePath}`);
      logError(`!!! Error: ${error.message}`);
      logError(`!!! Stack: ${error.stack}`);
      throw error;
    }

    return {
      file_path: filePath,
      total_activities: processedActivities.length,
      query: {
        start_date: startDate,
        end_date: endDate,
        session_id: sessionId,
        activity_type: activityType,
        project_path: projectPath
      }
    };
  } catch (error) {
    logError(`!!! ERROR in getActivities:`);
    logError(`!!! SQL: ${sql}`);
    logError(`!!! Params: ${JSON.stringify(params)}`);
    logError(`!!! Error: ${error.message}`);
    logError(`!!! Stack: ${error.stack}`);
    throw error;
  }
}

export function closeDatabase() {
  db.close();
}
