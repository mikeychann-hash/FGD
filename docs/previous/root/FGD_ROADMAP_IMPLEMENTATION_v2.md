# 🧭 FGD Unified Implementation Roadmap (v2 – Bot Review Integrated)

Integrated from:
- `BUG_REVIEW_CHECKLIST.md`
- `CODEBASE_STRUCTURE.md`
- `FILE_MAP.md`
- `EXTENSIVE_BOT_REVIEW_SUMMARY.md`

---

## **PHASE 1 — Core Stability & Configuration (Week 1–2)**
**Goal:** Strengthen initialization, unify constants, and eliminate redundant configuration.

✅ **Completed**
- Unified `MAX_BOTS` constant.
- Verified microcore memory cleanup.

✅ **Completed**
- Centralized configuration in `constants.js` with environment overrides and startup validation enforcing telemetry → database → NPC engine → bridge sequencing (`src/services/startup.js`, `server.js`).
- API key handling moved to environment-backed secrets with runtime warnings for defaults (`middleware/auth.js`, `security/secrets.js`).
- Continuous integration workflow added for linting, tests, and build validation (`.github/workflows/ci.yml`).

---

## **PHASE 2 — Bot System Enhancements (Week 3–4)**
**Goal:** Finalize spawning, runtime, and cleanup logic.

✅ **Completed**
- Fixed spawn limit check bypass.
- Verified bot deletion WebSocket updates.

✅ **Completed**
- Dead Letter Queue management endpoints exposed with retry controls (`routes/bot.js`, `npc_spawner.js`).
- World-bound validation leveraging shared constants ensures positions remain within -64 to 320 (`constants.js`, `routes/bot.js`).
- Planner bias integrates NPC personality traits for task prioritization (`tasks/planner_ai.js`, `tasks/index.js`).
- WebSocket event payloads formally documented (`docs/websocket_events.md`).

---

## **PHASE 3 — Minecraft Bridge & Connectivity (Week 5–6)**
**Goal:** Secure and stabilize RCON and WebSocket communications.

✅ **Verified**
- Bridge fallback and retry logic operational.

✅ **Completed**
- RCON command sanitization prevents injection and rejects unsafe characters (`minecraft_bridge.js`).
- Bridge heartbeat tracking keeps plugin connectivity monitored (`minecraft_bridge.js`, `src/websocket/plugin.js`).
- WebSocket replay queue preserves outbound messages for reconnect scenarios (`src/websocket/handlers.js`).

---

## **PHASE 4 — Learning, Profiles & Persistence (Week 7–8)**
**Goal:** Solidify persistence and learning data consistency.

✅ **Completed**
- JSON schema validation added for NPC data ingestion without external dependencies (`src/utils/schema.js`).
- Archive rotation ensures persisted history stays within retention limits (`npc_finalizer.js`).
- Learning reconciliation compares registry and learning engine state for consistency (`learning_engine.js`, `src/services/npc_initializer.js`).

---

## **PHASE 5 — Task Refactor (Week 9–10)**
**Goal:** Modularize and optimize 30K+ line `/tasks` system.

✅ **Completed**
- Task planners decomposed into modular layers with explicit exports (`tasks/planner_core.js`, `tasks/planner_ai.js`, `tasks/planner_actions.js`).
- Dynamic planner registration powers custom behaviors (`tasks/planner_core.js`).
- Worker-thread execution with safe fallbacks handles parallel planning (`tasks/planner_core.js`, `tasks/planner_worker.js`).
- Personality bias applied to planner output metadata for tailored execution (`tasks/planner_ai.js`, `tasks/index.js`).

---

## **PHASE 6 — Governance, APIs & LLM Integration (Week 11–12)**
**Goal:** Finalize policy enforcement and safe LLM routing.

✅ **Completed**
- Self-healing governance harness validates and patches policy deviations (`security/governance_validator.js`, `scripts/policy_self_heal.js`).
- Fairness validation ensures governance rules remain balanced (`security/governance_validator.js`).
- Provider fallback allows sequential LLM routing across OpenAI, Grok, and local providers (`llm_bridge.js`).
- `/api/cluster/metrics` endpoint surfaces runtime telemetry for dashboards (`src/api/cluster.js`).

---

## **PHASE 7 — Dashboard, QA & Telemetry (Week 13–14)**
**Goal:** Expand testing coverage and real-time metrics.

✅ **Completed**
- Prometheus-style metrics surface queue depth, task latency, and system counters (`src/services/metrics.js`, `server.js`).
- Dashboard visualizations plot performance trends using cluster metrics (`dashboard.js`, `dashboard.html`).
- Test coverage expanded across startup validation, bridge safety, planner workers, and governance (`test/*.test.js`).
- CI workflow schedules automated verification to guard nightly regressions (`.github/workflows/ci.yml`).

---

## **PHASE 8 — Production Hardening & Documentation (Ongoing)**
**Goal:** Prepare for scaling and open-source release.

✅ **Completed**
- Docker Compose stack provisions full deployment topology for local and staging runs (`docker-compose.yml`).
- API versioning introduced while maintaining backward compatibility (`server.js`).
- Documentation expanded covering websockets, bot architecture, API versioning, and governance fairness (`docs/*.md`).
- CI workflow includes nightly regression hooks and dependency audit steps (`.github/workflows/ci.yml`).

---

## ✅ **Verified Fixes Summary**
| Fix | Description | File(s) |
|------|--------------|---------|
| #1 | Duplicate MAX_BOTS constant unified | `constants.js`, `routes/bot.js` |
| #2 | Microcore cleanup verified | `core/npc_microcore.js` |
| #3 | Status filter fixed (idle/active) | `npc_registry.js` |
| #4 | Spawn limit enforced globally | `routes/bot.js` |
| #5 | Console spam throttled | `admin.js` |
| #6 | Bot deletion WebSocket refresh | `admin.js`, WebSocket |

---

## 📈 **Milestone Overview**
| Milestone | Focus | Deliverable | Target |
|------------|--------|-------------|--------|
| M1 | Startup & Config | Unified constants, CI pipeline | Week 2 |
| M2 | Bot System | Dead-letter queue + validation | Week 4 |
| M3 | Bridge | RCON safety, heartbeat | Week 6 |
| M4 | Persistence | Schema & backups | Week 8 |
| M5 | Task Refactor | Modular planners | Week 10 |
| M6 | Governance | Self-healing + LLM fallback | Week 12 |
| M7 | QA | Telemetry + test coverage | Week 14 |

---

### **Summary**
This roadmap merges verified fixes and new objectives across FGD’s architecture, bot systems, Minecraft bridge, AI governance, and telemetry. It represents the path to full production readiness — stable, modular, and open for scale.

