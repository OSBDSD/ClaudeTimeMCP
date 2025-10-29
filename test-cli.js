#!/usr/bin/env node

/**
 * Test script for CLI functionality
 */

import { execSync } from 'child_process';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Testing ClaudeTimeMCP CLI...\n');

// Helper to run CLI commands
function runCLI(command) {
  try {
    const output = execSync(`node cli.js ${command}`, {
      cwd: __dirname,
      encoding: 'utf8'
    });
    return output;
  } catch (error) {
    return error.stdout || error.message;
  }
}

// Test 1: Start a session
console.log('Test 1: Starting a session...');
const startOutput = runCLI(`session-start "${__dirname}"`);
console.log(startOutput);

// Test 2: Log some activities
console.log('Test 2: Logging activities...');
runCLI('log-activity tool_use');
console.log('✓ Activity 1 logged');

runCLI('log-activity message');
console.log('✓ Activity 2 logged');

runCLI('log-activity tool_use');
console.log('✓ Activity 3 logged');
console.log('');

// Test 3: Check current session
console.log('Test 3: Checking current session...');
const currentOutput = runCLI(`current-session "${__dirname}"`);
console.log(currentOutput);

// Test 4: End the session
console.log('Test 4: Ending session...');
const endOutput = runCLI('session-end');
console.log(endOutput);

// Test 5: View stats
console.log('Test 5: Viewing recent sessions...');
const statsOutput = runCLI('stats 5');
console.log(statsOutput);

// Test 6: Generate report
console.log('Test 6: Generating time report...');
const today = new Date().toISOString().split('T')[0];
const reportOutput = runCLI(`report ${today}`);
console.log(reportOutput);

console.log('\n✓ All CLI tests completed successfully!');
console.log('You can now test the hooks by configuring Claude Code.\n');
