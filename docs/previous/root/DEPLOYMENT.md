# FGD DEPLOYMENT GUIDE
**Minecraft NPC Swarm Management System**
**Version:** 2.1.0
**Last Updated:** 2025-11-14

---

## TABLE OF CONTENTS

1. [Prerequisites](#prerequisites)
2. [Quick Start (Docker)](#quick-start-docker)
3. [Manual Deployment](#manual-deployment)
4. [Environment Configuration](#environment-configuration)
5. [Database Setup](#database-setup)
6. [Production Hardening](#production-hardening)
7. [Monitoring & Maintenance](#monitoring--maintenance)
8. [Troubleshooting](#troubleshooting)
9. [Scaling & High Availability](#scaling--high-availability)

---

## PREREQUISITES

### Hardware Requirements

| Component | Minimum | Recommended | Production |
|-----------|---------|-------------|------------|
| **CPU** | 2 cores | 4 cores | 8+ cores |
| **RAM** | 4 GB | 8 GB | 16+ GB |
| **Storage** | 20 GB | 50 GB | 100+ GB SSD |
| **Network** | 10 Mbps | 100 Mbps | 1 Gbps |

### Software Requirements

**Option A: Docker Deployment (Recommended)**
- Docker 20.10+ ([Install](https://docs.docker.com/engine/install/))
- Docker Compose 2.0+ ([Install](https://docs.docker.com/compose/install/))

**Option B: Manual Deployment**
- Node.js 20+ ([Install](https://nodejs.org/))
- PostgreSQL 14+ ([Install](https://www.postgresql.org/download/))
- Redis 7+ ([Install](https://redis.io/download))
- (Optional) Minecraft Server for NPC testing

### Network Requirements

**Outbound (Required):**
- HTTPS (443) for LLM API calls (OpenAI, Grok)
- HTTP/HTTPS for package downloads

**Inbound (Your choice):**
- Port 3000: FGD Application API
- Port 5432: PostgreSQL (if exposing externally)
- Port 6379: Redis (if exposing externally)
- Port 25565: Minecraft server
- Port 443: HTTPS (for production with reverse proxy)

---

## QUICK START (DOCKER)

### Step 1: Clone Repository

```bash
git clone https://github.com/mikeychann-hash/FGD.git
cd FGD
```

### Step 2: Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env and set required variables
nano .env  # or use your preferred editor
```

**REQUIRED: Set these in .env:**
```env
JWT_SECRET=your_secure_random_string_at_least_32_characters_long
OPENAI_API_KEY=sk-your-openai-api-key-here  # If using OpenAI
GROK_API_KEY=your-grok-api-key-here          # If using Grok
```

**Generate secure JWT_SECRET:**
```bash
# Method 1: Using OpenSSL
openssl rand -base64 32

# Method 2: Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Method 3: Using /dev/urandom (Linux/Mac)
head -c 32 /dev/urandom | base64
```

### Step 3: Start All Services

```bash
# Build and start all services in background
docker-compose up -d

# Watch logs (Ctrl+C to exit, services keep running)
docker-compose logs -f app
```

### Step 4: Verify Deployment

```bash
# Check service status
docker-compose ps

# Expected output:
# NAME                IMAGE                  STATUS
# fgd-app             fgd-app:latest        Up (healthy)
# fgd-postgres        postgres:15-alpine    Up (healthy)
# fgd-redis           redis:7-alpine        Up (healthy)
# fgd-minecraft       itzg/minecraft-server Up (healthy)

# Test health endpoint
curl http://localhost:3000/api/v1/cluster/health

# Expected: {"status":"healthy","timestamp":"..."}
```

### Step 5: Access Application

- **API Endpoint:** `http://localhost:3000`
- **Health Check:** `http://localhost:3000/api/v1/cluster/health`
- **Metrics:** `http://localhost:3000/metrics` (if enabled)

### Step 6: Create First NPC (Test)

```bash
# Using curl (requires JWT token - see Authentication section)
curl -X POST http://localhost:3000/api/v1/bot/create \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "TestBot", "phase": 1}'
```

---

## MANUAL DEPLOYMENT

For production or custom environments without Docker.

### Step 1: Install Dependencies

**Ubuntu/Debian:**
```bash
# Update package list
sudo apt-get update

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL 15
sudo apt-get install -y postgresql postgresql-contrib

# Install Redis 7
sudo apt-get install -y redis-server

# Verify installations
node --version  # Should be v20.x
psql --version  # Should be 15.x
redis-server --version  # Should be 7.x
```

**CentOS/RHEL/Fedora:**
```bash
# Install Node.js 20
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# Install PostgreSQL 15
sudo yum install -y postgresql15-server postgresql15-contrib

# Install Redis 7
sudo yum install -y redis

# Initialize PostgreSQL
sudo postgresql-setup --initdb
sudo systemctl start postgresql
```

### Step 2: Configure PostgreSQL

```bash
# Switch to postgres user
sudo -i -u postgres

# Create database and user
psql
```

```sql
-- In psql console:
CREATE DATABASE fgd_production;
CREATE USER fgd_user WITH PASSWORD 'YOUR_SECURE_PASSWORD_HERE';
GRANT ALL PRIVILEGES ON DATABASE fgd_production TO fgd_user;

-- Grant schema permissions
\c fgd_production
GRANT ALL ON SCHEMA public TO fgd_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO fgd_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO fgd_user;

-- Exit psql
\q
```

```bash
# Exit postgres user
exit

# Test connection
psql -U fgd_user -d fgd_production -h localhost

# If successful, you'll see: fgd_production=>
# Type \q to exit
```

### Step 3: Run Database Migrations

```bash
# Apply schema
psql -U fgd_user -d fgd_production -h localhost -f migrations/001_initial_schema.sql

# Verify tables created
psql -U fgd_user -d fgd_production -h localhost -c "\dt"

# Expected output: List of 7 tables (npcs, tasks, learning_data, policies, users, api_keys, audit_log)
```

### Step 4: Configure Redis

```bash
# Start Redis
sudo systemctl start redis
sudo systemctl enable redis  # Start on boot

# Test Redis
redis-cli ping  # Should return: PONG

# Optional: Set Redis password
sudo nano /etc/redis/redis.conf
# Find line: # requirepass foobared
# Uncomment and change: requirepass YOUR_SECURE_PASSWORD

# Restart Redis
sudo systemctl restart redis
```

### Step 5: Install Application

```bash
# Clone repository
git clone https://github.com/mikeychann-hash/FGD.git
cd FGD

# Install Node.js dependencies
npm install

# If vulnerabilities found, fix them
npm audit fix
```

### Step 6: Configure Application

```bash
# Create .env file from example
cp .env.example .env

# Edit with your settings
nano .env
```

**Minimum required .env configuration:**
```env
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://fgd_user:YOUR_DB_PASSWORD@localhost:5432/fgd_production
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fgd_production
DB_USER=fgd_user
DB_PASSWORD=YOUR_DB_PASSWORD

# Redis
REDIS_URL=redis://localhost:6379
# If password set: REDIS_URL=redis://:YOUR_REDIS_PASSWORD@localhost:6379

# JWT (generate with: openssl rand -base64 32)
JWT_SECRET=YOUR_SECURE_32_CHAR_SECRET
JWT_EXPIRES_IN=24h

# LLM API
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your-key-here

# Logging
LOG_LEVEL=info
LOG_DIR=./logs
```

### Step 7: Start Application

**Development mode:**
```bash
npm run dev
```

**Production mode (with PM2 - recommended):**
```bash
# Install PM2 globally
sudo npm install -g pm2

# Start application with PM2
pm2 start server.js --name fgd-app

# View logs
pm2 logs fgd-app

# Save PM2 configuration
pm2 save

# Set PM2 to start on boot
pm2 startup
# Follow the instructions provided by the command

# Other PM2 commands
pm2 status        # View all processes
pm2 restart fgd-app
pm2 stop fgd-app
pm2 delete fgd-app
pm2 monit         # Monitor in real-time
```

**Production mode (with systemd):**

Create service file:
```bash
sudo nano /etc/systemd/system/fgd-app.service
```

```ini
[Unit]
Description=FGD Minecraft NPC Swarm Management
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=fgd
Group=fgd
WorkingDirectory=/home/fgd/FGD
Environment=NODE_ENV=production
EnvironmentFile=/home/fgd/FGD/.env
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=fgd-app

[Install]
WantedBy=multi-user.target
```

```bash
# Reload systemd
sudo systemctl daemon-reload

# Start service
sudo systemctl start fgd-app

# Enable on boot
sudo systemctl enable fgd-app

# Check status
sudo systemctl status fgd-app

# View logs
sudo journalctl -u fgd-app -f
```

---

## ENVIRONMENT CONFIGURATION

### Complete .env Reference

```env
# =============================================================================
# Server Configuration
# =============================================================================
NODE_ENV=production          # development | production | test
PORT=3000                    # Application port
HOST=0.0.0.0                # Bind address (0.0.0.0 = all interfaces)

# =============================================================================
# Database Configuration
# =============================================================================
DATABASE_URL=postgresql://fgd_user:password@localhost:5432/fgd_production
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fgd_production
DB_USER=fgd_user
DB_PASSWORD=secure_password_change_me

# Database Pool Settings (optional)
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_POOL_IDLE_TIMEOUT=30000

# =============================================================================
# Redis Configuration
# =============================================================================
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=                # Optional, leave empty if no password
REDIS_DB=0                     # Redis database number (0-15)

# =============================================================================
# Authentication & Security
# =============================================================================
JWT_SECRET=GENERATE_SECURE_RANDOM_STRING_MIN_32_CHARS
JWT_EXPIRES_IN=24h             # Token expiration (e.g., 1h, 7d, 30d)
JWT_ALGORITHM=HS256           # Algorithm: HS256, RS256

# API Keys (change in production!)
ADMIN_API_KEY=change-this-admin-key
LLM_API_KEY=change-this-llm-key

# =============================================================================
# LLM Provider Configuration
# =============================================================================
LLM_PROVIDER=openai           # openai | grok

# OpenAI
OPENAI_API_KEY=sk-your-openai-key-here
OPENAI_API_URL=https://api.openai.com/v1/chat/completions
OPENAI_MODEL=gpt-4            # gpt-4, gpt-3.5-turbo, etc.

# Grok (xAI)
GROK_API_KEY=your-grok-key-here
XAI_API_KEY=your-xai-key-here  # Alternative
GROK_API_URL=https://api.x.ai/v1/chat/completions
XAI_API_URL=https://api.x.ai/v1/chat/completions

# =============================================================================
# Minecraft Server Configuration
# =============================================================================
MINECRAFT_SERVER_HOST=localhost
MINECRAFT_SERVER_PORT=25565

# RCON (Remote Console)
MINECRAFT_RCON_HOST=localhost
MINECRAFT_RCON_PORT=25575
MINECRAFT_RCON_PASSWORD=your-rcon-password

# =============================================================================
# Logging Configuration
# =============================================================================
LOG_LEVEL=info               # error | warn | info | debug | trace
LOG_DIR=./logs
LOG_MAX_FILES=14             # Keep logs for 14 days
LOG_MAX_SIZE=20m             # Rotate when file reaches 20MB

# =============================================================================
# Rate Limiting
# =============================================================================
RATE_LIMIT_WINDOW_MS=60000   # 1 minute window
RATE_LIMIT_MAX_REQUESTS=100  # Max requests per window

# =============================================================================
# Performance Tuning
# =============================================================================
# Optional: Set these if experiencing performance issues
# NODE_OPTIONS=--max-old-space-size=4096  # Max heap size (MB)
# UV_THREADPOOL_SIZE=16                   # Increase for I/O operations
```

---

## DATABASE SETUP

### Initial Setup (First Time Only)

```bash
# 1. Create database
createdb -U postgres fgd_production

# 2. Create user
psql -U postgres -c "CREATE USER fgd_user WITH PASSWORD 'your_password';"

# 3. Grant permissions
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE fgd_production TO fgd_user;"

# 4. Run migrations
psql -U fgd_user -d fgd_production -f migrations/001_initial_schema.sql

# 5. Verify
psql -U fgd_user -d fgd_production -c "SELECT version FROM schema_version;"
```

### Backup Database

```bash
# Full backup
pg_dump -U fgd_user -d fgd_production -F c -f backup_$(date +%Y%m%d_%H%M%S).dump

# SQL format backup
pg_dump -U fgd_user -d fgd_production > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup specific tables
pg_dump -U fgd_user -d fgd_production -t npcs -t tasks > npcs_tasks_backup.sql

# Automated daily backup (add to cron)
0 2 * * * pg_dump -U fgd_user -d fgd_production -F c -f /backups/fgd_$(date +\%Y\%m\%d).dump
```

### Restore Database

```bash
# From custom format dump
pg_restore -U fgd_user -d fgd_production -c backup.dump

# From SQL file
psql -U fgd_user -d fgd_production < backup.sql

# Restore specific tables
pg_restore -U fgd_user -d fgd_production -t npcs -t tasks backup.dump
```

---

## PRODUCTION HARDENING

### 1. Enable HTTPS/TLS

**Option A: Nginx Reverse Proxy (Recommended)**

```bash
# Install Nginx
sudo apt-get install nginx

# Install Certbot for Let's Encrypt
sudo apt-get install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d api.yourdomain.com

# Nginx configuration
sudo nano /etc/nginx/sites-available/fgd-app
```

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    # SSL configuration (managed by certbot)
    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Proxy to FGD app
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/fgd-app /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# Auto-renew certificates
sudo certbot renew --dry-run
```

### 2. Firewall Configuration

```bash
# Using UFW (Ubuntu)
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
# Only if exposing database externally:
# sudo ufw allow from TRUSTED_IP to any port 5432
sudo ufw enable

# Using firewalld (CentOS/RHEL)
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### 3. Secure Environment Variables

**Never commit .env to version control!**

```bash
# Ensure .env is in .gitignore
echo ".env" >> .gitignore
echo ".env.*" >> .gitignore

# Set restrictive permissions
chmod 600 .env
chown fgd:fgd .env

# For production, use a secret manager:
# - AWS Secrets Manager
# - HashiCorp Vault
# - Azure Key Vault
# - Google Cloud Secret Manager
```

### 4. Database Security

```sql
-- Limit database user permissions
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO fgd_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO fgd_user;

-- Enable SSL connections only
-- In postgresql.conf:
-- ssl = on
-- ssl_cert_file = '/path/to/server.crt'
-- ssl_key_file = '/path/to/server.key'
```

### 5. Redis Security

```bash
# Edit redis.conf
sudo nano /etc/redis/redis.conf
```

```conf
# Require password
requirepass YOUR_STRONG_PASSWORD

# Bind to localhost only (if not using remotely)
bind 127.0.0.1

# Disable dangerous commands
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command CONFIG ""
```

---

## MONITORING & MAINTENANCE

### Health Monitoring

```bash
# Check application health
curl http://localhost:3000/api/v1/cluster/health

# Check database
psql -U fgd_user -d fgd_production -c "SELECT 1;"

# Check Redis
redis-cli ping

# Monitor with watch (updates every 2 seconds)
watch -n 2 'curl -s http://localhost:3000/api/v1/cluster/health | jq'
```

### Log Management

```bash
# View application logs (PM2)
pm2 logs fgd-app

# View application logs (systemd)
sudo journalctl -u fgd-app -f

# View application logs (Docker)
docker-compose logs -f app

# Application log files
tail -f logs/app.log
tail -f logs/error.log

# Rotate logs (logrotate)
sudo nano /etc/logrotate.d/fgd-app
```

```conf
/home/fgd/FGD/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 fgd fgd
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

### Performance Monitoring

```bash
# Monitor system resources
htop  # or top

# Monitor Node.js process
pm2 monit

# Database performance
psql -U fgd_user -d fgd_production
```

```sql
-- Show slow queries
SELECT pid, query_start, state, query
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY query_start;

-- Show table sizes
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## TROUBLESHOOTING

### Application Won't Start

**Issue:** `Cannot find module 'express'`
```bash
# Solution: Install dependencies
npm install
```

**Issue:** `EADDRINUSE: address already in use :::3000`
```bash
# Solution: Port 3000 is in use
# Find process using port
sudo lsof -i :3000
# Kill process
sudo kill -9 PID_NUMBER
# Or change PORT in .env
```

**Issue:** `Error: JWT_SECRET must be set`
```bash
# Solution: Set JWT_SECRET in .env
openssl rand -base64 32 >> .env
```

### Database Connection Issues

**Issue:** `ECONNREFUSED 127.0.0.1:5432`
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# If not running, start it
sudo systemctl start postgresql

# Test connection
psql -U fgd_user -d fgd_production -h localhost
```

**Issue:** `password authentication failed`
```bash
# Reset password
sudo -u postgres psql
ALTER USER fgd_user WITH PASSWORD 'new_password';
\q

# Update .env with new password
```

### Redis Connection Issues

**Issue:** `Error: Redis connection failed`
```bash
# Check if Redis is running
sudo systemctl status redis

# Start Redis
sudo systemctl start redis

# Test connection
redis-cli ping
```

### Docker Issues

**Issue:** `Error response from daemon: Conflict`
```bash
# Remove old containers
docker-compose down
docker-compose up -d
```

**Issue:** `no space left on device`
```bash
# Clean up Docker
docker system prune -a --volumes
```

**Issue:** `unhealthy` status
```bash
# Check logs
docker-compose logs app

# Restart service
docker-compose restart app
```

---

## SCALING & HIGH AVAILABILITY

### Horizontal Scaling

**1. Load Balancer Setup (Nginx)**

```nginx
upstream fgd_backend {
    least_conn;  # or ip_hash for sticky sessions
    server 192.168.1.10:3000 weight=3;
    server 192.168.1.11:3000 weight=2;
    server 192.168.1.12:3000 weight=1;
}

server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://fgd_backend;
        # ... other proxy settings ...
    }
}
```

**2. PostgreSQL Replication**

```bash
# Master-Slave replication
# On master server: Enable WAL archiving
# On slave server: Configure recovery settings
# See: https://www.postgresql.org/docs/current/high-availability.html
```

**3. Redis Cluster/Sentinel**

```bash
# Redis Sentinel for automatic failover
# See: https://redis.io/topics/sentinel
```

### Kubernetes Deployment

```yaml
# Example k8s deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: fgd-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: fgd-app
  template:
    metadata:
      labels:
        app: fgd-app
    spec:
      containers:
      - name: fgd-app
        image: fgd-app:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: fgd-secrets
              key: database-url
```

---

## SUPPORT & RESOURCES

- **Documentation:** `./docs/`
- **API Reference:** `/api/docs` (when server running)
- **GitHub Issues:** https://github.com/mikeychann-hash/FGD/issues
- **Architecture Review:** `ARCHITECTURE_REVIEW.md`
- **Risk Analysis:** `RISK_MAP.md`
- **Implementation Plan:** `IMPLEMENTATION_PLAN.md`

---

**End of Deployment Guide**
