#!/usr/bin/env node

/**
 * Generate encryption key for MT5 account credentials
 * This generates a secure 32-byte base64-encoded key for AES-256-GCM encryption
 */

import crypto from 'crypto';

const KEY_LENGTH = 32; // 32 bytes for AES-256

function generateEncryptionKey() {
  const key = crypto.randomBytes(KEY_LENGTH);
  return key.toString('base64');
}

const key = generateEncryptionKey();

console.log('\n🔐 Generated Encryption Key:\n');
console.log(key);
console.log('\n📝 Add this to your .env file:\n');
console.log(`ENCRYPTION_KEY=${key}\n`);
console.log('⚠️  Keep this key secure and never commit it to version control!\n');

