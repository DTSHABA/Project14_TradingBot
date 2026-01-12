/**
 * File system utilities
 */
import { access } from 'fs/promises';
import { constants } from 'fs';

/**
 * Check if a file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}


