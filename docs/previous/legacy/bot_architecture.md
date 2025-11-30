# Bot Architecture Overview

The FGD bot stack is organized into layers that coordinate persistence, runtime execution, and world integration.

## High-Level Components

1. **NPC Registry** (`npc_registry.js`)
   - Persists long-lived metadata for every bot, including spawn history and trait bundles.
   - Validated against `schemas/npc_registry.schema.json` during load to prevent corrupt entries.

2. **Learning Engine** (`learning_engine.js`)
   - Tracks experience, skill mastery, and personality vectors.
   - Reconciled with the registry at startup to remove stale profiles and seed missing ones.

3. **Spawner / Finalizer** (`npc_spawner.js`, `npc_finalizer.js`)
   - Spawner enforces world bounds, spawn limits, and dead-letter retries.
   - Finalizer performs archive rotation and ensures consistent cleanup.

4. **NPC Engine** (`npc_engine.js`)
   - Maintains runtime NPC state, integrates with the microcore, and routes task execution.
   - Task assignment now factors in personality bias and planner metadata.

5. **Minecraft Bridge** (`minecraft_bridge.js`)
   - Sanitizes RCON commands, tracks plugin heartbeats, and surfaces telemetry to Prometheus.

6. **Task Planning Layer** (`tasks/`)
   - Modularized into planner registration (`planner_core.js`), AI bias (`planner_ai.js`), and action modules (`planner_actions.js`).
   - Supports worker-thread execution for compute-heavy planners when safe.

## Telemetry Flow

```
Telemetry Files → telemetry.js → SystemStateManager → WebSocket/Prometheus
                                   ↘ metrics.js ↗
```

Prometheus gauges expose queue depth, task latency, and bridge heartbeat age for integration with external dashboards.
