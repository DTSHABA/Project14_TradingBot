#!/usr/bin/env node

/**
 * Database initialization script
 * Sets up the private schema and creates all tables
 */

import postgres from 'postgres';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL not found in environment variables');
  console.error('💡 Make sure your .env file is configured or the database server is running');
  process.exit(1);
}

console.log('🗄️  Initializing database...\n');

const initializeDatabase = async () => {
  let sql;
  
  try {
    // Connect to database
    sql = postgres(connectionString, { 
      prepare: false,
      max: 1,
    });

    console.log('✅ Connected to database');
    console.log(`   ${connectionString.replace(/:[^:@]+@/, ':****@')}\n`);

    // Step 1: Create app schema
    console.log('📁 Creating "app" schema...');
    await sql`CREATE SCHEMA IF NOT EXISTS app`;
    console.log('   ✅ Schema created\n');

    // Step 2: Set search path
    console.log('🔧 Setting search path...');
    await sql`SET search_path TO app, public`;
    console.log('   ✅ Search path configured\n');

    // Step 3: Read and execute migration SQL
    console.log('📝 Running database migrations...');
    const migrationPath = join(__dirname, '../drizzle/0001_complete_schema.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    // Execute the entire SQL as a single transaction
    try {
      await sql.unsafe(migrationSQL);
      console.log('   ✅ All tables created\n');
    } catch (error) {
      // Show detailed error for debugging
      console.error('   ❌ Migration error:', error.message);
      throw error;
    }

    // Step 4: Verify tables exist
    console.log('🔍 Verifying tables...');
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'app'
      ORDER BY table_name
    `;
    
    console.log('   ✅ Found tables:');
    tables.forEach(t => console.log(`      • ${t.table_name}`));
    console.log('');

    console.log('✅ Database initialization completed successfully!\n');
    console.log('🎉 You can now start using the application');
    
  } catch (error) {
    console.error('❌ Failed to initialize database:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('   • Verify DATABASE_URL is correct');
    console.error('   • Ensure database server is running');
    console.error('   • Check database user has necessary permissions');
    console.error('   • For local development, make sure `pnpm dev` is running');
    process.exit(1);
  } finally {
    if (sql) {
      await sql.end();
    }
  }
};

initializeDatabase();

