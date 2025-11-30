# 🧠 AICraft Federation Governance Dashboard (FGD)

**Version:** 2.1.0
**Status:** Production-Ready (after security fixes)
**License:** MIT

> A full-stack control plane for managing AI-driven autonomous bots in Minecraft environments with real-time monitoring, LLM integration, and adaptive learning.

[![Node.js CI](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/docker-ready-blue)](https://www.docker.com/)
[![PostgreSQL](https://img.shields.io/badge/postgresql-required-blue)](https://www.postgresql.org/)

---

## 🎯 What is FGD?

The AICraft Federation Governance Dashboard orchestrates Minecraft-based NPC swarms with **hybrid bot architecture**, combining:

- **Embodied AI** – Bots physically exist in Minecraft with real-time movement and world awareness
- **Centralized Intelligence** – LLM-powered decision making with persistent learning
- **Adaptive Governance** – Policy-driven resource management and behavior control
- **Real-time Monitoring** – Live dashboards for cluster metrics, bot status, and system health

---

## ✨ Key Features

### 🤖 Intelligent Bot Management
- **Hybrid Architecture** – Combines Mineflayer-style embodiment with centralized AI governance
- **Multiple Roles** – Miner, Builder, Scout, Guard, Gatherer with role-specific behaviors
- **Personality System** – 7 personality traits (Curiosity, Patience, Motivation, Empathy, Aggression, Creativity, Loyalty)
- **Adaptive Learning** – Persistent profiles with skill progression and outcome knowledge

### 🎮 Real Minecraft Integration
- **FGDProxyPlayer Plugin** – Custom Paper/Spigot plugin for entity spawning
- **WebSocket Bridge** – Bidirectional real-time communication with Minecraft server
- **Environmental Scanning** – Bots perceive actual world data (blocks, entities, players)
- **RCON Support** – Optional RCON integration for server management

### 🧠 LLM Command Surface
- **Natural Language Control** – Translate plain English to bot actions
- **Multiple Providers** – OpenAI (GPT-4), Grok/xAI support
- **Batch Commands** – Execute multiple commands in parallel
- **Context-Aware** – LLM understands bot capabilities and Minecraft context

### 📊 Phase Progression System
- **Six-Phase System** – From early survival to post-dragon content
- **Automatic Advancement** – Phase transitions based on progression metrics
- **Phase-Aware Behaviors** – Bots adapt to current phase requirements
- **Sustainable Progression** – Resource-efficient advancement strategy

### 🏛️ Autonomic Governance
- **Policy Engine** – Adaptive policy adjustment based on cluster state
- **Self-Healing** – Automatic recovery from policy violations
- **Resource Management** – Dynamic allocation based on load
- **Dead Letter Queue** – Fault-tolerant task processing

### 📡 Real-time Dashboards
- **Main Dashboard** – Cluster health, metrics, and performance visualization
- **Admin Panel** – Bot lifecycle management and command execution
- **Fusion Memory View** – Knowledge base inspection and analytics
- **WebSocket Updates** – Live data streaming with replay buffer

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                  🌐 Web Dashboards                          │
│  Dashboard (/) | Admin Panel (/admin) | Fusion View        │
└────────────────┬────────────────────────────────────────────┘
                 │ HTTP/WebSocket
                 ▼
┌─────────────────────────────────────────────────────────────┐
│             🔧 Express.js + Socket.IO Backend               │
│  - REST API (82 endpoints)                                  │
│  - WebSocket Event Handlers                                 │
│  - JWT + API Key Authentication                             │
│  - Rate Limiting & Validation                               │
└────────────────┬────────────────────────────────────────────┘
                 │
      ┌──────────┼──────────┐
      ▼          ▼          ▼
┌──────────┐ ┌──────────┐ ┌──────────────────┐
│PostgreSQL│ │  Redis   │ │ LLM Providers    │
│ Database │ │  Cache   │ │ OpenAI / Grok    │
└──────────┘ └──────────┘ └──────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│        🎮 Minecraft Integration Layer                       │
│  - WebSocket Bridge (minecraft_bridge.js)                   │
│  - FGDProxyPlayer Plugin (Java - Paper/Spigot)              │
│  - RCON Connection (optional)                               │
└─────────────────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│        🏰 Minecraft Server (Paper/Geyser)                   │
│  - Autonomous NPC Entities                                  │
│  - Real-world Physics & Interactions                        │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

**Backend:**
- Node.js 18+ (ES Modules)
- Express.js 4.19.0
- Socket.IO 4.6.1
- PostgreSQL 8.11.3 (via pg library)
- Redis 4.6.10
- JWT Authentication

**Frontend:**
- Vanilla JavaScript (no framework)
- Chart.js (visualizations)
- CSS Custom Properties (theming)
- WebSocket Client (real-time updates)

**Infrastructure:**
- Docker multi-stage build
- GitHub Actions CI/CD
- Nginx reverse proxy (production)

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| **[REVIEW_REPORT.md](REVIEW_REPORT.md)** | Comprehensive end-to-end codebase analysis |
| **[TODO.md](TODO.md)** | Prioritized action items (P0/P1/P2) |
| **[DIRECTORY_RESTRUCTURE.md](DIRECTORY_RESTRUCTURE.md)** | Recommended directory organization |
| **[README_HYBRID_BOTS.md](README_HYBRID_BOTS.md)** | Hybrid bot architecture details |
| **[HYBRID_BOTS_SETUP.md](HYBRID_BOTS_SETUP.md)** | Setup guide for Minecraft integration |
| **[PAPER_GEYSER_SETUP.md](PAPER_GEYSER_SETUP.md)** | Minecraft server configuration |
| **[NPC_SYSTEM_README.md](NPC_SYSTEM_README.md)** | NPC lifecycle documentation |
| **[PHASE_INTEGRATION_SUMMARY.md](PHASE_INTEGRATION_SUMMARY.md)** | Phase progression API documentation |
| **.env.example.ENHANCED** | Enhanced environment configuration guide |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ or 20+ (LTS)
- **PostgreSQL** 12+
- **Redis** 6+ (optional but recommended)
- **Minecraft Server** with Paper/Spigot (for bot spawning)
- **LLM API Key** (OpenAI or Grok)

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/FGD.git
cd FGD
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env.ENHANCED .env
# Edit .env with your configuration
```

**Required Environment Variables:**
```env
# Server
PORT=3000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fgd_aicraft
DB_USER=your_db_user
DB_PASSWORD=your_secure_password

# Security (CHANGE FROM DEFAULTS!)
ADMIN_API_KEY=your_secure_admin_key
LLM_API_KEY=your_secure_llm_key
JWT_SECRET=your_secure_jwt_secret_64chars

# LLM Provider
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your-openai-key
```

**⚠️ CRITICAL:** Never use default values (`folks123`, `postgres`) in production!

### 4. Set Up Database

```bash
# Create PostgreSQL database
createdb fgd_aicraft

# The schema will be initialized on first run
npm start
```

### 5. Run Development Server

```bash
npm run dev
```

### 6. Access Dashboards

- **Main Dashboard:** http://localhost:3000
- **Admin Panel:** http://localhost:3000/admin
- **Fusion Memory:** http://localhost:3000/fusion.html
- **API Docs:** http://localhost:3000/api-docs (if Swagger enabled)
- **Metrics:** http://localhost:3000/metrics (Prometheus)

---

## 🐳 Docker Deployment

### Development with Docker Compose

```bash
docker-compose up --build
```

### Production Docker Build

```bash
# Build optimized image
docker build -t fgd:2.1.0 .

# Run container
docker run -d \
  --name fgd \
  -p 3000:3000 \
  -e DB_HOST=your-db-host \
  -e DB_PASSWORD=your-password \
  -e ADMIN_API_KEY=your-api-key \
  fgd:2.1.0
```

**Docker Image Size:** 150-200MB (multi-stage optimized)

---

## 🔧 Configuration

### Environment Variables

See `.env.example.ENHANCED` for complete documentation of all configuration options.

**Key Configuration Categories:**
- Server & Runtime
- Security & Authentication
- Database (PostgreSQL, Redis)
- CORS & WebSocket
- Rate Limiting
- LLM Providers
- Minecraft Integration
- Logging & Monitoring

### API Authentication

**Two Methods:**

1. **JWT Bearer Token**
   ```bash
   curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
        http://localhost:3000/api/bots
   ```

2. **API Key Header**
   ```bash
   curl -H "X-API-Key: YOUR_API_KEY" \
        http://localhost:3000/api/bots
   ```

**Default API Keys (CHANGE IN PRODUCTION):**
- Admin: `folks123`
- LLM Service: `llm-key-change-me`

---

## 🎮 Usage Examples

### Create a Bot (REST API)

```bash
curl -X POST http://localhost:3000/api/bots \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Miner_01",
    "role": "miner",
    "description": "Efficient resource gatherer",
    "personality": {
      "curiosity": 0.7,
      "patience": 0.8,
      "motivation": 0.9
    }
  }'
```

### Spawn Bot in Minecraft

```bash
curl -X POST http://localhost:3000/api/bots/bot_123/spawn \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "spawnPoint": {
      "x": 100,
      "y": 64,
      "z": 200
    }
  }'
```

### Send Natural Language Command

```bash
curl -X POST http://localhost:3000/api/llm/command \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "Have all miners gather iron ore near spawn",
    "context": {
      "phase": 2,
      "priorityResource": "iron"
    }
  }'
```

### Update Learning Policy

```bash
curl -X POST http://localhost:3000/api/policy \
  -H "Content-Type: application/json" \
  -d '{
    "learningRate": 1.5,
    "delegationBias": 0.6,
    "cooldown": 3000
  }'
```

### WebSocket Connection (JavaScript)

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: {
    apiKey: 'your-api-key'
  }
});

socket.on('bot:moved', (data) => {
  console.log(`Bot ${data.botId} moved to`, data.position);
});

socket.on('bot:status', (data) => {
  console.log(`Bot status:`, data);
});
```

---

## 📊 API Reference

### Core Endpoints

**Health & System:**
- `GET /api/health` - System health check
- `GET /api/health/metrics/system` - System metrics
- `GET /api/health/autonomic` - Autonomic core status

**Bot Management:**
- `GET /api/bots` - List all bots (paginated)
- `POST /api/bots` - Create new bot
- `GET /api/bots/:id` - Get bot details
- `PUT /api/bots/:id` - Update bot configuration
- `DELETE /api/bots/:id` - Delete/deactivate bot
- `POST /api/bots/:id/spawn` - Spawn bot in Minecraft
- `POST /api/bots/:id/despawn` - Remove bot from game
- `POST /api/bots/:id/task` - Assign task to bot

**NPC Management:**
- `GET /api/npcs` - List all NPCs
- `POST /api/npcs` - Create NPC
- `GET /api/npcs/:id` - Get NPC details
- `PUT /api/npcs/:id` - Update NPC
- `DELETE /api/npcs/:id` - Finalize NPC

**Cluster & Metrics:**
- `GET /api/cluster` - Get cluster status
- `GET /api/metrics` - Get system metrics
- `GET /api/cluster/metrics` - Get performance metrics
- `GET /api/stats` - Get statistics

**LLM Commands:**
- `POST /api/llm/command` - Execute natural language command
- `POST /api/llm/batch` - Execute batch commands
- `GET /api/llm/help` - Get command help

**Progression System:**
- `GET /api/progression` - Get progression status
- `GET /api/progression/phase` - Get current phase
- `PUT /api/progression/phase` - Set phase
- `POST /api/progression/metrics` - Update metrics

**Total:** 82 API endpoints documented

Full API documentation: See `REVIEW_REPORT.md` Section 4 (API Integration)

---

## 🔐 Security Checklist

Before deploying to production, ensure:

- [ ] ✅ Changed `ADMIN_API_KEY` from default 'folks123'
- [ ] ✅ Changed `LLM_API_KEY` from default 'llm-key-change-me'
- [ ] ✅ Set strong `JWT_SECRET` (64+ character random string)
- [ ] ✅ Set strong `DB_PASSWORD` (not 'postgres')
- [ ] ✅ Changed `DB_USER` from default 'postgres'
- [ ] ✅ Set `ALLOWED_ORIGINS` (not '*')
- [ ] ✅ Set `NODE_ENV=production`
- [ ] ✅ Enabled HTTPS (`FORCE_HTTPS=true`)
- [ ] ✅ Set appropriate `LOG_LEVEL` (WARN or ERROR)
- [ ] ✅ Disabled debug endpoints
- [ ] ✅ Configured Redis for production
- [ ] ✅ Enabled rate limiting
- [ ] ✅ Set `TRUST_PROXY=true` if behind reverse proxy
- [ ] ✅ Run `npm audit` and fix vulnerabilities
- [ ] ✅ Review CORS configuration

**Security Score (Current):** 3/10 (Poor - needs fixes)
**Security Score (After TODO.md P0 fixes):** 8/10 (Good)

See `TODO.md` for detailed security fixes required.

---

## 🧪 Testing

### Run Tests

```bash
# All tests (Node.js native test runner)
npm test

# With Jest (after installing devDependencies)
npm run test:unit
npm run test:integration
npm run test:coverage
```

### Current Test Coverage

**Test Files:** 11 test suites
- API tests (bots, health, cluster)
- Integration tests
- Autonomic core tests

**Status:** Tests pass but need `jest` devDependencies installed for full coverage reporting.

### Lint & Format

```bash
# Lint (requires eslint installation)
npm run lint

# Format (requires prettier installation)
npm run format
```

---

## 🐛 Known Issues & Limitations

**Critical (P0) - Fix Immediately:**
1. ⚠️ Hardcoded credentials in code (see TODO.md P0-1)
2. ⚠️ Plain text password comparison (see TODO.md P0-2)
3. ⚠️ CORS wildcard configuration (see TODO.md P0-3)
4. ⚠️ 6 npm high-severity vulnerabilities (see TODO.md P0-4)

**High Priority (P1) - Fix This Sprint:**
1. Missing rate limiting on API endpoints
2. No input validation (Zod/Joi)
3. Aggressive polling (5-second interval)
4. Chart re-initialization performance issue

**Medium Priority (P2):**
1. API keys stored in localStorage (XSS risk)
2. Inconsistent error response formats
3. No component reusability in frontend
4. Inline CSS in admin panel

**Full Issue List:** See `TODO.md` (35+ issues categorized by priority)

---

## 📈 Performance Metrics

**Backend:**
- Request handling: ~50ms average
- WebSocket latency: <10ms
- Database pool: 20 connections
- Memory usage: 150-300MB

**Frontend:**
- Bundle size: ~165KB (70KB app + 95KB libraries)
- Load time (3G): 2-5 seconds
- Dashboard polling: 4 requests/5s (optimization needed)

**Docker:**
- Image size: 150-200MB
- Build time: 2-3 minutes
- Cold start: <5 seconds

---

## 🛠️ Development

### Project Structure

```
/home/user/FGD/
├── server.js              # Main entry point
├── src/
│   ├── api/               # API route handlers
│   ├── config/            # Configuration
│   ├── database/          # Database logic
│   ├── middleware/        # Express middleware
│   └── websocket/         # WebSocket handlers
├── routes/                # Additional API routes
├── middleware/            # Auth middleware
├── tests/                 # Test suites
├── public/                # Static frontend files
│   ├── dashboard.html
│   ├── admin.html
│   ├── fusion.html
│   └── *.js, *.css
└── docs/                  # Documentation
```

**Recommended Structure:** See `DIRECTORY_RESTRUCTURE.md` for improved organization.

### Contributing

1. Read `REVIEW_REPORT.md` for codebase overview
2. Check `TODO.md` for prioritized tasks
3. Follow existing code style
4. Write tests for new features
5. Update documentation

### Scripts

```bash
npm start          # Start production server
npm run dev        # Start with auto-reload (--watch)
npm run build      # Run policy self-heal
npm test           # Run tests
npm run lint       # Lint code (needs eslint)
npm run format     # Format code (needs prettier)
```

---

## 📦 Versioning

**Current Version:** 2.1.0

**Version History:**
- **2.1.0** - Hybrid bot architecture, phase progression, comprehensive review
- **2.0.0** - WebSocket integration, admin panel, LLM commands
- **1.x.x** - Initial NPC system and cluster dashboard

**Changelog:** See `CHANGELOG.md` (create if needed)

---

## 🤝 Support & Community

**Issues:** Report bugs and feature requests on GitHub Issues

**Documentation:** See `docs/` directory for detailed guides

**Getting Help:**
1. Check documentation in `README_*.md` files
2. Review `REVIEW_REPORT.md` for architecture details
3. See `TODO.md` for known issues and fixes
4. Open GitHub issue for support

---

## 📝 License

MIT License - See LICENSE file for details

Copyright (c) 2024 AICraft Federation

---

## 🙏 Acknowledgments

Built with:
- Node.js & Express.js
- Socket.IO
- PostgreSQL & Redis
- Chart.js
- OpenAI & Grok/xAI
- Minecraft Paper/Spigot

---

## 🔜 Roadmap

**Short-term (1-2 weeks):**
- [ ] Fix P0 security issues (6 items)
- [ ] Add rate limiting
- [ ] Implement input validation (Zod)
- [ ] Optimize polling to WebSocket push

**Medium-term (1-2 months):**
- [ ] Extract shared utilities
- [ ] Add API documentation (Swagger)
- [ ] Implement token refresh flow
- [ ] Add comprehensive test coverage

**Long-term (3-6 months):**
- [ ] Consider TypeScript migration
- [ ] Add ORM (Prisma)
- [ ] Implement service worker
- [ ] Build component library

See `TODO.md` for detailed roadmap with estimates.

---

## 📊 Project Status

| Category | Score | Status |
|----------|-------|--------|
| **Overall** | 6.5/10 | MODERATE - Needs Improvement |
| **Security** | 3/10 | POOR - Critical fixes needed |
| **Architecture** | 7/10 | GOOD - Well organized |
| **Frontend** | 6.2/10 | MODERATE - Optimization needed |
| **Backend** | 7/10 | GOOD - Solid foundation |
| **Documentation** | 8/10 | VERY GOOD - Comprehensive |
| **Testing** | 4/10 | POOR - Needs expansion |

**Production Readiness:** ⚠️ **NOT READY** - Complete P0 security fixes first (6 hours estimated)

After completing P0 and P1 fixes (~36 hours):
**Production Readiness:** ✅ **READY**

---

**Last Updated:** 2025-11-18
**Review Status:** Comprehensive end-to-end analysis completed
**Next Action:** Start with TODO.md P0 security fixes
