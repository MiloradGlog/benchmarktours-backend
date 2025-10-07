import fs from 'fs';
import path from 'path';
import { query } from './db';

export const runMigrations = async (): Promise<void> => {
  try {
    // Create migrations table if it doesn't exist
    await query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const migrationsDir = path.join(__dirname, '../../migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    for (const file of files) {
      // Check if migration already executed
      const result = await query('SELECT id FROM migrations WHERE filename = $1', [file]);
      
      if (result.rows.length === 0) {
        console.log(`Running migration: ${file}`);
        
        // Read and execute migration
        const migrationSQL = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        await query(migrationSQL);
        
        // Record migration as executed
        await query('INSERT INTO migrations (filename) VALUES ($1)', [file]);
        
        console.log(`✅ Migration ${file} completed`);
      } else {
        console.log(`⏭️  Migration ${file} already executed`);
      }
    }
    
    console.log('🎉 All migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};