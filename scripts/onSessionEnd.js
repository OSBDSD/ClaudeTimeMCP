#!/usr/bin/env node
// Hook: SessionEnd - Logs when a session ends

import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import * as logger from "./hookLogger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HOOK_NAME = "SessionEnd";

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

    const timestamp = new Date().toISOString();

    logger.info(HOOK_NAME, "Ending session");

    const baseDir = path.resolve(__dirname, "..");
    const cliPath = path.join(baseDir, "cli.js");

    // Invoke CLI tool
    const result = spawnSync("node", [cliPath, "session-end", timestamp], {
      stdio: "inherit",
    });

    if (result.error) {
      logger.error(HOOK_NAME, "Failed to spawn CLI process", result.error);
      process.exit(1);
    } else if (result.status !== 0) {
      logger.error(HOOK_NAME, `CLI process exited with code ${result.status}`);
      process.exit(result.status);
    } else {
      logger.info(HOOK_NAME, "Successfully logged session end");
    }
  } catch (error) {
    logger.error(HOOK_NAME, "Unexpected error", error);
    process.exit(1);
  }
}
