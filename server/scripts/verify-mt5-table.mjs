#!/usr/bin/env node
import postgres from 'postgres';
import 'dotenv/config';

const sql = postgres(process.env.DATABASE_URL);

try {
  const result = await sql`
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'app' AND table_name = 'mt5_accounts' 
    ORDER BY ordinal_position
  `;
  
  console.log('✅ mt5_accounts table structure:');
  result.forEach(row => {
    console.log(`   - ${row.column_name} (${row.data_type})`);
  });
} catch (error) {
  console.error('❌ Error:', error.message);
}

await sql.end();

