# DEVOPS PLAN
**Agent D — DevOps / SRE / Release Engineer**
**Date:** 2025-11-14
**Repository:** FGD - Minecraft NPC Swarm Management System

---

## EXECUTIVE SUMMARY

Agent D has analyzed the infrastructure, build system, deployment process, and operational tooling for the FGD system. This plan provides recommendations for production deployment, CI/CD implementation, monitoring, and operational excellence.

**Current State:** Production-quality code, Docker configuration complete
**Target State:** Fully automated, monitored, and production-ready deployment

**Overall Grade:** 🟢 **B+ (Good Foundation, Needs Automation)**

**Strengths:**
- ✅ Excellent Docker configuration
- ✅ Comprehensive documentation
- ✅ Security best practices
- ✅ Health checks configured

**Gaps:**
- ❌ No CI/CD pipeline
- ❌ No infrastructure as code
- ❌ No monitoring/alerting
- ❌ No automated backups

---

## INFRASTRUCTURE ANALYSIS

### Current Infrastructure State

**Deployment Model:** Docker Compose (single-host)

**Services:**
- **app:** Node.js application (FGD)
- **postgres:** PostgreSQL 15 database
- **redis:** Redis 7 cache
- **minecraft:** Minecraft server (optional)

**Networking:**
- Custom bridge network (fgd-network)
- Isolated subnet (172.20.0.0/16)
- Service discovery by DNS

**Storage:**
- Named volumes (postgres-data, redis-data, minecraft-data)
- Bind mounts (logs, data)

**Resource Management:**
- CPU/memory limits configured
- Resource reservations set

### Infrastructure Readiness Assessment

| Component | Current State | Production Ready? | Action Required |
|-----------|---------------|-------------------|-----------------|
| **Compute** | Single Docker host | ⚠️ Partial | Add HA / Kubernetes |
| **Database** | Single PostgreSQL instance | ❌ No | Add replication |
| **Cache** | Single Redis instance | ❌ No | Add Sentinel/Cluster |
| **Storage** | Local volumes | ⚠️ Partial | Add backup automation |
| **Network** | Bridge network | ✅ Yes | Optional: Add overlay for multi-host |
| **Load Balancer** | None | ❌ No | Add Nginx/HAProxy |
| **TLS/SSL** | Not configured | ❌ No | Add Let's Encrypt |
| **Monitoring** | Health checks only | ❌ No | Add Prometheus + Grafana |
| **Logging** | Basic file logging | ⚠️ Partial | Add centralized logging |
| **Backup** | Manual only | ❌ No | Add automated backups |

---

## CI/CD PIPELINE DESIGN

### GitHub Actions Workflow

**Proposed Pipeline Stages:**

```
1. Code Quality
   ├─ Linting (ESLint)
   ├─ Security Scan (npm audit)
   └─ Dependency Check

2. Testing
   ├─ Unit Tests
   ├─ Integration Tests
   └─ E2E Tests

3. Build
   ├─ Docker Image Build
   ├─ Image Scanning (Trivy)
   └─ Push to Registry

4. Deploy (Staging)
   ├─ Deploy to Staging
   ├─ Smoke Tests
   └─ Integration Validation

5. Deploy (Production)
   ├─ Manual Approval
   ├─ Blue/Green Deployment
   ├─ Health Checks
   └─ Rollback on Failure
```

**See `CI_CD_PIPELINE.yml` for implementation**

---

## DEPLOYMENT STRATEGY

### Single-Host Deployment (Current)

**Pros:**
- Simple setup
- Low cost
- Easy troubleshooting

**Cons:**
- Single point of failure
- Limited scalability
- Manual scaling

**Recommendation:** ✅ Good for development, staging, small-scale production (< 10 bots)

### Multi-Host Deployment (Recommended for Scale)

**Architecture:**
```
                   ┌──────────────┐
                   │ Load Balancer│
                   │  (Nginx)     │
                   └──────┬───────┘
                          │
         ┌────────────────┼────────────────┐
         │                │                │
    ┌────▼────┐      ┌────▼────┐     ┌────▼────┐
    │ App     │      │ App     │     │ App     │
    │ Instance│      │ Instance│     │ Instance│
    │   #1    │      │   #2    │     │   #3    │
    └────┬────┘      └────┬────┘     └────┬────┘
         │                │                │
         └────────────────┼────────────────┘
                          │
              ┌───────────┴──────────┐
              │                      │
         ┌────▼────┐           ┌─────▼────┐
         │PostgreSQL│           │  Redis   │
         │ Primary  │           │ Sentinel │
         │   +      │           │  Cluster │
         │ Replicas │           └──────────┘
         └──────────┘
```

**Components:**
- **Load Balancer:** Nginx or HAProxy for traffic distribution
- **App Instances:** 3+ for high availability
- **PostgreSQL:** Primary + read replicas (streaming replication)
- **Redis:** Sentinel cluster for automatic failover
- **Shared Storage:** NFS or object storage for logs/data

**Recommendation:** For production with > 20 concurrent NPCs

### Kubernetes Deployment (Recommended for Enterprise)

**Benefits:**
- Automatic scaling (HPA)
- Self-healing
- Rolling updates
- Service discovery
- Resource optimization

**Kubernetes Manifest Structure:**
```
k8s/
├── namespace.yaml
├── configmap.yaml
├── secrets.yaml
├── deployments/
│   ├── app-deployment.yaml
│   ├── postgres-statefulset.yaml
│   └── redis-statefulset.yaml
├── services/
│   ├── app-service.yaml
│   ├── postgres-service.yaml
│   └── redis-service.yaml
├── ingress/
│   └── ingress.yaml
├── storage/
│   ├── postgres-pvc.yaml
│   └── redis-pvc.yaml
└── autoscaling/
    └── app-hpa.yaml
```

**Recommendation:** For large-scale production (> 100 NPCs, enterprise deployment)

---

## MONITORING & OBSERVABILITY

### Monitoring Stack Recommendation

**Metrics:** Prometheus + Grafana

**Architecture:**
```
┌──────────────┐
│ FGD App      │──► Expose /metrics endpoint
│              │    (prom-client)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Prometheus   │──► Scrape metrics every 15s
│              │    Store time-series data
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Grafana      │──► Visualize dashboards
│              │    Configure alerts
└──────────────┘
```

**Metrics to Track:**
- **Application:**
  - Request rate (requests/sec)
  - Request duration (p50, p95, p99)
  - Error rate (errors/sec)
  - Active NPC count
  - Task queue depth
  - Task completion rate

- **System:**
  - CPU usage (%)
  - Memory usage (MB)
  - Disk I/O (MB/s)
  - Network I/O (MB/s)

- **Database:**
  - Connection pool usage
  - Query duration
  - Slow query count
  - Transaction rate

- **Business:**
  - NPCs created/destroyed
  - Tasks completed/failed
  - Learning improvement score
  - Policy violations

### Logging Stack Recommendation

**ELK Stack:** Elasticsearch + Logstash + Kibana

**OR**

**Loki Stack:** Promtail + Loki + Grafana

**Log Aggregation Flow:**
```
FGD App
  ├─ stdout/stderr ──► Docker logs
  │                      │
  │                      ▼
  │                  Promtail
  │                      │
  │                      ▼
  │                    Loki
  │                      │
  │                      ▼
  │                   Grafana
  │
  └─ logs/*.log ────► Filebeat ──► Elasticsearch ──► Kibana
```

**Log Levels:**
- **ERROR:** Application errors, exceptions
- **WARN:** Policy violations, resource limits
- **INFO:** Request logging, NPC lifecycle
- **DEBUG:** Detailed execution (development only)

### Tracing Recommendation

**OpenTelemetry + Jaeger**

**Benefits:**
- Distributed request tracing
- Performance bottleneck identification
- Service dependency mapping

**Implementation:**
```javascript
// Instrument Express app
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { registerInstrumentations } = require('@opentelemetry/instrumentation');
const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express');

const provider = new NodeTracerProvider();
provider.register();

registerInstrumentations({
  instrumentations: [new ExpressInstrumentation()],
});
```

---

## BACKUP & DISASTER RECOVERY

### Backup Strategy

**PostgreSQL Backups:**

**Daily Full Backup:**
```bash
#!/bin/bash
# /scripts/backup-postgres.sh

BACKUP_DIR="/backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

# Create backup
docker-compose exec -T postgres pg_dump -U fgd_user -Fc fgd_production > \
  "${BACKUP_DIR}/fgd_${TIMESTAMP}.dump"

# Compress old backups
find "${BACKUP_DIR}" -name "*.dump" -mtime +1 -exec gzip {} \;

# Delete old backups
find "${BACKUP_DIR}" -name "*.dump.gz" -mtime +${RETENTION_DAYS} -delete

# Verify backup
pg_restore --list "${BACKUP_DIR}/fgd_${TIMESTAMP}.dump" > /dev/null && \
  echo "✅ Backup successful: fgd_${TIMESTAMP}.dump" || \
  echo "❌ Backup failed!"
```

**Continuous WAL Archiving (Production):**
```bash
# Enable in postgresql.conf
wal_level = replica
archive_mode = on
archive_command = 'test ! -f /backups/wal/%f && cp %p /backups/wal/%f'
```

**Redis Backups:**

**RDB Snapshots:**
```bash
# Enable in redis.conf
save 900 1        # Save if 1 key changed in 15 minutes
save 300 10       # Save if 10 keys changed in 5 minutes
save 60 10000     # Save if 10000 keys changed in 1 minute
```

**AOF Persistence:**
```bash
# Enable in redis.conf
appendonly yes
appendfsync everysec
```

### Disaster Recovery Plan

**RTO (Recovery Time Objective):** < 1 hour
**RPO (Recovery Point Objective):** < 24 hours

**Recovery Procedures:**

1. **Database Corruption:**
   ```bash
   # Stop app
   docker-compose stop app

   # Restore from backup
   docker-compose exec -T postgres psql -U postgres -c "DROP DATABASE fgd_production;"
   docker-compose exec -T postgres psql -U postgres -c "CREATE DATABASE fgd_production OWNER fgd_user;"
   gunzip < /backups/postgres/latest.dump.gz | \
     docker-compose exec -T postgres pg_restore -U fgd_user -d fgd_production

   # Restart app
   docker-compose start app
   ```

2. **Complete Host Failure:**
   ```bash
   # On new host
   git clone https://github.com/mikeychann-hash/FGD.git
   cd FGD
   cp .env.backup .env

   # Restore data volumes
   docker run --rm -v postgres-data:/data -v /backup:/backup alpine \
     sh -c "cd /data && tar xzf /backup/postgres-data.tar.gz"

   # Start services
   docker-compose up -d
   ```

---

## SECURITY HARDENING

### Production Security Checklist

**Infrastructure Security:**
- [ ] Enable firewall (UFW/firewalld)
- [ ] Configure fail2ban for SSH
- [ ] Disable root SSH login
- [ ] Use SSH keys (disable password auth)
- [ ] Keep system packages updated
- [ ] Enable automatic security updates

**Application Security:**
- [ ] Enable HTTPS (TLS 1.3)
- [ ] Use strong JWT_SECRET (32+ chars)
- [ ] Use strong database passwords
- [ ] Enable Redis password authentication
- [ ] Implement rate limiting
- [ ] Enable audit logging
- [ ] Configure CORS properly
- [ ] Set security headers (Helmet.js)

**Container Security:**
- [ ] Run as non-root user
- [ ] Scan images for vulnerabilities (Trivy)
- [ ] Use minimal base images
- [ ] Keep base images updated
- [ ] No secrets in images
- [ ] Use Docker Secrets (Swarm) or Kubernetes Secrets

**Network Security:**
- [ ] Use private networks for services
- [ ] Expose only necessary ports
- [ ] Use VPN for administrative access
- [ ] Enable database SSL/TLS
- [ ] Use network policies (Kubernetes)

### Security Scanning Tools

**Container Scanning:**
```bash
# Trivy
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image fgd-app:latest

# Clair
docker run -d --name clair -p 6060:6060 quay.io/coreos/clair:latest
```

**Dependency Scanning:**
```bash
# npm audit
npm audit

# Snyk
npm install -g snyk
snyk test
snyk monitor
```

**SAST (Static Application Security Testing):**
```bash
# SonarQube
sonar-scanner \
  -Dsonar.projectKey=fgd-app \
  -Dsonar.sources=. \
  -Dsonar.host.url=http://localhost:9000
```

---

## PERFORMANCE OPTIMIZATION

### Application Performance

**Recommendations:**

1. **Enable Node.js Cluster Mode:**
   ```javascript
   // Use PM2 cluster mode
   pm2 start server.js -i max  // Use all CPU cores
   ```

2. **Implement Caching:**
   ```javascript
   // Cache frequently accessed data in Redis
   const cacheMiddleware = async (req, res, next) => {
     const key = `cache:${req.path}`;
     const cached = await redis.get(key);
     if (cached) return res.json(JSON.parse(cached));
     next();
   };
   ```

3. **Database Connection Pooling:**
   ```javascript
   const pool = new Pool({
     max: 20,  // Maximum connections
     min: 5,   // Minimum connections
     idleTimeoutMillis: 30000,
   });
   ```

4. **Response Compression:**
   ```javascript
   const compression = require('compression');
   app.use(compression());
   ```

### Database Performance

**Recommendations:**

1. **Query Optimization:**
   - Use EXPLAIN ANALYZE for slow queries
   - Add missing indexes
   - Avoid N+1 queries

2. **Connection Pooling:**
   ```sql
   -- postgresql.conf
   max_connections = 100
   shared_buffers = 256MB
   effective_cache_size = 1GB
   work_mem = 10MB
   ```

3. **Vacuum & Analyze:**
   ```bash
   # Run weekly
   docker-compose exec postgres vacuumdb -U fgd_user -d fgd_production -z --analyze
   ```

### Redis Performance

**Recommendations:**

1. **Memory Optimization:**
   ```conf
   # redis.conf
   maxmemory 512mb
   maxmemory-policy allkeys-lru
   ```

2. **Persistence Strategy:**
   ```conf
   # For cache (fast, less durable)
   save ""
   appendonly no

   # For session store (balanced)
   save 300 10
   appendonly yes
   appendfsync everysec
   ```

---

## COST OPTIMIZATION

### Infrastructure Cost Estimation

**AWS (Example):**

| Component | Instance Type | Monthly Cost | Annual Cost |
|-----------|---------------|--------------|-------------|
| Application (3x) | t3.medium | $99 | $1,188 |
| Database (RDS) | db.t3.medium | $104 | $1,248 |
| Redis (ElastiCache) | cache.t3.small | $48 | $576 |
| Load Balancer (ALB) | N/A | $23 | $276 |
| Storage (EBS) | 100 GB | $10 | $120 |
| Data Transfer | 100 GB/mo | $9 | $108 |
| **TOTAL** | | **$293/mo** | **$3,516/yr** |

**Digital Ocean (Example):**

| Component | Droplet Size | Monthly Cost | Annual Cost |
|-----------|---------------|--------------|-------------|
| Application (3x) | 2 GB | $36 | $432 |
| Database | Managed DB 2 GB | $60 | $720 |
| Redis | Managed Redis 1 GB | $30 | $360 |
| Load Balancer | N/A | $12 | $144 |
| Storage | 100 GB | $10 | $120 |
| **TOTAL** | | **$148/mo** | **$1,776/yr** |

**Self-Hosted (Example):**

| Component | Hardware | Monthly Cost | Annual Cost |
|-----------|----------|--------------|-------------|
| Server (1x) | 8 GB RAM, 4 cores | $50 (VPS) | $600 |
| Storage | 200 GB SSD | $5 | $60 |
| Bandwidth | 5 TB | Included | $0 |
| **TOTAL** | | **$55/mo** | **$660/yr** |

**Cost Optimization Strategies:**
1. Use spot instances / preemptible VMs (60-90% savings)
2. Right-size instances based on actual usage
3. Use reserved instances for predictable workloads (30-60% savings)
4. Implement auto-scaling to avoid over-provisioning
5. Use S3/object storage for backups (cheaper than EBS)
6. Clean up unused resources (old snapshots, images)

---

## OPERATIONAL RUNBOOKS

### Runbook: Application Deployment

**Objective:** Deploy new version of FGD application

**Steps:**
1. Tag release: `git tag v2.1.1 && git push --tags`
2. Build image: `docker build -t fgd-app:2.1.1 .`
3. Test locally: `docker run -p 3000:3000 fgd-app:2.1.1`
4. Push to registry: `docker push registry.example.com/fgd-app:2.1.1`
5. Update production: `docker-compose pull && docker-compose up -d`
6. Verify: `curl https://api.example.com/api/v1/cluster/health`
7. Monitor: Check Grafana dashboards for errors

**Rollback:**
```bash
docker-compose down
docker-compose up -d --scale app=0  # Stop new version
docker run -d --name fgd-app-old fgd-app:2.1.0  # Start old version
# Or: docker-compose restart with old image tag
```

### Runbook: Database Scaling

**Objective:** Add read replica for scaling database reads

**Steps:**
1. Enable WAL archiving on primary
2. Create base backup: `pg_basebackup -h primary -U replicator -Fp -Xs -P -R -D /var/lib/postgresql/data`
3. Configure replica: Edit `recovery.conf`
4. Start replica: `docker-compose up -d postgres-replica`
5. Verify replication: `SELECT * FROM pg_stat_replication;`
6. Update app to use replica for read queries

### Runbook: Emergency Shutdown

**Objective:** Gracefully stop all services during emergency

**Steps:**
```bash
# 1. Stop accepting new requests (update load balancer)
# 2. Drain existing connections (wait 30-60 seconds)
# 3. Stop application
docker-compose stop app

# 4. Stop Minecraft server (if running)
docker-compose stop minecraft

# 5. Stop databases (ensures clean shutdown)
docker-compose stop postgres redis

# 6. Verify all stopped
docker-compose ps
```

---

## RECOMMENDATIONS SUMMARY

### Immediate (P0)

1. ✅ **Completed:** Docker configuration
2. ✅ **Completed:** Health checks
3. ⏳ **TODO:** Implement CI/CD pipeline
4. ⏳ **TODO:** Set up monitoring (Prometheus + Grafana)
5. ⏳ **TODO:** Configure automated backups

### Short-Term (P1)

6. ⏳ **TODO:** Implement database replication
7. ⏳ **TODO:** Set up Redis Sentinel
8. ⏳ **TODO:** Configure HTTPS (Let's Encrypt)
9. ⏳ **TODO:** Implement centralized logging
10. ⏳ **TODO:** Create infrastructure as code (Terraform)

### Long-Term (P2)

11. ⏳ **TODO:** Migrate to Kubernetes
12. ⏳ **TODO:** Implement auto-scaling
13. ⏳ **TODO:** Set up distributed tracing
14. ⏳ **TODO:** Implement chaos engineering tests
15. ⏳ **TODO:** Multi-region deployment

---

## CONCLUSION

The FGD system has an **excellent foundation** for production deployment with well-architected Docker configuration. The primary gaps are in **automation** (CI/CD, backups) and **observability** (monitoring, logging).

**DevOps Grade:** 🟢 **B+ (Good Foundation)**

**Production Readiness:**
- ✅ Code quality: Excellent
- ✅ Container configuration: Excellent
- ✅ Documentation: Comprehensive
- ⚠️ Automation: Needs CI/CD
- ⚠️ Monitoring: Needs implementation
- ⚠️ High availability: Needs replication

**Estimated Time to Production-Ready:**
- With single-host: 4-8 hours (add monitoring, backups, HTTPS)
- With HA setup: 2-3 days (add replication, load balancing, CI/CD)
- With Kubernetes: 1-2 weeks (full migration, testing, documentation)

---

**Agent D Sign-Off:** Infrastructure analysis complete. System ready for deployment with recommended improvements.

**Date:** 2025-11-14
**Agent:** D (DevOps / SRE / Release Engineer)
