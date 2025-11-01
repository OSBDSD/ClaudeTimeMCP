#!/usr/bin/env node
// Hook: Stop - Logs Claude's response when the session stops

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import * as logger from "./hookLogger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HOOK_NAME = "Stop";

// Support both direct stdin or piped data
let stdinData = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (stdinData += chunk));
process.stdin.on("end", () => main(stdinData.trim()));

async function main(stdinData) {
  try {
    if (!stdinData) {
      logger.debug(HOOK_NAME, "No stdin data received");
      return;
    }

    const data = JSON.parse(stdinData);
    const sessionId = data.session_id;
    const transcriptPath = data.transcript_path;

    logger.info(HOOK_NAME, `Processing stop for session: ${sessionId}`);

    const timestamp = new Date().toISOString();
    const baseDir = path.resolve(__dirname, "..");
    const logFile = path.join(baseDir, "data", "claude_responses.log");

    let lastText = "";

    if (fs.existsSync(transcriptPath)) {
      const lines = fs.readFileSync(transcriptPath, "utf8").split(/\r?\n/);
      // iterate backwards to find the last assistant message
      for (let i = lines.length - 1; i >= 0; i--) {
        if (!lines[i].trim()) continue;
        try {
          const obj = JSON.parse(lines[i]);
          if (obj.type === "assistant" && obj.message?.content) {
            for (const content of obj.message.content) {
              if (content.type === "text") {
                lastText = content.text;
                break;
              }
            }
            if (lastText) break;
          }
        } catch (err) {
          // Skip invalid JSON lines
        }
      }
    } else {
      logger.error(HOOK_NAME, `Transcript file not found: ${transcriptPath}`);
    }

    if (lastText) {
      logger.info(HOOK_NAME, `Found assistant response (${lastText.length} chars)`);

      // Ensure log directory exists
      fs.mkdirSync(path.dirname(logFile), { recursive: true });

      const logEntry = `[${timestamp}] Session: ${sessionId}\n${lastText}\n\n---\n\n`;
      fs.appendFileSync(logFile, logEntry, "utf8");

      // Prepare metadata
      const metadata = {
        response_text: lastText,
        response_length: lastText.length,
        session_id: sessionId,
      };

      const metadataEncoded = Buffer.from(JSON.stringify(metadata)).toString("base64");

      // Invoke CLI tool
      const cliPath = path.join(baseDir, "cli.js");
      const result = spawnSync("node", [
        cliPath,
        "log-activity",
        "assistant_response",
        timestamp,
        "--metadata-base64",
        metadataEncoded,
      ], { stdio: "inherit" });

      if (result.error) {
        logger.error(HOOK_NAME, "Failed to spawn CLI process", result.error);
        process.exit(1);
      } else if (result.status !== 0) {
        logger.error(HOOK_NAME, `CLI process exited with code ${result.status}`);
        process.exit(result.status);
      } else {
        logger.info(HOOK_NAME, "Successfully logged assistant response");
      }
    } else {
      logger.debug(HOOK_NAME, "No assistant response found in transcript");
    }
  } catch (error) {
    logger.error(HOOK_NAME, "Unexpected error", error);
    process.exit(1);
  }
}
