# FGD Autonomy Migration & Mineflayer Integration Guide

**Scope:** Practical path to evolve FGD from proxy-style bots to full Mineflayer + Pathfinder-powered autonomous agents.  
**Audience:** FGD maintainers, advanced users, and LLM assistants tasked with implementing or refactoring autonomy code.  
**Status:** Active roadmap. Treat this as the authoritative guide for autonomy work.

This guide assumes you have read:

- `README.md` — current truth & capability matrix  
- `docs/FGD_COMPREHENSIVE_REVIEW.md` — target architecture

---

## 1. Problem Statement

Legacy FGD bots rely on proxy-style control with limited actions. To unlock real autonomy:

- We need **real Minecraft client agents** (Mineflayer)
- We need robust **navigation** (Pathfinder)
- We need **safe LLM-driven planning** on top of deterministic primitives

This document describes how to do that without breaking existing users.

---

## 2. Design Principles

1. **Adapters, not rewrites**: introduce Mineflayer as a new adapter alongside existing bots.
2. **Stable contracts**: keep task schemas and public APIs compatible across adapters.
3. **No arbitrary eval**: LLMs output structured plans, FGD executes them via vetted commands.
4. **Progressive rollout**: move from single-bot experiments → small squads → swarms.

---

## 3. Phased Migration Plan

### Phase 0 — Baseline & Contracts

- Confirm current proxy-based bots work via the coordinator.
- Define a shared **Task Schema**:
  - Movement, mining, building, inventory, combat, chat, etc.
- Ensure all tasks are:
  - Logged
  - Validated
  - Mapped to explicit adapter methods

### Phase 1 — Single Mineflayer Bot Adapter

Implement a Mineflayer-based adapter module that:

- Connects to the target server with standard credentials
- Subscribes to the FGD task queue
- Implements a minimal set of actions:
  - move_to / follow
  - look_at
  - chat / respond
  - mine_block
  - place_block
  - use_item / interact

Use `mineflayer-pathfinder` for movement and navigation. Keep all logic inside the adapter; the coordinator should only see structured tasks.

### Phase 2 — Safety & Policy Layer

Before scaling up:

- Add guardrails:
  - Limit which worlds/regions bots may enter
  - Disallow destructive actions without explicit flags
  - Ensure every task is attributed to a caller/role
- Expose safe, well-documented tools for LLMs:
  - `inspect_world`, `inspect_bot`, `propose_plan`, `submit_task_batch`

LLMs should **never** send raw JavaScript. They propose plans; FGD validates and enqueues.

### Phase 3 — Multi-Bot & Roles

Extend the adapter to support multiple Mineflayer bots:

- Register each bot with:
  - ID, role, capabilities, allowed regions
- Introduce simple coordination patterns:
  - Claiming work areas
  - Avoiding collisions
  - Specialization (miner, builder, guard, courier)

At this stage, keep the logic deterministic and inspectable so debugging is easy.

### Phase 4 — Autonomy Loop Integration

Wire in an autonomy/planning layer:

1. Observe:
   - World + bot state snapshots
2. Decide:
   - LLM or heuristic planner generates a set of tasks
3. Validate:
   - Apply policies, limits, and safety checks
4. Act:
   - Enqueue tasks to the Mineflayer adapter

Tune cadence carefully (e.g., planning every few seconds, not every tick) and prefer incremental updates over giant plans.

### Phase 5 — Swarms & Advanced Behaviors

Once stable:

- Introduce higher-level swarm behaviors:
  - Region-based assignment
  - Long-running projects (roads, farms, defenses)
- Add memory:
  - Per-bot experience/skills
  - Shared knowledge for the swarm
- Tighten observability:
  - Dashboards for tasks, errors, region coverage, resource usage

Clearly mark any experimental modules in code and docs.

---

## 4. Implementation Notes (for Coders & LLMs)

- Place Mineflayer-related code under `adapters/mineflayer/`.
- Keep one entry function per verb:
  - `moveTo(target)`, `mine(target)`, `build(structure)`, etc.
- Use configuration (not hard-coded values) for:
  - Server address
  - Credentials
  - Allowed regions and behaviors
- Log:
  - Task received
  - Decision taken (allowed/denied)
  - Outcome (success/failure + reason)

Whenever this guide and the code disagree, update **both**. This document is meant to be safe to feed into autonomous coding tools.
