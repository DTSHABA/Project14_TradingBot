import EmbeddedPostgres from 'embedded-postgres';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, unlinkSync } from 'fs';
import { execSync } from 'child_process';
import net from 'net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let embeddedInstance: EmbeddedPostgres | null = null;
let connectionString: string | null = null;

const isDatabaseInitialized = (dataDir: string): boolean => {
  const pgVersionFile = path.join(dataDir, 'PG_VERSION');
  const postgresqlConfFile = path.join(dataDir, 'postgresql.conf');
  return existsSync(pgVersionFile) && existsSync(postgresqlConfFile);
};

/**
 * Checks if a port is actually listening
 */
const isPortInUse = (port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, '127.0.0.1', () => {
      server.close(() => resolve(false));
    });
    server.on('error', () => resolve(true));
    setTimeout(() => {
      server.close();
      resolve(true);
    }, 500);
  });
};

/**
 * Checks if a process is running by PID
 */
const isProcessRunning = (pid: number): boolean => {
  try {
    if (process.platform === 'win32') {
      // Windows: Use tasklist to check if process exists
      const result = execSync(`tasklist /FI "PID eq ${pid}" /NH`, { encoding: 'utf-8', stdio: 'pipe' });
      return result.trim().length > 0 && result.includes(String(pid));
    } else {
      // Unix-like: Use kill -0 to check if process exists
      execSync(`kill -0 ${pid}`, { stdio: 'pipe' });
      return true;
    }
  } catch {
    return false;
  }
};

/**
 * Safely terminates a process by PID
 */
const killProcess = (pid: number): boolean => {
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'pipe' });
      return true;
    } else {
      execSync(`kill -9 ${pid}`, { stdio: 'pipe' });
      return true;
    }
  } catch {
    return false;
  }
};

/**
 * Handles stale PostgreSQL lock files
 * Removes the lock file if the process is not actually running or not listening on the required port
 */
const handleStaleLockFile = async (dataDir: string, requiredPort: number): Promise<void> => {
  const lockFilePath = path.join(dataDir, 'postmaster.pid');
  
  if (!existsSync(lockFilePath)) {
    return;
  }

  try {
    // Read the PID from the lock file
    const lockFileContent = readFileSync(lockFilePath, 'utf-8');
    const lines = lockFileContent.trim().split('\n');
    const pid = parseInt(lines[0]?.trim() || '0', 10);

    if (!pid || isNaN(pid)) {
      console.log('⚠️ Invalid PID in lock file, removing stale lock file...');
      unlinkSync(lockFilePath);
      return;
    }

    // Check if the process is actually running
    const processRunning = isProcessRunning(pid);
    
    // Check if the required port is actually in use
    const portInUse = await isPortInUse(requiredPort);

    if (!processRunning) {
      // Process is not running, safe to remove lock file
      console.log(`⚠️ Found stale PostgreSQL lock file (PID ${pid} not running)`);
      console.log('🧹 Removing stale lock file...');
      unlinkSync(lockFilePath);
      console.log('✅ Stale lock file removed');
    } else if (!portInUse) {
      // Process is running but not listening on our port - likely a zombie or different instance
      console.log(`⚠️ PostgreSQL process (PID ${pid}) is running but not listening on port ${requiredPort}`);
      console.log('🧹 This appears to be a stale process, attempting to clean up...');
      
      // Try to kill the process
      if (killProcess(pid)) {
        console.log(`✅ Terminated stale process (PID ${pid})`);
        // Wait a moment for the process to fully terminate
        await new Promise(resolve => setTimeout(resolve, 500));
        unlinkSync(lockFilePath);
        console.log('✅ Stale lock file removed');
      } else {
        console.log(`⚠️ Could not terminate process ${pid}, but port ${requiredPort} is available`);
        console.log('🧹 Removing lock file anyway...');
        unlinkSync(lockFilePath);
        console.log('✅ Lock file removed');
      }
    } else {
      // Process is running AND port is in use - legitimate instance
      console.log(`⚠️ PostgreSQL process (PID ${pid}) is running and listening on port ${requiredPort}`);
      console.log(`💡 Please stop it manually or use a different project folder`);
      throw new Error(`PostgreSQL instance already running (PID ${pid}) on port ${requiredPort}`);
    }
  } catch (error: any) {
    // If error is already about running process, rethrow it
    if (error?.message && error.message.includes('already running')) {
      throw error;
    }
    
    // Otherwise, try to remove the lock file anyway
    console.log('⚠️ Error reading lock file, attempting to remove it...');
    try {
      unlinkSync(lockFilePath);
      console.log('✅ Lock file removed');
    } catch (removeError) {
      console.error('❌ Could not remove lock file:', removeError);
      throw error;
    }
  }
};

export const startEmbeddedPostgres = async (port: number = 5502): Promise<string> => {
  if (embeddedInstance && connectionString) {
    return connectionString;
  }

  console.log('🗄️ Starting embedded PostgreSQL...');

  // Use data directory relative to the database-server package
  const dataDir = path.join(__dirname, '../../data/postgres');
  
  // Handle stale lock files before starting (check if port is actually in use)
  await handleStaleLockFile(dataDir, port);
  
  const isInitialized = isDatabaseInitialized(dataDir);

  embeddedInstance = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'postgres',
    password: 'password',
    port: port,
    persistent: true,
    initdbFlags: process.platform === 'darwin' 
      ? ['--encoding=UTF8', '--lc-collate=en_US.UTF-8', '--lc-ctype=en_US.UTF-8']
      : ['--encoding=UTF8', '--lc-collate=C', '--lc-ctype=C']
  });

  try {
    if (!isInitialized) {
      console.log('📦 Initializing PostgreSQL cluster...');
      await embeddedInstance.initialise();
    }

    await embeddedInstance.start();
    connectionString = `postgresql://postgres:password@localhost:${port}/postgres`;
    
    console.log(`✅ Embedded PostgreSQL started on port ${port}`);
    return connectionString;
  } catch (error: any) {
    if (error?.message && error.message.includes('postmaster.pid already exists')) {
      // Try to handle stale lock file one more time
      try {
        await handleStaleLockFile(dataDir, port);
        // Retry starting PostgreSQL after removing stale lock
        console.log('🔄 Retrying PostgreSQL startup...');
        
        // Recreate the instance if it was nullified
        if (!embeddedInstance) {
          embeddedInstance = new EmbeddedPostgres({
            databaseDir: dataDir,
            user: 'postgres',
            password: 'password',
            port: port,
            persistent: true,
            initdbFlags: process.platform === 'darwin' 
              ? ['--encoding=UTF8', '--lc-collate=en_US.UTF-8', '--lc-ctype=en_US.UTF-8']
              : ['--encoding=UTF8', '--lc-collate=C', '--lc-ctype=C']
          });
        }
        
        await embeddedInstance.start();
        connectionString = `postgresql://postgres:password@localhost:${port}/postgres`;
        console.log(`✅ Embedded PostgreSQL started on port ${port}`);
        return connectionString;
      } catch (retryError: any) {
        embeddedInstance = null;
        console.log('⚠️ PostgreSQL instance already running in this directory');
        console.log('💡 Either stop the other instance or use a different project folder');
        throw retryError;
      }
    } else {
      embeddedInstance = null;
      console.error('❌ Failed to start embedded PostgreSQL:', error?.message || error);
      throw error;
    }
  }
};

export const stopEmbeddedPostgres = async (): Promise<void> => {
  if (!embeddedInstance) return;

  try {
    console.log('🛑 Stopping embedded PostgreSQL...');
    await embeddedInstance.stop();
    embeddedInstance = null;
    connectionString = null;
    console.log('✅ Embedded PostgreSQL stopped');
  } catch (error) {
    console.error('❌ Error stopping embedded PostgreSQL:', error);
    embeddedInstance = null;
    connectionString = null;
  }
};

export const getEmbeddedConnectionString = (): string | null => connectionString; 