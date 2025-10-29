#!/usr/bin/env node

import * as readline from 'readline';
import * as db from './database.js';

// MCP Server for Claude Time Tracking
// Implements JSON-RPC 2.0 over stdio

const SERVER_NAME = 'claude-time-mcp';
const SERVER_VERSION = '1.0.0';

// Setup stdio communication
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Send JSON-RPC response
function sendResponse(id, result) {
  const response = {
    jsonrpc: '2.0',
    id,
    result
  };
  console.log(JSON.stringify(response));
}

// Send JSON-RPC error
function sendError(id, code, message, data = null) {
  const error = {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      ...(data && { data })
    }
  };
  console.log(JSON.stringify(error));
}

// Handle JSON-RPC request
function handleRequest(request) {
  const { id, method, params } = request;

  try {
    switch (method) {
      case 'initialize':
        sendResponse(id, {
          protocolVersion: '2024-11-05',
          serverInfo: {
            name: SERVER_NAME,
            version: SERVER_VERSION
          },
          capabilities: {
            tools: {}
          }
        });
        break;

      case 'tools/list':
        sendResponse(id, {
          tools: [
            {
              name: 'log_session_start',
              description: 'Log the start of a new Claude Code session',
              inputSchema: {
                type: 'object',
                properties: {
                  project_path: {
                    type: 'string',
                    description: 'The working directory path for this session'
                  },
                  timestamp: {
                    type: 'string',
                    description: 'ISO timestamp when the session started'
                  }
                },
                required: ['project_path', 'timestamp']
              }
            },
            {
              name: 'log_session_end',
              description: 'Log the end of a Claude Code session',
              inputSchema: {
                type: 'object',
                properties: {
                  session_id: {
                    type: 'string',
                    description: 'The session identifier to end'
                  },
                  timestamp: {
                    type: 'string',
                    description: 'ISO timestamp when the session ended'
                  }
                },
                required: ['session_id', 'timestamp']
              }
            },
            {
              name: 'log_activity',
              description: 'Log an activity during a session (tool use, message, etc.)',
              inputSchema: {
                type: 'object',
                properties: {
                  session_id: {
                    type: 'string',
                    description: 'The session identifier'
                  },
                  activity_type: {
                    type: 'string',
                    description: 'Type of activity (tool_use, message, etc.)',
                    enum: ['tool_use', 'message', 'error', 'other']
                  },
                  timestamp: {
                    type: 'string',
                    description: 'ISO timestamp of the activity'
                  },
                  metadata: {
                    type: 'object',
                    description: 'Optional additional data about the activity'
                  }
                },
                required: ['session_id', 'activity_type', 'timestamp']
              }
            },
            {
              name: 'get_time_report',
              description: 'Generate a time report for a date range',
              inputSchema: {
                type: 'object',
                properties: {
                  start_date: {
                    type: 'string',
                    description: 'Start date in ISO format (YYYY-MM-DD)'
                  },
                  end_date: {
                    type: 'string',
                    description: 'End date in ISO format (YYYY-MM-DD), defaults to today'
                  },
                  project_path: {
                    type: 'string',
                    description: 'Optional filter by project path'
                  }
                },
                required: ['start_date']
              }
            },
            {
              name: 'get_session_stats',
              description: 'Get detailed stats for recent sessions',
              inputSchema: {
                type: 'object',
                properties: {
                  limit: {
                    type: 'number',
                    description: 'Number of recent sessions to return (default 10)'
                  },
                  project_path: {
                    type: 'string',
                    description: 'Optional filter by project path'
                  }
                }
              }
            },
            {
              name: 'get_current_session',
              description: 'Get the current active session for a project',
              inputSchema: {
                type: 'object',
                properties: {
                  project_path: {
                    type: 'string',
                    description: 'The project path to check for active session'
                  }
                },
                required: ['project_path']
              }
            }
          ]
        });
        break;

      case 'tools/call':
        handleToolCall(id, params);
        break;

      default:
        sendError(id, -32601, `Method not found: ${method}`);
    }
  } catch (error) {
    sendError(id, -32603, 'Internal error', error.message);
  }
}

// Handle tool execution
function handleToolCall(id, params) {
  const { name, arguments: args } = params;

  try {
    let result;

    switch (name) {
      case 'log_session_start':
        result = db.createSession(args.project_path, args.timestamp);
        sendResponse(id, {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        });
        break;

      case 'log_session_end':
        result = db.endSession(args.session_id, args.timestamp);
        sendResponse(id, {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        });
        break;

      case 'log_activity':
        result = db.logActivity(
          args.session_id,
          args.activity_type,
          args.timestamp,
          args.metadata
        );
        sendResponse(id, {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        });
        break;

      case 'get_time_report':
        result = db.getTimeReport(
          args.start_date,
          args.end_date,
          args.project_path
        );

        // Format the report nicely
        const reportText = formatTimeReport(result);

        sendResponse(id, {
          content: [
            {
              type: 'text',
              text: reportText
            }
          ]
        });
        break;

      case 'get_session_stats':
        result = db.getSessionStats(args.limit || 10, args.project_path);
        sendResponse(id, {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        });
        break;

      case 'get_current_session':
        result = db.getCurrentSession(args.project_path);
        sendResponse(id, {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        });
        break;

      default:
        sendError(id, -32601, `Tool not found: ${name}`);
    }
  } catch (error) {
    sendError(id, -32603, 'Tool execution error', error.message);
  }
}

// Format time report for display
function formatTimeReport(report) {
  let text = `# Time Report: ${report.start_date} to ${report.end_date}\n\n`;
  text += `**Total Active Time**: ${report.total_hours.toFixed(2)} hours (${Math.round(report.total_minutes)} minutes)\n`;
  text += `**Total Sessions**: ${report.total_sessions}\n\n`;

  if (Object.keys(report.project_breakdown).length > 0) {
    text += `## Time by Project\n\n`;
    const sortedProjects = Object.entries(report.project_breakdown)
      .sort(([, a], [, b]) => b.minutes - a.minutes);

    for (const [project, data] of sortedProjects) {
      const hours = (data.minutes / 60).toFixed(2);
      text += `- **${project}**: ${hours}h (${data.sessions} sessions)\n`;
    }
    text += `\n`;
  }

  if (Object.keys(report.daily_breakdown).length > 0) {
    text += `## Daily Breakdown\n\n`;
    const sortedDays = Object.entries(report.daily_breakdown).sort();

    for (const [date, data] of sortedDays) {
      const hours = (data.minutes / 60).toFixed(2);
      text += `- **${date}**: ${hours}h (${data.sessions} sessions)\n`;
    }
  }

  return text;
}

// Handle incoming messages
rl.on('line', (line) => {
  try {
    const request = JSON.parse(line);
    handleRequest(request);
  } catch (error) {
    sendError(null, -32700, 'Parse error', error.message);
  }
});

// Handle process exit
process.on('SIGINT', () => {
  db.closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', () => {
  db.closeDatabase();
  process.exit(0);
});

// Log startup (to stderr so it doesn't interfere with JSON-RPC)
console.error(`${SERVER_NAME} v${SERVER_VERSION} started`);
