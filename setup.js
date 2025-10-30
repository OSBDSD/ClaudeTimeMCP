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
    // Doesn't exist, that's fine
  }

  // Add MCP server with user scope (global)
  // Syntax: claude mcp add --scope user --transport stdio <name> -- <command> [args...]
  const mcpCommand = `claude mcp add --scope user --transport stdio time-tracker -- node "${INDEX_JS}"`;
  console.log(`Running: ${mcpCommand}\n`);

  execSync(mcpCommand, { stdio: 'inherit' });
  console.log('\n✓ MCP server configured globally (user scope)\n');
} catch (error) {
  console.error('ERROR: Failed to configure MCP server');
  console.error(error.message);
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
    console.warn('Warning: Could not parse existing settings, creating new');
  }
}

// Configure hooks
if (!settings.hooks) {
  settings.hooks = {};
}

// UserPromptSubmit hook - logs session start (runs once per session)
settings.hooks.UserPromptSubmit = [
  {
    hooks: [
      {
        type: 'command',
        command: `node "${CLI_JS}" session-start`,
        runOnce: true
      }
    ]
  }
];

// ToolUse hook - logs activity on every tool use
settings.hooks.ToolUse = [
  {
    matcher: '*',
    hooks: [
      {
        type: 'command',
        command: `node "${CLI_JS}" log-activity`
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
