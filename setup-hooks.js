#!/usr/bin/env node

/**
 * ClaudeTime - Hooks Setup
 * Configures Claude Code hooks globally to track sessions automatically
 *
 * This script ONLY configures hooks (no MCP server)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Build absolute paths to hook scripts
const PROJECT_DIR = __dirname;
const SCRIPTS_DIR = path.join(PROJECT_DIR, 'scripts');

console.log('ClaudeTime - Hooks Setup');
console.log('========================\n');
console.log('Project directory:', PROJECT_DIR);
console.log('Scripts directory:', SCRIPTS_DIR);
console.log('');

// Verify scripts directory exists
if (!fs.existsSync(SCRIPTS_DIR)) {
  console.error('ERROR: Scripts directory not found:', SCRIPTS_DIR);
  console.error('Please ensure the scripts/ directory exists with hook scripts.');
  process.exit(1);
}

// Verify all required hook scripts exist
const requiredScripts = [
  'onSessionStart.js',
  'onSessionEnd.js',
  'onUserPromptSubmit.js',
  'onPostToolUse.js',
  'onStop.js'
];

for (const script of requiredScripts) {
  const scriptPath = path.join(SCRIPTS_DIR, script);
  if (!fs.existsSync(scriptPath)) {
    console.error(`ERROR: Required script not found: ${scriptPath}`);
    process.exit(1);
  }
}

console.log('✓ All hook scripts found\n');

// Configure Hooks (Global)
console.log('Configuring Hooks (Global)');
console.log('--------------------------');

// Claude Code uses TWO config files for hooks:
// 1. ~/.claude/settings.json (newer format)
// 2. AppData/Roaming/claude-code/config.json (older format)
// We'll update both to be safe

const CONFIG_PATHS = [
  path.join(homedir(), '.claude', 'settings.json'),
  path.join(homedir(), 'AppData', 'Roaming', 'claude-code', 'config.json')
];

// Hook configurations for the newer format (~/.claude/settings.json)
const newFormatHooks = {
  SessionStart: [{
    hooks: [{
      type: 'command',
      command: `node "${path.join(SCRIPTS_DIR, 'onSessionStart.js')}"`
    }]
  }],
  SessionEnd: [{
    hooks: [{
      type: 'command',
      command: `node "${path.join(SCRIPTS_DIR, 'onSessionEnd.js')}"`
    }]
  }],
  UserPromptSubmit: [{
    hooks: [{
      type: 'command',
      command: `node "${path.join(SCRIPTS_DIR, 'onUserPromptSubmit.js')}"`
    }]
  }],
  PostToolUse: [{
    matcher: '*',
    hooks: [{
      type: 'command',
      command: `node "${path.join(SCRIPTS_DIR, 'onPostToolUse.js')}"`
    }]
  }],
  Stop: [{
    hooks: [{
      type: 'command',
      command: `node "${path.join(SCRIPTS_DIR, 'onStop.js')}"`
    }]
  }]
};

// Hook configurations for the older format (AppData/claude-code/config.json)
const oldFormatHooks = {
  'user-prompt-submit-hook': {
    command: `node "${path.join(SCRIPTS_DIR, 'onSessionStart.js')}"`,
    runOnce: true
  },
  'user-message-hook': {
    command: `node "${path.join(SCRIPTS_DIR, 'onUserPromptSubmit.js')}"`
  },
  'tool-use-hook': {
    command: `node "${path.join(SCRIPTS_DIR, 'onPostToolUse.js')}"`
  }
};

// Update each config file
for (const configPath of CONFIG_PATHS) {
  console.log(`\n--- Configuring: ${configPath} ---`);

  // Ensure directory exists
  const configDir = path.dirname(configPath);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
    console.log(`✓ Created ${configDir}`);
  }

  // Read existing settings or create new
  let settings = {};
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf8');
      settings = JSON.parse(content);
      console.log('✓ Read existing configuration');

      // Backup existing settings
      const backupPath = `${configPath}.backup.${Date.now()}`;
      fs.writeFileSync(backupPath, content, 'utf8');
      console.log(`✓ Backed up to: ${backupPath}`);
    } catch (error) {
      console.error('WARNING: Could not parse existing config, creating new');
      console.error('Error:', error.message);
      settings = {};
    }
  }

  // Initialize hooks object if it doesn't exist
  if (!settings.hooks) {
    settings.hooks = {};
  }

  // Apply the appropriate hook format based on config path
  if (configPath.includes('.claude')) {
    // Newer format (SessionStart, SessionEnd, etc.)
    Object.assign(settings.hooks, newFormatHooks);
    console.log('Configured hooks:');
    console.log('  ✓ SessionStart -> onSessionStart.js');
    console.log('  ✓ SessionEnd -> onSessionEnd.js');
    console.log('  ✓ UserPromptSubmit -> onUserPromptSubmit.js');
    console.log('  ✓ PostToolUse -> onPostToolUse.js');
    console.log('  ✓ Stop -> onStop.js');
  } else {
    // Older format (user-prompt-submit-hook, etc.)
    Object.assign(settings.hooks, oldFormatHooks);
    console.log('Configured hooks:');
    console.log('  ✓ user-prompt-submit-hook -> onSessionStart.js');
    console.log('  ✓ user-message-hook -> onUserPromptSubmit.js');
    console.log('  ✓ tool-use-hook -> onPostToolUse.js');
  }

  // Write updated settings
  try {
    fs.writeFileSync(configPath, JSON.stringify(settings, null, 2), 'utf8');
    console.log(`✓ Configuration written successfully`);
  } catch (error) {
    console.error('\nERROR: Failed to write configuration');
    console.error('File:', configPath);
    console.error('Error:', error.message);
    process.exit(1);
  }
}

console.log('\n========================================');
console.log('Setup Complete!');
console.log('========================================');
console.log('\nUpdated config files:');
console.log('  1. C:\\Users\\eric\\.claude\\settings.json');
console.log('  2. C:\\Users\\eric\\AppData\\Roaming\\claude-code\\config.json');
console.log('\nNext steps:');
console.log('1. Restart Claude Code for hooks to take effect');
console.log('2. Hooks will automatically track all sessions');
console.log('3. Use "npm run report" to generate timesheets');
console.log('4. Use "node cli.js stats" to view recent sessions\n');
console.log('Hook logs: data/hooks.log');
console.log('Database: time-tracker.db\n');
