# Database Setup Guide

This guide will help you set up PostgreSQL and Redis for the AICraft Federation system.

## Prerequisites

- PostgreSQL 12+ installed
- Redis 6+ installed
- Node.js 18+ with npm

## PostgreSQL Setup

### 1. Install PostgreSQL

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
```

**macOS (Homebrew):**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Windows:**
Download and install from [postgresql.org](https://www.postgresql.org/download/windows/)

### 2. Create Database and User

```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Create database
CREATE DATABASE fgd_aicraft;

# Create user (optional, if not using postgres user)
CREATE USER fgd_admin WITH PASSWORD 'your_secure_password';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE fgd_aicraft TO fgd_admin;

# Exit
\q
```

### 3. Configure Environment

Copy `.env.example` to `.env` and update:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fgd_aicraft
DB_USER=postgres
DB_PASSWORD=your_password_here
```

### 4. Initialize Schema

The schema will be automatically initialized when the server starts. You can also manually run:

```bash
node scripts/init_database.js
```

## Redis Setup

### 1. Install Redis

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

**macOS (Homebrew):**
```bash
brew install redis
brew services start redis
```

**Windows:**
Download from [redis.io](https://redis.io/download) or use WSL

### 2. Configure Redis (Optional)

Edit Redis configuration:
```bash
sudo nano /etc/redis/redis.conf
```

Recommended settings:
```conf
maxmemory 256mb
maxmemory-policy allkeys-lru
appendonly yes
```

Restart Redis:
```bash
sudo systemctl restart redis-server
```

### 3. Test Connection

```bash
redis-cli ping
# Should return: PONG
```

### 4. Configure Environment

Update `.env`:
```env
REDIS_URL=redis://localhost:6379
```

## Database Schema

### Tables

#### npcs
Stores NPC registry data
- `id` (PK)
- `role`, `npc_type`, `status`
- `appearance`, `personality` (JSONB)
- `spawn_position`, `last_known_position` (JSONB)
- `metadata` (JSONB)
- Timestamps: `created_at`, `updated_at`, `last_active_at`

#### learning_profiles
Stores NPC learning data
- `npc_id` (PK, FK to npcs)
- `role`, `experience_points`, `level`
- `task_history`, `skill_improvements`, `behavioral_patterns` (JSONB)
- `success_rate`, task counters
- Timestamps: `created_at`, `updated_at`

#### metrics
Stores system and NPC metrics
- `id` (PK)
- `metric_type`, `metric_name`, `metric_value`
- `metadata` (JSONB)
- `npc_id` (FK, nullable)
- `timestamp`

#### task_queue
Async task queue
- `id` (PK)
- `npc_id` (FK)
- `task_type`, `task_data` (JSONB)
- `priority`, `status`, `attempts`
- Timestamps: `created_at`, `updated_at`, `executed_at`, `completed_at`

#### npc_archive
Archived/deleted NPCs
- `id` (PK)
- `original_data`, `learning_data` (JSONB)
- `finalization_reason`
- `archived_at`

#### system_events
Audit log
- `id` (PK)
- `event_type`, `event_data` (JSONB)
- `severity`, `npc_id` (FK, nullable)
- `timestamp`

## Redis Data Structures

### Cache Keys

- `npc:{id}` - NPC data cache (TTL: 5 min)
- `npcs:all:{filters}` - Filtered NPC list cache (TTL: 5 min)
- `learning:{npcId}` - Learning profile cache (TTL: 10 min)

### Pub/Sub Channels

- `npc:updates` - NPC state changes
- `task:completed` - Task completion events
- `metrics:update` - Real-time metrics
- `position:batch` - Batched position updates

## Maintenance

### Backup PostgreSQL

```bash
# Backup
pg_dump -U postgres fgd_aicraft > backup.sql

# Restore
psql -U postgres fgd_aicraft < backup.sql
```

### Monitor Redis

```bash
# Monitor all commands
redis-cli monitor

# Get info
redis-cli info

# Check memory usage
redis-cli info memory
```

### Performance Tuning

**PostgreSQL:**
```sql
-- Check slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Vacuum and analyze
VACUUM ANALYZE;
```

**Redis:**
```bash
# Check latency
redis-cli --latency

# Flush all (WARNING: deletes all data)
redis-cli FLUSHALL
```

## Troubleshooting

### PostgreSQL Connection Issues

```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Check connections
sudo -u postgres psql -c "SELECT * FROM pg_stat_activity;"

# Check logs
sudo tail -f /var/log/postgresql/postgresql-*.log
```

### Redis Connection Issues

```bash
# Check if Redis is running
sudo systemctl status redis-server

# Test connection
redis-cli ping

# Check logs
sudo tail -f /var/log/redis/redis-server.log
```

## Migration from File-Based System

The system supports gradual migration:

1. **Dual-write mode**: Data written to both files and database
2. **Read from database**: Gradually shift reads to database
3. **Deprecate files**: Once stable, disable file-based persistence

See `docs/MIGRATION.md` for detailed migration steps.
