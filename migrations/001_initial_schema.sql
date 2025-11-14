-- FGD Initial Database Schema
-- Created: 2025-11-14
-- Purpose: Core tables for NPC management, task planning, and learning

-- =============================================================================
-- NPCs Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS npcs (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  uuid VARCHAR(36) UNIQUE NOT NULL,
  state VARCHAR(50) NOT NULL DEFAULT 'idle',
  current_phase INTEGER DEFAULT 1 CHECK (current_phase BETWEEN 1 AND 6),
  experience_points INTEGER DEFAULT 0 CHECK (experience_points >= 0),
  skills JSONB DEFAULT '{}',
  position JSONB,
  inventory JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT valid_state CHECK (state IN ('idle', 'active', 'paused', 'error', 'terminated'))
);

COMMENT ON TABLE npcs IS 'Minecraft NPC bot instances with state and progression tracking';
COMMENT ON COLUMN npcs.state IS 'Current operational state: idle, active, paused, error, terminated';
COMMENT ON COLUMN npcs.current_phase IS 'Progression phase (1-6), determines available tasks and complexity';
COMMENT ON COLUMN npcs.skills IS 'JSONB object tracking skill proficiency levels';
COMMENT ON COLUMN npcs.position IS 'JSONB object with x, y, z coordinates in Minecraft world';
COMMENT ON COLUMN npcs.inventory IS 'JSONB array of inventory items';

-- =============================================================================
-- Tasks Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  npc_id INTEGER NOT NULL REFERENCES npcs(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  priority INTEGER DEFAULT 0 CHECK (priority BETWEEN 0 AND 10),
  parameters JSONB DEFAULT '{}',
  result JSONB,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  timeout_at TIMESTAMP,

  CONSTRAINT valid_status CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled', 'timeout'))
);

COMMENT ON TABLE tasks IS 'Task queue and execution tracking for NPCs';
COMMENT ON COLUMN tasks.type IS 'Task type: mining, building, crafting, combat, exploration, etc.';
COMMENT ON COLUMN tasks.status IS 'Task execution status';
COMMENT ON COLUMN tasks.priority IS 'Task priority (0-10), higher = more important';
COMMENT ON COLUMN tasks.parameters IS 'JSONB object with task-specific parameters';
COMMENT ON COLUMN tasks.result IS 'JSONB object with task execution results';

-- =============================================================================
-- Learning Data Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS learning_data (
  id SERIAL PRIMARY KEY,
  npc_id INTEGER NOT NULL REFERENCES npcs(id) ON DELETE CASCADE,
  task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  task_type VARCHAR(100) NOT NULL,
  success BOOLEAN NOT NULL,
  duration_ms INTEGER CHECK (duration_ms >= 0),
  feedback JSONB DEFAULT '{}',
  context JSONB DEFAULT '{}',
  improvement_score FLOAT CHECK (improvement_score BETWEEN -1.0 AND 1.0),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE learning_data IS 'Learning feedback and experience tracking for continuous improvement';
COMMENT ON COLUMN learning_data.success IS 'Whether task completed successfully';
COMMENT ON COLUMN learning_data.duration_ms IS 'Task execution duration in milliseconds';
COMMENT ON COLUMN learning_data.feedback IS 'JSONB object with structured feedback data';
COMMENT ON COLUMN learning_data.context IS 'JSONB object with environmental context (weather, time, resources)';
COMMENT ON COLUMN learning_data.improvement_score IS 'Learning score: -1.0 (worse) to 1.0 (better)';

-- =============================================================================
-- Policies Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS policies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  type VARCHAR(50) NOT NULL,
  description TEXT,
  rules JSONB NOT NULL,
  enabled BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  enforcement_level VARCHAR(20) DEFAULT 'warning',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255),

  CONSTRAINT valid_type CHECK (type IN ('safety', 'resource', 'behavior', 'performance', 'security')),
  CONSTRAINT valid_enforcement CHECK (enforcement_level IN ('info', 'warning', 'error', 'block'))
);

COMMENT ON TABLE policies IS 'Governance policies for NPC behavior and safety rules';
COMMENT ON COLUMN policies.type IS 'Policy category: safety, resource, behavior, performance, security';
COMMENT ON COLUMN policies.rules IS 'JSONB object defining policy rules and conditions';
COMMENT ON COLUMN policies.enforcement_level IS 'How strictly to enforce: info, warning, error, block';

-- =============================================================================
-- Users Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  full_name VARCHAR(255),
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP,
  login_count INTEGER DEFAULT 0,

  CONSTRAINT valid_role CHECK (role IN ('admin', 'user', 'guest', 'api'))
);

COMMENT ON TABLE users IS 'User accounts for authentication and authorization';
COMMENT ON COLUMN users.role IS 'User role: admin, user, guest, api';
COMMENT ON COLUMN users.password_hash IS 'Bcrypt hashed password (never store plaintext!)';

-- =============================================================================
-- API Keys Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS api_keys (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  key_hash VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255),
  description TEXT,
  scopes TEXT[] DEFAULT ARRAY[]::TEXT[],
  expires_at TIMESTAMP,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used TIMESTAMP,
  usage_count INTEGER DEFAULT 0
);

COMMENT ON TABLE api_keys IS 'API keys for programmatic access';
COMMENT ON COLUMN api_keys.key_hash IS 'SHA-256 hash of API key (store hash, not plaintext)';
COMMENT ON COLUMN api_keys.scopes IS 'Array of allowed API scopes/permissions';

-- =============================================================================
-- Audit Log Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100),
  resource_id VARCHAR(255),
  details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  status VARCHAR(20)
);

COMMENT ON TABLE audit_log IS 'Audit trail for security and compliance';
COMMENT ON COLUMN audit_log.action IS 'Action performed: create, read, update, delete, login, etc.';
COMMENT ON COLUMN audit_log.resource_type IS 'Type of resource affected: npc, task, policy, user, etc.';

-- =============================================================================
-- Indexes for Performance
-- =============================================================================

-- NPCs indexes
CREATE INDEX idx_npcs_state ON npcs(state);
CREATE INDEX idx_npcs_uuid ON npcs(uuid);
CREATE INDEX idx_npcs_current_phase ON npcs(current_phase);
CREATE INDEX idx_npcs_created_at ON npcs(created_at DESC);

-- Tasks indexes
CREATE INDEX idx_tasks_npc_id ON tasks(npc_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority DESC);
CREATE INDEX idx_tasks_type ON tasks(type);
CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX idx_tasks_npc_status ON tasks(npc_id, status); -- Composite for common queries

-- Learning data indexes
CREATE INDEX idx_learning_data_npc_id ON learning_data(npc_id);
CREATE INDEX idx_learning_data_task_type ON learning_data(task_type);
CREATE INDEX idx_learning_data_success ON learning_data(success);
CREATE INDEX idx_learning_data_created_at ON learning_data(created_at DESC);
CREATE INDEX idx_learning_data_npc_task ON learning_data(npc_id, task_type); -- Composite

-- Policies indexes
CREATE INDEX idx_policies_enabled ON policies(enabled);
CREATE INDEX idx_policies_type ON policies(type);
CREATE INDEX idx_policies_priority ON policies(priority DESC);

-- Users indexes
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- API keys indexes
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_enabled ON api_keys(enabled);
CREATE INDEX idx_api_keys_expires_at ON api_keys(expires_at);

-- Audit log indexes
CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp DESC);
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_resource ON audit_log(resource_type, resource_id);

-- =============================================================================
-- Functions and Triggers
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_npcs_updated_at
    BEFORE UPDATE ON npcs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_policies_updated_at
    BEFORE UPDATE ON policies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Seed Data (Default Policies)
-- =============================================================================

INSERT INTO policies (name, type, description, rules, enabled, priority, enforcement_level) VALUES
  ('max_concurrent_tasks', 'performance', 'Limit maximum concurrent tasks per NPC',
   '{"max_tasks": 5, "action": "queue"}', true, 10, 'block'),

  ('resource_limits', 'resource', 'Prevent resource exhaustion',
   '{"max_inventory_slots": 36, "max_task_duration_ms": 300000}', true, 9, 'warning'),

  ('safe_mining_depth', 'safety', 'Prevent NPCs from mining too deep without proper gear',
   '{"min_y": -60, "required_items": ["iron_pickaxe", "torches"]}', true, 8, 'warning'),

  ('no_pvp', 'behavior', 'Disable player-vs-player combat',
   '{"allow_pvp": false}', true, 7, 'block'),

  ('rate_limiting', 'security', 'Prevent API abuse',
   '{"max_requests_per_minute": 100, "max_bots_per_user": 10}', true, 10, 'block');

-- =============================================================================
-- Default Admin User (password: "admin123" - CHANGE IN PRODUCTION!)
-- =============================================================================
-- Note: This is a bcrypt hash of "admin123"
-- Generate your own with: bcrypt.hash("your_password", 10)
INSERT INTO users (username, email, password_hash, role, full_name) VALUES
  ('admin', 'admin@localhost', '$2b$10$rKjEKP5hHvYOiVOq5qQjCOxPr5Qb5jOxQlFLmG5LqGbS5IxLgJZMa', 'admin', 'System Administrator')
ON CONFLICT (username) DO NOTHING;

-- =============================================================================
-- Views for Common Queries
-- =============================================================================

-- Active NPCs with current task count
CREATE OR REPLACE VIEW active_npcs_summary AS
SELECT
  n.id,
  n.name,
  n.uuid,
  n.state,
  n.current_phase,
  n.experience_points,
  COUNT(t.id) FILTER (WHERE t.status IN ('pending', 'in_progress')) AS active_tasks,
  COUNT(t.id) FILTER (WHERE t.status = 'completed') AS completed_tasks,
  COUNT(t.id) FILTER (WHERE t.status = 'failed') AS failed_tasks,
  MAX(t.created_at) AS last_task_time
FROM npcs n
LEFT JOIN tasks t ON t.npc_id = n.id
WHERE n.state = 'active'
GROUP BY n.id, n.name, n.uuid, n.state, n.current_phase, n.experience_points;

COMMENT ON VIEW active_npcs_summary IS 'Summary of active NPCs with task statistics';

-- Learning performance by task type
CREATE OR REPLACE VIEW learning_performance AS
SELECT
  task_type,
  COUNT(*) AS total_attempts,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) AS successful,
  ROUND(100.0 * SUM(CASE WHEN success THEN 1 ELSE 0 END) / COUNT(*), 2) AS success_rate,
  ROUND(AVG(duration_ms)::numeric, 2) AS avg_duration_ms,
  ROUND(AVG(improvement_score)::numeric, 3) AS avg_improvement
FROM learning_data
GROUP BY task_type
ORDER BY total_attempts DESC;

COMMENT ON VIEW learning_performance IS 'Learning statistics by task type';

-- =============================================================================
-- Grant Permissions (adjust as needed for production)
-- =============================================================================
-- Example: GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO fgd_user;
-- Example: GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO fgd_user;

-- =============================================================================
-- Schema Version
-- =============================================================================
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  description TEXT
);

INSERT INTO schema_version (version, description) VALUES
  (1, 'Initial schema with NPCs, tasks, learning, policies, users, and audit logging');

-- =============================================================================
-- End of Initial Schema
-- =============================================================================
