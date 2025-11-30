# 🤖 FGD Agent System Documentation

## Overview

The **AICraft Federation Governance Dashboard (FGD)** is an enterprise-grade autonomous agent orchestration platform for Minecraft NPC swarms. This document defines the agent roles, responsibilities, and integration points for the Codex CLI automation system.

FGD leverages a **hybrid agent architecture** combining:
- **Centralized AI Governance** (LLM-driven decision making)
- **Embodied Bot Awareness** (real-time world state tracking)
- **Microcore Autonomy** (local reactive behavior loops)
- **Persistent Learning** (skill progression, outcome knowledge)
- **Policy Enforcement** (autonomic self-healing, resource governance)

**Total System Scope:** 15,000+ lines of Node.js, 40+ task executors, 6 progression phases, multi-LLM integration, PostgreSQL/Redis persistence.

---

## Agent Roles & Responsibilities

| Agent Type | Primary Role | Key Modules | Codex CLI Command Prefix |
|-----------|---------------|-------------|-------------------------|
| **Backend Agent** | Server logic, API orchestration, NPC lifecycle, database | `server.js`, `npc_engine.js`, `src/services/*` | `/backend` |
| **Frontend Agent** | UI/Dashboard, WebSocket streaming, admin console | `admin.js`, `dashboard.js`, `fusion.js` | `/frontend` |
| **Mineflayer Agent** | Minecraft connection, bot control, game integration | `minecraft_bridge.js`, `adapters/mineflayer/*` | `/mineflayer` |
| **LLM Agent** | Natural language processing, AI decision-making, autonomous planning | `llm_bridge.js`, `model_director.js`, `learning_engine.js` | `/llm` |
| **Policy Agent** | Governance enforcement, resource management, self-healing | `policy_engine.js`, `autonomic_core.js` | `/policy` |
| **QA Agent** | Testing, validation, debugging, error detection | `test/`, `jest.config.js` | `/qa` |
| **Documentation Agent** | Code documentation, README updates, architecture guides | `docs/`, `*.md` files | `/docs` |

---

## Detailed Agent Definitions

### 1. Backend Agent

**Purpose:** Core business logic orchestration, NPC lifecycle management, REST/WebSocket API

**Key Responsibilities:**
- Initialize and manage NPC engine (`npc_engine.js`, `src/services/npc_initializer.js`)
- Handle task dispatch, queue management, execution lifecycle
- Manage NPC registry, profiles, and learning data (`npc_registry.js`, `npc_spawner.js`)
- Execute REST API routes (`src/api/*.js`, `routes/*.js`)
- Stream telemetry and metrics to connected clients
- Persist state to file/database systems

**Core Files:**
```
server.js                           # Express/Socket.IO entry point
npc_engine.js                       # NPC orchestration core (1000+ lines)
src/services/
  ├─ npc_initializer.js            # System startup
  ├─ state.js                       # SystemStateManager
  ├─ data.js                        # File-based persistence
  ├─ telemetry.js                   # Metrics pipeline
  └─ mineflayer_initializer.js      # Mineflayer bridge setup
src/api/
  ├─ cluster.js                     # Cluster status endpoints
  ├─ npcs.js                        # NPC CRUD endpoints
  └─ progression.js                 # Learning stats endpoints
routes/
  ├─ bot.js                         # Bot management API
  └─ llm.js                         # LLM command endpoints
```

**When to Act Autonomously:**
- Task queue backpressure detected → redistribute load
- NPC spawn/despawn → update registry and notify clients
- Learning event triggered → update skill profiles
- Health check failing → trigger autonomic healing

**Configuration Files:**
- `.env` – Environment variables (LLM keys, DB credentials)
- `governance_config.json` – Policy rules, thresholds
- `fgd_config.yaml` – LLM provider defaults, memory settings

---

### 2. Frontend Agent

**Purpose:** Web UI, real-time client updates, admin console

**Key Responsibilities:**
- Render admin panel (`admin.html` + `admin.js`)
- Render cluster dashboard (`dashboard.html` + `dashboard.js`)
- Display fusion memory inspector (`fusion.html` + `fusion.js`)
- Handle WebSocket event streaming from backend
- Display live bot positions, health, inventory, tasks
- Execute admin commands through REST API
- Handle authentication (JWT tokens, login flows)

**Core Files:**
```
admin.html / admin.js               # Admin panel UI (web-based console)
dashboard.html / dashboard.js       # Real-time cluster metrics dashboard
fusion.html / fusion.js             # Fusion memory inspector UI
style.css                           # Global styles
theme.js                            # Theme management
middleware/auth.js                  # JWT authentication logic
```

**WebSocket Events Monitored:**
```
bot:spawned                         # New bot appeared
bot:moved                           # Position updated
bot:task_complete                   # Task finished
bot:health_changed                  # Health updated
bot:error                           # Error occurred
system:log                          # System events
cluster:updated                     # Cluster state changed
```

**When to Act Autonomously:**
- Connection lost → attempt auto-reconnect
- WebSocket message timeout → display warning
- New metrics received → update dashboard charts
- User authentication expires → prompt re-login

---

### 3. Mineflayer Agent

**Purpose:** Minecraft game integration, bot control, world interaction

**Key Responsibilities:**
- Create/destroy bot connections (`mineflayer_bridge.js`)
- Manage Mineflayer plugins (pathfinder, auto-eat, PVP, collectblock)
- Handle movement, pathfinding, block breaking
- Scan world state (blocks, entities, players)
- Translate NPC commands → Mineflayer API calls
- Stream bot state updates (position, health, inventory)
- Handle game events (death, damage, inventory change)

**Core Files:**
```
minecraft_bridge.js                 # Primary RCON/Mineflayer bridge (600+ lines)
minecraft_bridge_mineflayer.js      # Extended Mineflayer-specific logic
adapters/mineflayer/
  ├─ mineflayer_bridge.js           # Mineflayer wrapper
  ├─ movement.js                    # Pathfinding, navigation
  ├─ interaction.js                 # Block breaking, crafting
  ├─ inventory.js                   # Item management
  ├─ world_observer.js              # Block/entity scanning
  └─ autonomy_loop.js               # Local micro-brain tick loop
src/services/
  └─ mineflayer_initializer.js      # Startup and connection pooling
```

**Minecraft Server Requirements:**
- Minecraft version: 1.20.1 (configurable)
- Server type: Paper/Spigot with FGDProxyPlayer plugin
- RCON enabled for command execution
- WebSocket bridge for real-time data sync

**When to Act Autonomously:**
- Bot dies → respawn with learned behavior
- Pathfinding blocked → find alternate route
- Tool breaks → switch to next available tool
- Inventory full → discard or deposit items
- Player approaches → alert and adjust behavior

**Configuration:**
```javascript
MINECRAFT_HOST=localhost
MINECRAFT_PORT=25565
MINECRAFT_VERSION=1.20.1
MINECRAFT_USERNAME_PREFIX=bot_
```

---

### 4. LLM Agent

**Purpose:** AI decision-making, natural language processing, autonomous planning

**Key Responsibilities:**
- Translate natural language commands → task objects
- Generate autonomous task recommendations (every 10s)
- Evaluate task success/failure and adjust behavior
- Execute multi-step reasoning chains
- Interface with multiple LLM providers (OpenAI, Grok, Local)
- Handle retry logic and fallback providers
- Track prompt costs and API performance

**Core Files:**
```
llm_bridge.js                       # Multi-provider LLM API (235+ lines)
  ├─ resolveProvider()              # Provider selection logic
  ├─ buildPayload()                 # Request formatting
  └─ queryLLM()                     # API call with retry
model_director.js                   # Prompt engineering, task generation
interpreter.js                      # Command interpretation
learning_engine.js                  # Outcome tracking, behavior adaptation
routes/llm.js                       # LLM command API endpoints
llm_prompts/                        # Prompt templates directory
```

**Supported LLM Providers:**
```
Provider    | Default Model      | Config Env
------------|-------------------|------------------
OpenAI      | gpt-4o-mini       | OPENAI_API_KEY
Grok (xAI)  | grok-beta         | GROK_API_KEY
Local Mock  | fgd-local         | (no API key)
Ollama      | llama3 (local)    | (local service)
```

**Autonomous Task Generation Cycle:**
```
1. Every 10 seconds (configurable)
2. Collect current bot state (position, inventory, health)
3. Build context prompt with recent history
4. Query LLM for task recommendations
5. Validate task schema (task_schema.js)
6. Add to NPC task queue
7. Dispatch to next available bot
```

**When to Act Autonomously:**
- NPC idle for >10s → generate next task
- Task fails → analyze failure and suggest retry/alternative
- Player nearby → recommend defensive/stealth behavior
- Resource low → suggest gathering or defensive tasks
- Progress milestone reached → adjust task difficulty

**Configuration:**
```javascript
LLM_PROVIDER=openai                 # Default provider
OPENAI_API_KEY=sk-...               # OpenAI key
GROK_API_KEY=...                    # Grok key
LLM_AUTONOMY_INTERVAL=10000         # ms between autonomous checks
LLM_MAX_RETRIES=2                   # API retry attempts
LLM_TEMPERATURE=0.7                 # Sampling temperature
LLM_MAX_TOKENS=500                  # Response token limit
```

---

### 5. Policy Agent

**Purpose:** Governance enforcement, resource management, self-healing autonomic behavior

**Key Responsibilities:**
- Monitor system health (CPU, memory, disk, uptime)
- Enforce resource limits (max bots, max tasks, memory thresholds)
- Implement circuit breaker patterns (failure recovery)
- Trigger automatic healing when thresholds breached
- Adjust NPC spawn/despawn based on available resources
- Log policy decisions and audit trail
- Adapt policies based on phase progression

**Core Files:**
```
policy_engine.js                    # Policy enforcement (370+ lines)
  ├─ enforcePolicy()                # Rule evaluation
  ├─ healFailure()                  # Auto-recovery
  └─ adjustForPhase()               # Phase-aware policies
autonomic_core.js                   # Self-monitoring system (450+ lines)
  ├─ startMonitoring()              # Health scan loop
  ├─ detectFailure()                # Failure patterns
  └─ executeHealing()               # Recovery procedures
security/governance_validator.js    # Policy schema validation
adapters/mineflayer/
  └─ minimal_policy_config.js       # Lightweight policy rules
```

**Policy Thresholds:**
```javascript
{
  cpuThreshold: 0.85,               // 85% CPU usage
  memThreshold: 0.85,               // 85% memory usage
  diskThreshold: 0.90,              // 90% disk usage
  maxConcurrentBots: 8,
  maxTaskQueueSize: 500,
  scanInterval: 10000,              // ms between health checks
  healingRetries: 5
}
```

**When to Act Autonomously:**
- CPU >85% → despawn idle bots, reduce autonomy frequency
- Memory >85% → flush caches, archive old logs
- Disk >90% → trigger cleanup procedures
- Task queue size >500 → apply backpressure, retry later
- Circuit breaker open → stop new operations, wait for recovery
- 5 consecutive failures → escalate to manual intervention alert

**Governance Rules:**
```javascript
ENFORCE_SPAWN_LIMITS()              // Max 8 concurrent bots
ENFORCE_TASK_RATE_LIMITING()        // Rate limits per phase
ENFORCE_RESOURCE_QUOTAS()           // Memory, CPU, disk
ENFORCE_FAILURE_RECOVERY()          // Auto-heal on errors
LOG_POLICY_DECISIONS()              // Audit trail
ADAPT_FOR_PHASE()                   // Phase-aware rules
```

---

### 6. QA Agent

**Purpose:** Testing, validation, debugging, error detection

**Key Responsibilities:**
- Execute unit tests (`test/`, `jest.config.js`)
- Validate task schema compliance
- Verify NPC state integrity
- Debug bot behavior and task execution
- Monitor error logs and failure rates
- Generate test reports
- Regression testing on code changes

**Core Files:**
```
jest.config.js                      # Jest test configuration
test/                               # Test suite directory
  ├─ *_test.js                      # Unit tests
  ├─ integration/                   # Integration tests
  └─ fixtures/                      # Test data
validator.js                        # NPC state validation
task_schema.js                      # Task object validation
task_schema.json                    # JSON schema definition
```

**Test Categories:**
```
1. Unit Tests
   - npc_engine.test.js
   - llm_bridge.test.js
   - learning_engine.test.js

2. Integration Tests
   - bot_lifecycle.integration.js
   - mineflayer_bridge.integration.js

3. Schema Validation Tests
   - npc_profile_schema.test.js
   - task_schema.test.js
   - governance_config.test.js
```

**When to Act Autonomously:**
- Code change detected → run affected tests
- Error rate spike → pause new task dispatch
- Schema validation failure → block invalid NPC creation
- Test failure → generate debug report
- Performance regression detected → alert backend agent

**Test Commands:**
```bash
npm test                            # Run all tests
npm test -- --coverage              # With coverage report
npm test -- --watch                 # Watch mode
npm test -- --testNamePattern=NPC   # Filter by name
```

---

### 7. Documentation Agent

**Purpose:** Code documentation, README updates, architecture guides, knowledge base

**Key Responsibilities:**
- Generate/update architecture documentation
- Document API endpoints and usage examples
- Maintain quick-start guides
- Track feature roadmaps and phases
- Update configuration file documentation
- Generate code comment templates
- Build integration guides (adapters, plugins)

**Core Files:**
```
docs/                               # Documentation directory
  ├─ API.md                         # REST API reference
  ├─ ARCHITECTURE.md                # System architecture
  ├─ QUICKSTART.md                  # Quick-start guide
  └─ TROUBLESHOOTING.md             # Debugging guide
README.md                           # Main project README
CODEBASE_STRUCTURE.md               # Detailed file structure
README_HYBRID_BOTS.md               # Hybrid bot architecture
HYBRID_BOTS_SETUP.md                # Setup instructions
PHASE_INTEGRATION_SUMMARY.md        # Phase progression docs
NPC_SYSTEM_README.md                # NPC lifecycle docs
PAPER_GEYSER_SETUP.md               # Minecraft server setup
ADMIN_PANEL_INTEGRATION.md          # Admin UI guide
```

**Documentation Templates:**
```
## Module Purpose
Brief description of what this module does.

## Key Functions
- function1() – What it does, return type
- function2() – What it does, return type

## Example Usage
```javascript
// Code example here
```

## Configuration
- ENV_VAR – Description (default: value)
- ENV_VAR2 – Description (default: value)

## See Also
- Related module links
```

**When to Act Autonomously:**
- New module added → generate stub documentation
- API endpoint added → document endpoint and examples
- Configuration changed → update ENV documentation
- Feature completed → write implementation summary
- Test coverage changes → update metrics in docs

**Documentation Commands:**
```bash
npm run docs:generate               # Generate API docs
npm run docs:validate               # Validate markdown
npm run docs:build                  # Build HTML docs
```

---

## Context Awareness & File Interpretation

### Supported File Types

#### JavaScript Modules (`.js`)
**Interpretation Rules:**
- Entry points: `server.js`, `index.js` → main initialization logic
- Service files (`src/services/*.js`) → business logic, stateful
- Route files (`src/api/*.js`, `routes/*.js`) → API endpoint definitions
- Utility files (`src/utils/*.js`) → pure functions, helpers
- Module exports: Look for `export` or `module.exports` statements

**Example Context:**
```javascript
// File: src/services/npc_initializer.js
export class NPCSystem {
  constructor() {
    this.npcEngine = new NPCEngine();
    this.mineflayerBridge = new MineflayerBridge();
  }
}
// Backend agent should instantiate NPCSystem on startup
```

#### Configuration Files (`.json`, `.jsonc`, `.yaml`)
**Interpretation Rules:**
- `package.json` → project metadata, scripts, dependencies
- `governance_config.json` → policy engine rules
- `cluster_config.json` → cluster-mode settings
- `npc_profile.schema.json` → NPC data validation schema
- `fgd_config.yaml` → FGD-specific config (LLM providers, memory)

**Example Context:**
```json
{
  "cpuThreshold": 0.85,
  "memThreshold": 0.85,
  "scanInterval": 10000
}
// Policy agent should read these thresholds on startup
```

#### Environment Variables (`.env`)
**Key Variables:**
```
MINECRAFT_HOST=localhost
MINECRAFT_PORT=25565
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
JWT_SECRET=...
DATABASE_URL=postgres://...
REDIS_URL=redis://...
```

#### Markdown Documentation (`.md`)
**Interpretation Rules:**
- `README.md` → project overview, quick start
- `ARCHITECTURE.md` → system design patterns
- `SETUP.md` files → step-by-step guides
- Phase files (`*_PHASE*.md`) → progression milestones

---

## Agent Collaboration Patterns

### Pattern 1: Task Dispatch Pipeline
```
User/LLM Agent
    ↓
Backend Agent (validate task)
    ↓
Mineflayer Agent (check availability)
    ↓
Policy Agent (enforce resource limits)
    ↓
Mineflayer Agent (execute command)
    ↓
Frontend Agent (broadcast result)
```

### Pattern 2: Error Recovery
```
Mineflayer Agent detects failure
    ↓
Backend Agent logs error
    ↓
Policy Agent triggers healing
    ↓
LLM Agent analyzes cause
    ↓
Backend Agent retries with adjusted parameters
    ↓
Frontend Agent notifies user
```

### Pattern 3: Autonomous Learning Loop
```
Mineflayer Agent completes task
    ↓
Backend Agent records outcome
    ↓
Learning Engine updates profiles
    ↓
LLM Agent adjusts future recommendations
    ↓
Frontend Agent shows progress
    ↓
Policy Agent may trigger phase advancement
```

### Pattern 4: Health Monitoring
```
Policy Agent scans system every 10s
    ↓
Detects threshold breach
    ↓
Triggers healing procedure
    ↓
Backend Agent may despawn bots
    ↓
Policy Agent logs decision
    ↓
Frontend Agent shows warnings
```

---

## Codex CLI Integration Examples

### Backend Agent Commands

```bash
# Initialize NPC system
codex /backend init

# Spawn new NPC with role
codex /backend spawn --role miner --count 3

# Check system health
codex /backend health

# View task queue
codex /backend tasks --show-queue

# Trigger learning update
codex /backend learning:update

# Export bot profiles
codex /backend export --format json --output ./bots.json
```

### Frontend Agent Commands

```bash
# Start dashboard server
codex /frontend start --port 3000

# Open admin panel
codex /frontend open:admin

# Broadcast WebSocket message
codex /frontend ws:emit --event "bot:moved" --data "{...}"

# Take dashboard screenshot
codex /frontend screenshot --output ./dashboard.png
```

### Mineflayer Agent Commands

```bash
# Connect to Minecraft server
codex /mineflayer connect --host localhost --port 25565

# List active bots
codex /mineflayer bots --list

# Move bot to position
codex /mineflayer bot:move --id bot_01 --x 100 --y 64 --z -200

# Scan world around bot
codex /mineflayer bot:scan --id bot_01 --radius 16

# Execute game command
codex /mineflayer bot:command --id bot_01 --cmd "chat Hello"
```

### LLM Agent Commands

```bash
# Generate autonomous tasks
codex /llm generate --count 5

# Test LLM provider
codex /llm test:provider --provider openai

# Query LLM directly
codex /llm query --prompt "What should this bot do next?"

# View LLM costs
codex /llm costs:report

# Switch provider
codex /llm provider:switch --to grok
```

### Policy Agent Commands

```bash
# Check policy compliance
codex /policy check --strict

# View health metrics
codex /policy metrics --show-history

# Trigger healing
codex /policy heal --force

# Update policy rules
codex /policy rules:update --file governance_config.json

# View audit log
codex /policy audit:log --limit 50
```

### QA Agent Commands

```bash
# Run all tests
codex /qa test:all

# Run tests with coverage
codex /qa test:coverage

# Validate schemas
codex /qa validate:schemas

# Debug bot behavior
codex /qa debug:bot --id bot_01 --trace-tasks

# Generate test report
codex /qa report:generate --output test_report.html
```

### Documentation Agent Commands

```bash
# Generate API docs
codex /docs generate:api

# Update quick-start guide
codex /docs update:quickstart

# Validate markdown
codex /docs validate:markdown

# Generate architecture diagram
codex /docs generate:diagram --type architecture

# Build documentation site
codex /docs build:site --output ./docs_build
```

---

## Expansion Hooks

### Future Agent Types

#### 1. **Database Agent**
- Manage PostgreSQL/Redis operations
- Optimize queries, handle migrations
- Archive old data, manage backups
- Monitor database health

#### 2. **Monitoring Agent**
- Aggregate Prometheus metrics
- Generate performance reports
- Set up alerting rules
- Create dashboards

#### 3. **Deployment Agent**
- Handle containerization (Docker)
- Manage cloud deployments (AWS, GCP)
- Execute CI/CD pipelines
- Rollback failed deployments

#### 4. **Plugin Agent**
- Manage Minecraft plugin updates
- Handle mod integrations
- Generate plugin documentation
- Test plugin compatibility

#### 5. **Analytics Agent**
- Track bot performance metrics
- Analyze learning curves
- Generate insights reports
- Predict progression timelines

### Skill Integration Hooks

**Each agent can integrate specialized skills:**

```javascript
// Example: LLM Agent with new skill
llmAgent.registerSkill('complex-planning', {
  description: 'Multi-step task planning',
  provider: 'openai',
  modelOverride: 'gpt-4o',
  contextWindow: 8000,
  costPerK: 0.03
});

// Example: Policy Agent with new rule
policyAgent.registerRule('adaptive-phase', {
  trigger: 'progress-milestone-reached',
  action: 'advance-phase',
  parameters: { minXP: 1000 }
});
```

### External API Integrations

```javascript
// Hook for Discord bot notifications
registerExternalAPI('discord', {
  webhookUrl: process.env.DISCORD_WEBHOOK,
  events: ['bot:error', 'task:complete', 'policy:heal']
});

// Hook for Slack notifications
registerExternalAPI('slack', {
  botToken: process.env.SLACK_BOT_TOKEN,
  channel: '#minecraft-bots'
});

// Hook for metrics export (Grafana, DataDog)
registerExternalAPI('grafana', {
  apiUrl: 'http://localhost:3000',
  dashboardId: 1,
  metrics: ['bot_count', 'task_queue_size', 'error_rate']
});
```

---

## Agent Communication Protocol

### Message Format

All inter-agent communication follows this format:

```javascript
{
  fromAgent: 'backend',
  toAgent: 'mineflayer',
  type: 'command',          // 'command', 'event', 'query', 'response'
  action: 'spawn_bot',
  timestamp: 1699632000000,
  requestId: 'req_abc123',
  payload: {
    botName: 'bot_01',
    role: 'miner',
    position: { x: 0, y: 64, z: 0 }
  },
  priority: 'high',         // 'critical', 'high', 'medium', 'low'
  timeout: 30000            // ms
}
```

### Response Format

```javascript
{
  type: 'response',
  requestId: 'req_abc123',
  status: 'success',        // 'success', 'error', 'timeout'
  timestamp: 1699632001000,
  data: {
    botId: 'bot_abc123',
    position: { x: 0, y: 64, z: 0 },
    status: 'spawned'
  },
  error: null
}
```

---

## Performance & Scaling Guidelines

### Agent Performance Targets

| Agent | Operation | Target Latency | Throughput |
|-------|-----------|-----------------|-----------|
| Backend | Task dispatch | <50ms | 1000 tasks/sec |
| Frontend | WebSocket push | <100ms | 100 updates/sec |
| Mineflayer | Bot movement | 200-500ms | 8 concurrent bots |
| LLM | Task generation | 2-5s | 10 decisions/sec |
| Policy | Health scan | <1s | 1 scan/10s |
| QA | Test run | <10s | 100 tests/run |

### Scaling Recommendations

```
Single Server:
- Max 8 concurrent bots
- Max 500 NPC profiles
- Max 100 WebSocket connections

Multi-Server (Redis + PostgreSQL):
- Max 64+ concurrent bots (8 per server)
- Max 10,000 NPC profiles
- Max 1000+ WebSocket connections

Cloud Deployment (Kubernetes):
- Auto-scale agents based on metrics
- Distribute agents across nodes
- Use Redis for inter-agent messaging
- Use PostgreSQL for shared state
```

---

## Debugging & Troubleshooting

### Enable Debug Logging

```bash
# Backend agent debug
DEBUG=fgd:backend node server.js

# Mineflayer agent debug
DEBUG=fgd:mineflayer node server.js

# LLM agent debug
DEBUG=fgd:llm node server.js

# All agents debug
DEBUG=fgd:* node server.js
```

### Common Issues & Fixes

| Issue | Root Cause | Solution |
|-------|-----------|----------|
| Bot won't spawn | Minecraft server unreachable | Check MINECRAFT_HOST, MINECRAFT_PORT |
| Tasks stuck in queue | Mineflayer agent offline | Verify Mineflayer bridge connection |
| LLM queries fail | API key invalid | Check OPENAI_API_KEY, GROK_API_KEY |
| High CPU usage | Autonomy loop too frequent | Increase LLM_AUTONOMY_INTERVAL |
| Memory leak | Old logs accumulating | Enable log rotation, reduce verbosity |

### Log Locations

```
logs/
  ├─ backend.log        # Backend agent logs
  ├─ mineflayer.log     # Mineflayer agent logs
  ├─ llm.log            # LLM agent logs
  ├─ policy.log         # Policy agent logs
  └─ error.log          # All errors
```

---

## Conclusion

The FGD agent system provides a flexible, extensible framework for autonomous Minecraft NPC swarms. Each agent has clear responsibilities, defined communication protocols, and expansion hooks for future enhancements.

**Key Principles:**
1. **Single Responsibility** – Each agent owns one domain
2. **Event-Driven** – Agents communicate via messages, not direct calls
3. **Autonomous** – Agents can make decisions without user intervention
4. **Resilient** – Built-in error handling, self-healing, fallbacks
5. **Observable** – Full logging, metrics, audit trails
6. **Scalable** – Designed for single-server and distributed deployments

**Getting Started:**
1. Review the README.md and QUICK_TECH_SUMMARY.md
2. Run `npm install` to set up dependencies
3. Configure `.env` with your Minecraft and LLM details
4. Start the backend: `npm start`
5. Open http://localhost:3000/admin.html
6. Use Codex CLI commands to interact with agents

For detailed integration guides, see the `docs/` directory and individual README files in each module.
