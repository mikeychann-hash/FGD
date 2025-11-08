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

🛠️ **Next Tasks**
- Move all constants to `.env` or `constants.js`.
- Enforce startup validation sequence (telemetry → DB → NPC Engine → Bridge).
- Secure API key via environment variable.
- Add GitHub Actions workflow for lint/test/build.

---

## **PHASE 2 — Bot System Enhancements (Week 3–4)**
**Goal:** Finalize spawning, runtime, and cleanup logic.

✅ **Completed**
- Fixed spawn limit check bypass.
- Verified bot deletion WebSocket updates.

🧩 **Next Tasks**
- Implement Dead Letter Queue API.
- Add position validation (Y-level -64 to 320).
- Implement personality-weighted task selection.
- Document WebSocket event payloads.

---

## **PHASE 3 — Minecraft Bridge & Connectivity (Week 5–6)**
**Goal:** Secure and stabilize RCON and WebSocket communications.

✅ **Verified**
- Bridge fallback and retry logic operational.

🔧 **Next Tasks**
- Sanitize RCON commands (injection prevention).
- Add heartbeat pings from plugin → backend.
- Implement WebSocket message replay queue.

---

## **PHASE 4 — Learning, Profiles & Persistence (Week 7–8)**
**Goal:** Solidify persistence and learning data consistency.

📘 **Tasks**
- Add JSON schema validation for profile/registry files.
- Implement archive rotation for backups.
- Create learning reconciliation checks.

---

## **PHASE 5 — Task Refactor (Week 9–10)**
**Goal:** Modularize and optimize 30K+ line `/tasks` system.

🧠 **Tasks**
- Split planners into modular layers (`planner_core.js`, `planner_ai.js`, `planner_actions.js`).
- Register planners dynamically with `registerPlanner()` API.
- Add worker-thread parallelization.
- Apply personality-based planner bias.

---

## **PHASE 6 — Governance, APIs & LLM Integration (Week 11–12)**
**Goal:** Finalize policy enforcement and safe LLM routing.

🧩 **Tasks**
- Add self-healing policy test harness.
- Validate rule fairness in governance config.
- Implement provider fallback (OpenAI → Grok → Local).
- Add `/api/cluster/metrics` for health tracking.

---

## **PHASE 7 — Dashboard, QA & Telemetry (Week 13–14)**
**Goal:** Expand testing coverage and real-time metrics.

📊 **Tasks**
- Integrate Prometheus metrics for tick latency & queue depth.
- Add dashboard performance graphs.
- Target 85%+ coverage on core systems.
- Automate nightly tests via CI.

---

## **PHASE 8 — Production Hardening & Documentation (Ongoing)**
**Goal:** Prepare for scaling and open-source release.

🛡️ **Tasks**
- Add Docker Compose stack for full FGD deployment.
- Introduce API versioning `/v1/` and `/v2/`.
- Expand `/docs/` with bot architecture, API, and governance guides.
- Add nightly regression and dependency audits.

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

