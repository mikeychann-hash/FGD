import pkg from 'pg';
const { Pool } = pkg;
import { logger } from '../../logger.js';

let pool = null;

/**
 * Database configuration
 * SECURITY: DB_PASSWORD must be set via environment variable - no defaults allowed
 */
const DB_PASSWORD = process.env.DB_PASSWORD;

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'fgd_aicraft',
  user: process.env.DB_USER || 'postgres',
  password: DB_PASSWORD,
  max: parseInt(process.env.DB_POOL_MAX || '20'),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000'),
};

/**
 * Initialize database connection pool
 */
export async function initDatabase() {
  // Validate DB_PASSWORD is set
  if (!DB_PASSWORD || DB_PASSWORD.trim() === '') {
    // We throw here so the startup validator can catch it and decide whether to continue
    throw new Error(
      'DB_PASSWORD environment variable not set. Database connection skipped.'
    );
  }

  try {
    pool = new Pool(dbConfig);

    // Test connection
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();

    logger.info('Database connected successfully', {
      host: dbConfig.host,
      database: dbConfig.database,
      time: result.rows[0].now,
    });
    console.log('✅ PostgreSQL connected');

    // Set up error handler
    pool.on('error', (err) => {
      logger.error('Unexpected database error', { error: err.message });
      console.error('❌ Database error:', err.message);
    });

    return pool;
  } catch (err) {
    logger.error('Failed to connect to database', { error: err.message });
    console.error('❌ Database connection failed:', err.message);
    throw err;
  }
}

/**
 * Get database pool instance
 */
export function getPool() {
  if (!pool) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return pool;
}

/**
 * Execute a query with automatic error handling
 */
export async function query(text, params = []) {
  if (!pool) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    logger.debug('Query executed', { duration, rows: result.rowCount });
    return result;
  } catch (err) {
    // Avoid logging the raw query (it may embed credentials in inline literals)
    // or full error objects (which can include the offending row's values).
    const redactedQuery = typeof text === 'string'
      ? text
          .replace(/(password\s*=\s*)'[^']*'/gi, "$1'***'")
          .replace(/(token\s*=\s*)'[^']*'/gi, "$1'***'")
          .replace(/(secret\s*=\s*)'[^']*'/gi, "$1'***'")
      : '<non-string-query>';
    logger.error('Query failed', {
      error: err.message,
      code: err.code,
      query: redactedQuery.length > 200 ? `${redactedQuery.slice(0, 200)}…` : redactedQuery,
    });
    throw err;
  }
}

/**
 * Execute a transaction
 */
export async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Close database connection pool
 */
export async function closeDatabase() {
  if (pool) {
    await pool.end();
    logger.info('Database connection pool closed');
    console.log('✅ Database closed');
  }
}
