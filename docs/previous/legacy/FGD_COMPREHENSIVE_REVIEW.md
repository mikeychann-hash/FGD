# FGD Comprehensive Technical Review & Target Architecture

**Scope:** End-to-end view of the FGD Stack: modules, data flows, constraints, and target behavior.  
**Audience:** Core contributors, integrators, and LLM assistants making non-trivial code changes.  
**Status:** Mixed — some components are implemented, others are partial or roadmap. This document describes the **target architecture**; always cross-check with the capability matrix in `README.md`.

---

## 1. System Goals

FGD aims to be a **production-grade control plane for Minecraft automation**, optimized for:

- Multiple autonomous agents per world
- Safe LLM-driven decision making
- Extensible integrations (Mineflayer, Paper plugins, external tools)
- Progressive hardening: observability, governance, clustering, and rollback paths

FGD should let you start small (a single host and a couple of bots) and grow into clustered, policy-governed deployments without rewriting everything.

---

## 2. High-Level Architecture

Key layers:

1. **Ingress**
   - REST + WebSocket APIs
   - AuthN/Z (API keys, tokens, roles)
   - Rate limits and basic input validation

2. **Coordinator Core**
   - Task queue & dispatcher
   - Bot registry (online agents, capabilities, locations)
   - World & server state cache
   - Policy hooks (per-role and per-environment limits)

3. **Execution Adapters**
   - **Proxy Bots (Legacy / Current):**
     - Command-based control of in-game representations
     - Limited to what the backing server/execution path exposes
   - **Mineflayer Adapter (Target / In-Progress):**
     - Full Minecraft protocol client
     - Access to movement, mining, combat, inventory, etc.
     - Integrates `mineflayer-pathfinder` for navigation
   - Future adapters: direct plugin APIs, Bedrock-specific bridges, etc.

4. **LLM & Tooling Layer**
   - Structured tools for:
     - Inspecting world/bot state
     - Scheduling tasks
     - Requesting plans instead of raw commands
   - Optional “planner” agents that translate high-level goals into safe, discrete actions.

5. **Persistence & Observability**
   - Config and state stored in filesystem or database (depending on deployment)
   - Logs for:
     - API requests
     - Bot actions
     - Policy decisions
   - Planned:
     - Metrics (task latency, error rates, success ratios)
     - Dashboards for fleets and swarms

6. **Cluster & HA (Target)**
   - Multiple coordinator nodes with a shared backing store
   - Leader election or sharding by world
   - Self-healing workers and backpressure controls

---

## 3. Implementation vs Roadmap

This section should be kept tightly in sync with the codebase. Example framing:

- **Stable:**
  - Core APIs for status, simple task submission, and bot control
  - Minimal dashboard for inspection
  - Proxy-style bot execution

- **Partial:**
  - LLM tools & planner loop
  - Skill/XP-style learning schema
  - Configurable limits and role-based policies

- **Planned / Experimental:**
  - Full Mineflayer adapter with pathfinding & task graph execution
  - Swarm controller (assign roles, claim regions, balance workloads)
  - Multi-node clustering & full observability stack

Update this section whenever you merge major features so external tools can reason correctly.

---

## 4. Design Contracts (For Contributors & LLMs)

When extending FGD:

1. **Never let untrusted input map directly to server op commands.**
2. **Represent actions as structured tasks**, not free-form text:
   - Example: `{"type":"mine_block","botId":"fgd_miner_01","target":{"x":10,"y":63,"z":-4}}`
3. **Keep adapters thin and explicit**:
   - Each adapter exposes a fixed set of verbs.
   - No arbitrary eval or code injection from LLM outputs.
4. **Log and tag everything important**:
   - Every task: who requested it, which bot executed it, outcome.
5. **Prefer idempotent, resumable flows**:
   - Especially for long-running mining, building, or exploration tasks.

These contracts are what make FGD safe to drive via autonomous systems.

---

## 5. Files & Entry Points

This section should point to real paths in your repo. Adapt as needed:

- `server/` — Core coordinator & HTTP/WebSocket handlers
- `dashboard/` — Web UI
- `adapters/proxy/` — Current in-game proxy bot implementation
- `adapters/mineflayer/` — Mineflayer-based adapter (WIP)
- `llm/` — Prompt templates, tool definitions, planner agents
- `docs/` — Architecture, migration, and governance docs

If a directory or file is aspirational, flag it as such inside the file to avoid confusing tooling.

---

## 6. Governance, Policy & Safety (Snapshot)

Document at least:

- Roles (e.g., `ADMIN`, `AUTOPILOT`, `VIEWER`)
- Which APIs/tools each role may use
- Global limits (max bots, max concurrent tasks, allowed worlds)
- Dangerous actions (e.g., TNT, lava, world-edit) and their approval path

For deeper operational docs (runbooks, dashboards, SLOs), extend this file or add `docs/FGD_OPERATIONS.md`.
