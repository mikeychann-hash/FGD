#!/usr/bin/env node

/**
 * Database initialization script
 * Connects to PostgreSQL and creates the schema
 */

import { initDatabase, closeDatabase } from '../src/database/connection.js';
import { initializeSchema } from '../src/database/schema.js';
import { logger } from '../logger.js';

async function main() {
  try {
    console.log('🚀 Initializing database...\n');

    // Connect to database
    await initDatabase();

    // Create schema
    await initializeSchema();

    console.log('\n✅ Database initialized successfully!');
    console.log('   You can now start the server with: npm start');

    await closeDatabase();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Database initialization failed:', err.message);
    logger.error('Database initialization failed', { error: err.message, stack: err.stack });
    process.exit(1);
  }
}

main();
