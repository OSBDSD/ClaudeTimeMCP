#!/usr/bin/env node
// Hook: PostToolUse - Logs tool usage

import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import * as logger from "./hookLogger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HOOK_NAME = "PostToolUse";

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
    const toolName = data.tool_name || "unknown";
    const timestamp = new Date().toISOString();

    logger.info(HOOK_NAME, `Logging tool: ${toolName}`);

    const baseDir = path.resolve(__dirname, "..");
    const cliPath = path.join(baseDir, "cli.js");

    // Prepare metadata
    const metadata = {
      tool: toolName,
      description: "",
    };

    const metadataEncoded = Buffer.from(JSON.stringify(metadata)).toString("base64");

    // Encode the full tool detail (this can be large!)
    const toolDetailEncoded = Buffer.from(stdinData).toString("base64");

    logger.debug(HOOK_NAME, `Encoded data size: ${toolDetailEncoded.length} bytes`);

    // Invoke CLI tool
    const result = spawnSync("node", [
      cliPath,
      "log-activity",
      "tool_use",
      timestamp,
      "--metadata-base64",
      metadataEncoded,
      "--tool-detail-base64",
      toolDetailEncoded,
    ], { stdio: "inherit" });

    if (result.error) {
      logger.error(HOOK_NAME, "Failed to spawn CLI process", result.error);
      process.exit(1);
    } else if (result.status !== 0) {
      logger.error(HOOK_NAME, `CLI process exited with code ${result.status}`);
      process.exit(result.status);
    } else {
      logger.info(HOOK_NAME, "Successfully logged tool usage");
    }
  } catch (error) {
    logger.error(HOOK_NAME, "Unexpected error", error);
    process.exit(1);
  }
}
