# Bot Connectivity and Control

This guide explains how FGD bots attach to Minecraft servers, how control signals move through the stack, and where to plug in new control surfaces.

## Connection paths

- **Plugin/RCON bridge (`minecraft_bridge.js`)**: Talks to the FGDProxyPlayer-style plugin and RCON to issue authoritative server commands (spawn, movement, inventory updates). Ideal when you need server-enforced actions or to mirror vanilla command semantics.
- **Mineflayer bridge (`minecraft_bridge_mineflayer.js`)**: Maintains native mineflayer sessions for each bot. Actions travel through REST/WebSocket routes to mineflayer clients, optionally gated by the governance policy service (`MineflayerPolicyService`).
- **Manual control sessions (`routes/control.js`)**: `/api/control/:botId/session/*` endpoints start, stop, and introspect operator-driven sessions so the desktop app and web UIs can stream input events to connected bots.

## Spawn and lifecycle

1. **Register NPCs** via the API or CLI so the NPC engine tracks desired bots and their roles.
2. **Spawn through the unified pipeline** (`src/services/spawn_pipeline.js`), which requests a bridge session, coordinates world positioning, and emits `bot:spawned` events on success.
3. **Monitor health** using `/api/minecraft/status` and `/api/health` to verify the bridge, policy service, and engine are all ready before issuing control commands.
4. **Despawn or restart** using `/api/bots/despawn` or `/api/server/restart` to cleanly recycle connections and processes when the world or bridge becomes unstable.

## Extending control

- **New actions**: Add handlers in `routes/action.js` and corresponding execution in the mineflayer or plugin bridge to expose new capabilities.
- **Autonomy hooks**: Use the NPC engine task queue and `src/services/action_pipeline.js` to schedule self-directed behaviors driven by LLM or planner outputs.
- **Policy and safety**: Extend governance rules in `security/governance_validator.js` and the policy service to enforce approvals before executing high-risk actions.
