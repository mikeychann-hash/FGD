# WebSocket Event Reference

This document lists the real-time events emitted by the FGD backend along with their payload structures.

## Connection Lifecycle

| Event | Payload | Description |
|-------|---------|-------------|
| `init` | `{ nodes, metrics, stats, logs, config }` | Sent immediately after connection with a snapshot of current state. |
| `bridge:heartbeat` | `{ timestamp, ageSeconds }` | Emitted when the Minecraft bridge heartbeat is received from the plugin. |
| `plugin_heartbeat_ack` | `{ timestamp }` | Confirmation sent to the plugin after its heartbeat payload is processed. |
| `plugin_latency_update` | `{ timestamp, tickLatency }` | Optional telemetry from the plugin describing recent tick latency. |

## Bot/NPC Events

| Event | Payload | Description |
|-------|---------|-------------|
| `bot:created` | `{ bot: { id, role, type, personalitySummary }, createdBy, timestamp }` | A bot was registered via the API. |
| `bot:moved` | `{ botId, position, timestamp }` | Bot position update emitted by the Minecraft bridge. |
| `bot:status` | `{ id, status, ... }` | NPC state updates reported by the engine. |
| `bot:task_complete` | `{ npcId, task, success }` | Task lifecycle completion emitted by the engine. |
| `bot:scan` | `{ botId, result }` | Scan results forwarded from the bridge or plugin. |
| `bot:error` | `{ npcId, payload }` | Error messages from the NPC engine or bridge. |

## Metrics and Telemetry

| Event | Payload | Description |
|-------|---------|-------------|
| `metrics:update` | `{ cpu, memory, cluster, clusterTimestamp, host }` | Updated cluster metrics. |
| `metrics:performance` | `{ queueDepth, lastLatencySeconds, heartbeatAgeSeconds, updatedAt }` | Derived performance metrics including queue depth, task latency, and heartbeat age. |
| `nodes:update` | `Array<Node>` | Updated cluster node list. |
| `stats:update` | `SystemStats` | Aggregated stats from the state manager. |
| `logs:update` | `Array<LogEntry>` | Tail of server log entries for the dashboard. |
| `log:new` | `LogEntry` | Emitted for individual log messages. |

## Task Queue Events

| Event | Payload | Description |
|-------|---------|-------------|
| `task_queued` | `{ task, position }` | Task placed on the queue. |
| `task_dequeued` | `{ task, remaining }` | Task removed from the queue for execution. |
| `task_dropped` | `{ task, reason, droppedFor? }` | Task dropped due to back-pressure. |

Payloads reflect the structures emitted by the server as of the roadmap implementation (v2). Consumers should tolerate additional fields for forward compatibility.
