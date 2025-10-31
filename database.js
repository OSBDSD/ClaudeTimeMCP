import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { platform } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// SQLite executable path (hardcoded, not dependent on PATH)
const SQLITE_PATH = platform() === 'win32'
  ? 'C:\\sqlite\\sqlite3.exe'
  : process.env.HOME + '/.local/bin/sqlite3';

// Database file path
const DB_PATH = join(__dirname, 'time-tracker.db');

// Helper to execute SQLite commands
function executeSQLite(sql, returnOutput = false) {
  try {
    const result = execSync(`"${SQLITE_PATH}" "${DB_PATH}"`, {
      input: sql,
      encoding: 'utf8',
      stdio: returnOutput ? 'pipe' : ['pipe', 'pipe', 'ignore']
    });
    return returnOutput ? result.trim() : null;
  } catch (error) {
    throw new Error(`SQLite error: ${error.message}`);
  }
}

// Helper to execute SQLite query and get JSON result
function querySQLite(sql) {
  try {
    const input = `.mode json\n${sql}`;
    const result = execSync(`"${SQLITE_PATH}" "${DB_PATH}"`, {
      input: input,
      encoding: 'utf8'
    });
    const trimmed = result.trim();
    return trimmed ? JSON.parse(trimmed) : [];
  } catch (error) {
    console.error(`!!! ERROR in querySQLite:`);
    console.error(`!!! SQL: ${sql}`);
    console.error(`!!! Error: ${error.message}`);
    console.error(`!!! Stack: ${error.stack}`);
    if (error.stderr) {
      console.error(`!!! SQLite stderr: ${error.stderr}`);
    }
    if (error.stdout) {
      console.error(`!!! SQLite stdout: ${error.stdout}`);
    }
    throw error;
  }
}

// Initialize database and create tables
function initializeDatabase() {
  // Check if SQLite is installed
  if (!existsSync(SQLITE_PATH)) {
    throw new Error(`SQLite not found at ${SQLITE_PATH}. Please run the installation script: install-sqlite-windows.bat or install-sqlite-unix.sh`);
  }

  // Create tables if they don't exist
  const schema = `
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      project_path TEXT NOT NULL,
      project_name TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT,
      duration_minutes REAL,
      message_count INTEGER DEFAULT 0,
      tool_use_count INTEGER DEFAULT 0,
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
  `;

  // Execute each statement separately
  const statements = schema.split(';').filter(s => s.trim());
  for (const stmt of statements) {
    if (stmt.trim()) {
      executeSQLite(stmt.trim());
    }
  }

  // Migration: Add tool_detail column if it doesn't exist (for existing databases)
  try {
    executeSQLite(`ALTER TABLE activities ADD COLUMN tool_detail TEXT;`);
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

  const sql = `INSERT INTO sessions (id, project_path, project_name, start_time) VALUES ('${id}', '${projectPath.replace(/'/g, "''")}', '${projectName.replace(/'/g, "''")}', '${timestamp}')`;
  executeSQLite(sql);

  return {
    id,
    project_path: projectPath,
    project_name: projectName,
    start_time: timestamp
  };
}

export function endSession(sessionId, timestamp) {
  // Get session start time
  const sessions = querySQLite(`SELECT start_time FROM sessions WHERE id = '${sessionId}'`);

  if (sessions.length === 0) {
    throw new Error(`Session ${sessionId} not found`);
  }

  // Calculate duration in minutes
  const startTime = new Date(sessions[0].start_time);
  const endTime = new Date(timestamp);
  const durationMs = endTime - startTime;
  const durationMinutes = durationMs / (1000 * 60);

  // Update session
  const sql = `UPDATE sessions SET end_time = '${timestamp}', duration_minutes = ${durationMinutes} WHERE id = '${sessionId}'`;
  executeSQLite(sql);

  return {
    session_id: sessionId,
    end_time: timestamp,
    duration_minutes: durationMinutes
  };
}

export function logActivity(sessionId, activityType, timestamp, metadata = null, toolDetail = null) {
  const id = randomUUID();
  const metadataJson = metadata ? JSON.stringify(metadata).replace(/'/g, "''") : null;
  const toolDetailJson = toolDetail ? JSON.stringify(toolDetail).replace(/'/g, "''") : null;

  const sql = `INSERT INTO activities (id, session_id, activity_type, timestamp, metadata, tool_detail) VALUES ('${id}', '${sessionId}', '${activityType}', '${timestamp}', ${metadataJson ? "'" + metadataJson + "'" : 'NULL'}, ${toolDetailJson ? "'" + toolDetailJson + "'" : 'NULL'})`;
  executeSQLite(sql);

  // Update session counters
  if (activityType === 'tool_use') {
    executeSQLite(`UPDATE sessions SET tool_use_count = tool_use_count + 1 WHERE id = '${sessionId}'`);
  } else if (activityType === 'message') {
    executeSQLite(`UPDATE sessions SET message_count = message_count + 1 WHERE id = '${sessionId}'`);
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

  let whereClause = `DATE(start_time) >= DATE('${startDate}') AND DATE(start_time) <= DATE('${endDateStr}')`;

  if (projectPath) {
    whereClause += ` AND project_path = '${projectPath.replace(/'/g, "''")}'`;
  }

  const sql = `
    SELECT id, project_path, project_name, start_time, end_time, duration_minutes, message_count, tool_use_count
    FROM sessions
    WHERE ${whereClause}
    ORDER BY start_time DESC
  `;

  const sessions = querySQLite(sql);

  // Calculate totals and apply active time logic
  const MAX_IDLE_MINUTES = 30;
  let totalActiveMinutes = 0;
  const sessionDetails = [];

  for (const session of sessions) {
    let activeMinutes = 0;

    if (session.duration_minutes) {
      // Get activities for this session
      const activities = querySQLite(`
        SELECT timestamp
        FROM activities
        WHERE session_id = '${session.id}'
        ORDER BY timestamp ASC
      `);

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
  let whereClause = '1=1';

  if (projectPath) {
    whereClause = `project_path = '${projectPath.replace(/'/g, "''")}'`;
  }

  const sql = `
    SELECT id, project_path, project_name, start_time, end_time, duration_minutes, message_count, tool_use_count
    FROM sessions
    WHERE ${whereClause}
    ORDER BY start_time DESC
    LIMIT ${limit}
  `;

  return querySQLite(sql);
}

export function getCurrentSession(projectPath) {
  const sql = `
    SELECT id, project_path, project_name, start_time
    FROM sessions
    WHERE project_path = '${projectPath.replace(/'/g, "''")}' AND end_time IS NULL
    ORDER BY start_time DESC
    LIMIT 1
  `;

  const sessions = querySQLite(sql);
  return sessions.length > 0 ? sessions[0] : null;
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

// Helper to estimate token count (rough: 4 chars = 1 token)
function estimateTokens(obj) {
  const jsonStr = JSON.stringify(obj);
  return Math.ceil(jsonStr.length / 4);
}

export function getActivities(options = {}) {
  const {
    startDate = null,
    endDate = null,
    sessionId = null,
    activityType = null,
    projectPath = null,
    limit = null,
    fields = null,
    continueAfter = null,
    tokenLimit = 20000  // Default to 20k tokens (safety margin from 25k MCP limit)
  } = options;

  let whereClauses = [];

  if (startDate) {
    whereClauses.push(`DATE(a.timestamp) >= DATE('${startDate}')`);
  }

  if (endDate) {
    whereClauses.push(`DATE(a.timestamp) <= DATE('${endDate}')`);
  }

  if (sessionId) {
    whereClauses.push(`a.session_id = '${sessionId}'`);
  }

  if (activityType) {
    whereClauses.push(`a.activity_type = '${activityType}'`);
  }

  if (projectPath) {
    whereClauses.push(`s.project_path = '${projectPath.replace(/'/g, "''")}'`);
  }

  // Add continuation filter - get activities older than the continuation timestamp
  if (continueAfter) {
    whereClauses.push(`a.timestamp < '${continueAfter}'`);
  }

  const whereClause = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

  // Don't use SQL LIMIT - we'll limit based on token count instead
  const sqlLimit = limit ? `LIMIT ${limit}` : '';

  const sql = `
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
    ${whereClause}
    ORDER BY a.timestamp DESC
    ${sqlLimit}
  `;

  const activities = querySQLite(sql);

  // Process activities with token limiting
  const result = {
    activities: [],
    total_returned: 0,
    has_more: false,
    continue_after: null,
    estimated_tokens: 0
  };

  let currentTokenCount = 0;
  const baseMetadataTokens = estimateTokens({ total_returned: 0, has_more: false, continue_after: null, estimated_tokens: 0 });

  for (let i = 0; i < activities.length; i++) {
    const activity = activities[i];

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

    // Estimate tokens for this activity
    const activityTokens = estimateTokens(finalActivity);

    // Check if adding this activity would exceed token limit
    if (currentTokenCount + activityTokens + baseMetadataTokens > tokenLimit) {
      // We've hit the limit - mark that there's more data
      result.has_more = true;
      result.continue_after = activity.timestamp;
      break;
    }

    // Add activity and update token count
    result.activities.push(finalActivity);
    currentTokenCount += activityTokens;
    result.total_returned++;
  }

  result.estimated_tokens = currentTokenCount + baseMetadataTokens;

  return result;
}

export function closeDatabase() {
  // No-op for SQLite via command line, but kept for API compatibility
}
