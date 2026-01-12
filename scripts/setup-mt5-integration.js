#!/usr/bin/env node

/**
 * Quick Start Script for MT5 Integration
 * This script helps set up and verify the MT5 integration
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

console.log('🚀 MT5 Integration Quick Start\n');
console.log('================================\n');

// Step 1: Check if Python is installed
console.log('Step 1: Checking Python installation...');
const pythonCheck = spawn('python', ['--version'], { shell: true });

pythonCheck.on('error', () => {
  console.error('❌ Python is not installed or not in PATH');
  console.error('   Please install Python 3.8+ from: https://www.python.org/downloads/\n');
  process.exit(1);
});

pythonCheck.stdout.on('data', (data) => {
  console.log(`✅ Python found: ${data.toString().trim()}\n`);
});

pythonCheck.on('close', (code) => {
  if (code !== 0) {
    console.error('❌ Python check failed\n');
    process.exit(1);
  }
  
  // Step 2: Check if trading-engine exists
  console.log('Step 2: Checking trading-engine directory...');
  const tradingEngineDir = join(rootDir, 'trading-engine');
  
  if (!existsSync(tradingEngineDir)) {
    console.error('❌ trading-engine directory not found\n');
    process.exit(1);
  }
  
  console.log('✅ trading-engine directory found\n');
  
  // Step 3: Check if requirements.txt exists
  console.log('Step 3: Checking requirements.txt...');
  const requirementsPath = join(tradingEngineDir, 'requirements.txt');
  
  if (!existsSync(requirementsPath)) {
    console.error('❌ requirements.txt not found\n');
    process.exit(1);
  }
  
  console.log('✅ requirements.txt found\n');
  
  // Step 4: Check if mt5_api.py exists
  console.log('Step 4: Checking MT5 API service...');
  const mt5ApiPath = join(tradingEngineDir, 'mt5_api.py');
  
  if (!existsSync(mt5ApiPath)) {
    console.error('❌ mt5_api.py not found\n');
    process.exit(1);
  }
  
  console.log('✅ MT5 API service found\n');
  
  // Step 5: Instructions
  console.log('================================\n');
  console.log('✅ All checks passed!\n');
  console.log('📋 Next Steps:\n');
  console.log('1. Start the MT5 API service:');
  console.log('   cd trading-engine');
  console.log('   run_mt5_api.bat  (Windows)');
  console.log('   # OR');
  console.log('   python mt5_api.py\n');
  console.log('2. Add to server/.env:');
  console.log('   MT5_API_URL=http://127.0.0.1:5001\n');
  console.log('3. Restart your development server:');
  console.log('   pnpm dev\n');
  console.log('4. Test MT5 connection in the UI\n');
  console.log('📖 Full guide: docs/MT5_INTEGRATION_GUIDE.md\n');
});





