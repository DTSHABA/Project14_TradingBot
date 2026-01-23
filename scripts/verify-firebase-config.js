#!/usr/bin/env node

/**
 * Firebase Configuration Verification Script
 * 
 * This script helps verify that your Firebase configuration is correct
 * and provides guidance on fixing common issues.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

console.log('🔍 Verifying Firebase Configuration...\n');

// Read Firebase config
const configPath = join(projectRoot, 'ui', 'src', 'lib', 'firebase-config.json');
let config;

try {
  const configContent = readFileSync(configPath, 'utf-8');
  config = JSON.parse(configContent);
  console.log('✅ Found firebase-config.json\n');
} catch (error) {
  console.error('❌ Error reading firebase-config.json:', error.message);
  console.error('   Please ensure the file exists at:', configPath);
  process.exit(1);
}

// Validation checks
const checks = [
  {
    name: 'API Key',
    field: 'apiKey',
    isValid: (val) => val && val.length > 20 && !val.includes('demo') && val !== 'demo-api-key',
    errorMsg: 'API key appears to be invalid or a placeholder'
  },
  {
    name: 'Auth Domain',
    field: 'authDomain',
    isValid: (val) => val && val.includes('.firebaseapp.com'),
    errorMsg: 'Auth domain should end with .firebaseapp.com'
  },
  {
    name: 'Project ID',
    field: 'projectId',
    isValid: (val) => val && val !== 'demo-project' && val.length > 0,
    errorMsg: 'Project ID appears to be invalid or a placeholder'
  },
  {
    name: 'Storage Bucket',
    field: 'storageBucket',
    isValid: (val) => val && (val.includes('.appspot.com') || val.includes('.firebasestorage.app')),
    errorMsg: 'Storage bucket format appears invalid'
  },
  {
    name: 'Messaging Sender ID',
    field: 'messagingSenderId',
    isValid: (val) => val && val.length > 0,
    errorMsg: 'Messaging sender ID is missing'
  },
  {
    name: 'App ID',
    field: 'appId',
    isValid: (val) => val && val.includes(':') && val.length > 10,
    errorMsg: 'App ID format appears invalid'
  }
];

let hasErrors = false;

console.log('📋 Configuration Values:\n');
checks.forEach(check => {
  const value = config[check.field];
  const isValid = check.isValid(value);
  
  if (isValid) {
    console.log(`  ✅ ${check.name}: ${value.substring(0, 30)}...`);
  } else {
    console.log(`  ❌ ${check.name}: ${value || 'MISSING'}`);
    console.log(`     ⚠️  ${check.errorMsg}`);
    hasErrors = true;
  }
});

console.log('\n');

if (hasErrors) {
  console.log('❌ Configuration validation failed!\n');
  console.log('📖 To fix this:\n');
  console.log('1. Go to Firebase Console: https://console.firebase.google.com/');
  console.log('2. Select your project');
  console.log('3. Click gear icon ⚙️ > Project Settings');
  console.log('4. Scroll to "Your apps" section');
  console.log('5. Click on your web app (or add a new one)');
  console.log('6. Copy the firebaseConfig object');
  console.log('7. Update ui/src/lib/firebase-config.json with the new values\n');
  console.log('📚 See docs/FIREBASE_SETUP_GUIDE.md for detailed instructions.\n');
  process.exit(1);
} else {
  console.log('✅ All configuration checks passed!\n');
  console.log('📝 Next steps:\n');
  console.log('1. Verify domain is authorized in Firebase Console:');
  console.log('   Authentication > Settings > Authorized domains');
  console.log('   Add: aibotrades.com\n');
  console.log('2. Ensure Google sign-in is enabled:');
  console.log('   Authentication > Sign-in method > Google > Enable\n');
  console.log('3. Check browser console for any runtime errors\n');
  console.log('📚 See docs/FIREBASE_SETUP_GUIDE.md for troubleshooting.\n');
}
