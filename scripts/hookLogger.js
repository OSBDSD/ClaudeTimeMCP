// Unified hook logging utility
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const baseDir = path.resolve(__dirname, "..");
const logDir = path.join(baseDir, "data");
const logFile = path.join(logDir, "hooks.log");

// Ensure log directory exists
fs.mkdirSync(logDir, { recursive: true });

export function log(hookName, level, message, data = null) {
  const timestamp = new Date().toISOString();
  const logLevel = level.toUpperCase().padEnd(5);

  let logLine = `[${timestamp}] [${logLevel}] [${hookName}] ${message}`;

  if (data) {
    logLine += `\n  Data: ${JSON.stringify(data, null, 2)}`;
  }

  logLine += "\n";

  // Write to file
  fs.appendFileSync(logFile, logLine, "utf8");

  // Also output to console for debugging
  if (level === "error") {
    console.error(logLine);
  } else if (level === "info") {
    console.log(logLine);
  }
}

export function error(hookName, message, errorObj = null) {
  const data = errorObj ? {
    message: errorObj.message,
    stack: errorObj.stack,
  } : null;

  log(hookName, "error", message, data);
}

export function info(hookName, message, data = null) {
  log(hookName, "info", message, data);
}

export function debug(hookName, message, data = null) {
  log(hookName, "debug", message, data);
}
