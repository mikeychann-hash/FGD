import { query } from './connection.js';
import { logger } from '../../logger.js';

/**
 * Initialize database schema
 */
export async function initializeSchema() {
  try {
    logger.info('Initializing database schema');

    // Create NPCs table
    await query(`
      CREATE TABLE IF NOT EXISTS npcs (
        id VARCHAR(255) PRIMARY KEY,
        role VARCHAR(100) NOT NULL,
        npc_type VARCHAR(100),
        status VARCHAR(50) DEFAULT 'idle',
        appearance JSONB,
        personality JSONB,
        spawn_position JSONB,
        last_known_position JSONB,
        metadata JSONB,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        last_active_at TIMESTAMP
      )
    `);

    // Create learning profiles table
    await query(`
      CREATE TABLE IF NOT EXISTS learning_profiles (
        npc_id VARCHAR(255) PRIMARY KEY REFERENCES npcs(id) ON DELETE CASCADE,
        role VARCHAR(100) NOT NULL,
        experience_points INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        task_history JSONB DEFAULT '[]',
        skill_improvements JSONB DEFAULT '{}',
        behavioral_patterns JSONB DEFAULT '{}',
        success_rate DECIMAL(5,2) DEFAULT 0.00,
        total_tasks INTEGER DEFAULT 0,
        successful_tasks INTEGER DEFAULT 0,
        failed_tasks INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create metrics table
    await query(`
      CREATE TABLE IF NOT EXISTS metrics (
        id SERIAL PRIMARY KEY,
        metric_type VARCHAR(100) NOT NULL,
        metric_name VARCHAR(255) NOT NULL,
        metric_value DECIMAL(10,2) NOT NULL,
        metadata JSONB,
        timestamp TIMESTAMP DEFAULT NOW(),
        npc_id VARCHAR(255) REFERENCES npcs(id) ON DELETE SET NULL
      )
    `);

    // Create task queue table
    await query(`
      CREATE TABLE IF NOT EXISTS task_queue (
        id SERIAL PRIMARY KEY,
        npc_id VARCHAR(255) REFERENCES npcs(id) ON DELETE CASCADE,
        task_type VARCHAR(100) NOT NULL,
        task_data JSONB NOT NULL,
        priority INTEGER DEFAULT 0,
        status VARCHAR(50) DEFAULT 'pending',
        attempts INTEGER DEFAULT 0,
        max_attempts INTEGER DEFAULT 3,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        executed_at TIMESTAMP,
        completed_at TIMESTAMP
      )
    `);

    // Create NPC archive table
    await query(`
      CREATE TABLE IF NOT EXISTS npc_archive (
        id VARCHAR(255) PRIMARY KEY,
        original_data JSONB NOT NULL,
        learning_data JSONB,
        finalization_reason VARCHAR(255),
        archived_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create system events table for audit log
    await query(`
      CREATE TABLE IF NOT EXISTS system_events (
        id SERIAL PRIMARY KEY,
        event_type VARCHAR(100) NOT NULL,
        event_data JSONB,
        severity VARCHAR(50) DEFAULT 'info',
        npc_id VARCHAR(255) REFERENCES npcs(id) ON DELETE SET NULL,
        timestamp TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create indices for performance
    await query(`
      CREATE INDEX IF NOT EXISTS idx_npcs_status ON npcs(status);
      CREATE INDEX IF NOT EXISTS idx_npcs_role ON npcs(role);
      CREATE INDEX IF NOT EXISTS idx_metrics_type ON metrics(metric_type);
      CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp);
      CREATE INDEX IF NOT EXISTS idx_task_queue_status ON task_queue(status);
      CREATE INDEX IF NOT EXISTS idx_task_queue_priority ON task_queue(priority DESC);
      CREATE INDEX IF NOT EXISTS idx_system_events_type ON system_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_system_events_timestamp ON system_events(timestamp);
    `);

    logger.info('Database schema initialized successfully');
    console.log('✅ Database schema initialized');
  } catch (err) {
    logger.error('Failed to initialize schema', { error: err.message });
    console.error('❌ Schema initialization failed:', err.message);
    throw err;
  }
}
