import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 12 bytes for GCM
const AUTH_TAG_LENGTH = 16; // 16 bytes for GCM
const KEY_LENGTH = 32; // 32 bytes for AES-256

/**
 * Get encryption key from environment variable
 * The key should be a 32-byte base64-encoded string
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  
  try {
    const keyBuffer = Buffer.from(key, 'base64');
    if (keyBuffer.length !== KEY_LENGTH) {
      throw new Error(`ENCRYPTION_KEY must be ${KEY_LENGTH} bytes (base64-encoded)`);
    }
    return keyBuffer;
  } catch (error) {
    throw new Error(`Invalid ENCRYPTION_KEY format: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Encrypt text using AES-256-GCM
 * Returns base64-encoded string: IV (12 bytes) + encrypted data + auth tag (16 bytes)
 */
export function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'binary');
  encrypted += cipher.final('binary');
  
  const authTag = cipher.getAuthTag();
  
  // Combine: IV + encrypted data + auth tag
  const combined = Buffer.concat([
    iv,
    Buffer.from(encrypted, 'binary'),
    authTag,
  ]);
  
  return combined.toString('base64');
}

/**
 * Decrypt base64-encoded encrypted string
 * Validates authentication tag before decryption
 */
export function decrypt(encryptedBase64: string): string {
  const key = getEncryptionKey();
  
  const combined = Buffer.from(encryptedBase64, 'base64');
  
  if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Invalid encrypted data format');
  }
  
  // Extract: IV (first 12 bytes), auth tag (last 16 bytes), encrypted data (middle)
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH, combined.length - AUTH_TAG_LENGTH);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, undefined, 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Generate a new encryption key (for initial setup)
 * Returns base64-encoded 32-byte key
 */
export function generateEncryptionKey(): string {
  const key = crypto.randomBytes(KEY_LENGTH);
  return key.toString('base64');
}

