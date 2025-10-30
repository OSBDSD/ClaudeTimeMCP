#!/usr/bin/env node

/**
 * ClaudeTimeMCP - Unified Setup
 * Configures MCP server and hooks globally using Claude CLI
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { platform, homedir } from 'os';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Build absolute paths
const PROJECT_DIR = __dirname;
const INDEX_JS = path.join(PROJECT_DIR, 'index.js');
const CLI_JS = path.join(PROJECT_DIR, 'cli.js');

console.log('ClaudeTimeMCP - Global Setup');
console.log('=============================\n');
console.log('Project directory:', PROJECT_DIR);
console.log('');

// Step 1: Configure MCP Server using Claude CLI
console.log('Step 1: Configuring MCP Server (Global)');
console.log('----------------------------------------');

try {
  // Remove existing time-tracker if present (from any scope)
  try {
    execSync('claude mcp remove time-tracker', { stdio: 'pipe' });
    console.log('✓ Removed existing time-tracker configuration');
  } catch (e) {
    // Check if it's just a "not found" error or a real error
    if (e.message && !e.message.includes('not found') && !e.message.includes('does not exist')) {
      console.error('!!! ERROR removing existing time-tracker configuration:');
      console.error(`!!! Error: ${e.message}`);
      console.error(`!!! Stack: ${e.stack}`);
    }
    // If it doesn't exist, that's fine - continue
  }

  // Add MCP server with user scope (global)
  // Syntax: claude mcp add --scope user --transport stdio <name> -- <command> [args...]
  const mcpCommand = `claude mcp add --scope user --transport stdio time-tracker -- node "${INDEX_JS}"`;
  console.log(`Running: ${mcpCommand}\n`);

  execSync(mcpCommand, { stdio: 'inherit' });
  console.log('\n✓ MCP server configured globally (user scope)\n');
} catch (error) {
  console.error('!!! ERROR: Failed to configure MCP server');
  console.error(`!!! Command: ${mcpCommand}`);
  console.error(`!!! Error: ${error.message}`);
  console.error(`!!! Stack: ${error.stack}`);
  if (error.stderr) {
    console.error(`!!! Stderr: ${error.stderr}`);
  }
  if (error.stdout) {
    console.error(`!!! Stdout: ${error.stdout}`);
  }
  process.exit(1);
}

// Step 2: Configure Hooks (Global)
console.log('Step 2: Configuring Hooks (Global)');
console.log('-----------------------------------');

// Hooks config path: ~/.claude/settings.json
const HOOKS_CONFIG_PATH = path.join(homedir(), '.claude', 'settings.json');

// Ensure .claude directory exists
const claudeDir = path.dirname(HOOKS_CONFIG_PATH);
if (!fs.existsSync(claudeDir)) {
  fs.mkdirSync(claudeDir, { recursive: true });
  console.log(`✓ Created ${claudeDir}`);
}

// Read existing settings or create new
let settings = {};
if (fs.existsSync(HOOKS_CONFIG_PATH)) {
  try {
    settings = JSON.parse(fs.readFileSync(HOOKS_CONFIG_PATH, 'utf8'));
    console.log('✓ Read existing hooks configuration');

    // Backup
    const backupPath = `${HOOKS_CONFIG_PATH}.backup.${Date.now()}`;
    fs.writeFileSync(backupPath, JSON.stringify(settings, null, 2), 'utf8');
    console.log(`✓ Backed up to: ${backupPath}`);
  } catch (error) {
    console.error('!!! WARNING: Could not parse existing settings, creating new');
    console.error(`!!! File: ${HOOKS_CONFIG_PATH}`);
    console.error(`!!! Error: ${error.message}`);
    console.error(`!!! Stack: ${error.stack}`);
  }
}

// Configure hooks
if (!settings.hooks) {
  settings.hooks = {};
}

// SessionStart hook - starts tracking when Claude Code session begins
settings.hooks.SessionStart = [
  {
    hooks: [
      {
        type: 'command',
        command: `node "${CLI_JS}" session-start`
      }
    ]
  }
];

// SessionEnd hook - ends tracking when Claude Code session exits
settings.hooks.SessionEnd = [
  {
    hooks: [
      {
        type: 'command',
        command: `node "${CLI_JS}" session-end`
      }
    ]
  }
];

// UserPromptSubmit hook - logs each user message as activity
// Reads JSON from stdin and extracts the prompt field
const userMessageCommand = platform() === 'win32'
  ? `powershell -Command "$stdinData = [Console]::In.ReadToEnd(); $data = $stdinData | ConvertFrom-Json; $timestamp = [DateTime]::UtcNow.ToString('o'); $metadata = @{prompt=$data.prompt} | ConvertTo-Json -Compress; $encoded = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($metadata)); & node '${CLI_JS}' log-activity message $timestamp --metadata-base64 $encoded"`
  : `bash -c 'INPUT=$(cat); PROMPT=$(echo "$INPUT" | jq -r ".prompt // \\"[user message]\\""); TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ" 2>/dev/null || date -u +"%Y-%m-%dT%H:%M:%SZ"); JSON="{\\"prompt\\":\\"$PROMPT\\"}"; ENCODED=$(echo -n "$JSON" | base64 -w 0 2>/dev/null || echo -n "$JSON" | base64); node "${CLI_JS}" log-activity message "$TIMESTAMP" --metadata-base64 "$ENCODED"'`;

settings.hooks.UserPromptSubmit = [
  {
    hooks: [
      {
        type: 'command',
        command: userMessageCommand
      }
    ]
  }
];

// PostToolUse hook - logs activity after every tool use
// Reads JSON from stdin and passes the ENTIRE hook JSON as tool_detail
// Also extracts tool_name for simple metadata
const toolUseCommand = platform() === 'win32'
  ? `powershell -Command "$stdinData = [Console]::In.ReadToEnd(); $data = $stdinData | ConvertFrom-Json; $timestamp = [DateTime]::UtcNow.ToString('o'); $metadata = @{tool=$data.tool_name; description=''} | ConvertTo-Json -Compress; $metadataEncoded = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($metadata)); $toolDetailEncoded = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($stdinData)); & node '${CLI_JS}' log-activity tool_use $timestamp --metadata-base64 $metadataEncoded --tool-detail-base64 $toolDetailEncoded"`
  : `bash -c 'INPUT=$(cat); TOOL=$(echo "$INPUT" | jq -r ".tool_name // \\"[tool_use]\\""); TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ" 2>/dev/null || date -u +"%Y-%m-%dT%H:%M:%SZ"); META="{\\"tool\\":\\"$TOOL\\",\\"description\\":\\"\\"}"; META_ENC=$(echo -n "$META" | base64 -w 0 2>/dev/null || echo -n "$META" | base64); DETAIL_ENC=$(echo -n "$INPUT" | base64 -w 0 2>/dev/null || echo -n "$INPUT" | base64); node "${CLI_JS}" log-activity tool_use "$TIMESTAMP" --metadata-base64 "$META_ENC" --tool-detail-base64 "$DETAIL_ENC"'`;

settings.hooks.PostToolUse = [
  {
    matcher: '*',
    hooks: [
      {
        type: 'command',
        command: toolUseCommand
      }
    ]
  }
];

// Write updated settings
fs.writeFileSync(HOOKS_CONFIG_PATH, JSON.stringify(settings, null, 2), 'utf8');
console.log('✓ Hooks configured globally');
console.log(`  Config: ${HOOKS_CONFIG_PATH}\n`);

// Summary
console.log('Configuration Complete!');
console.log('======================\n');

console.log('What was configured:');
console.log('  ✅ MCP Server: time-tracker (user scope - works in ALL projects)');
console.log('  ✅ Hooks: Session tracking (global - works in ALL projects)');
console.log('');

console.log('Verify MCP configuration:');
console.log('  claude mcp list');
console.log('');

console.log('Verify hooks configuration:');
console.log(`  cat "${HOOKS_CONFIG_PATH}"`);
console.log('');

console.log('Next Steps:');
console.log('----------');
console.log('1. Reload VS Code (if using VS Code):');
console.log('   Ctrl+Shift+P → "Developer: Reload Window"');
console.log('   OR restart terminal (if using CLI)');
console.log('');
console.log('2. Start a new Claude Code session');
console.log('');
console.log('3. Ask Claude: "Can you list your available MCP tools?"');
console.log('   You should see time-tracker tools available');
console.log('');
console.log('4. Every interaction will now be tracked automatically!');
console.log('');

console.log('View your stats anytime:');
console.log(`  node "${CLI_JS}" stats`);
console.log(`  node "${CLI_JS}" report`);
console.log('');
