Eating & Hunger Flow
====================

Pipeline
--------
- Hunger state tracked per bot (`npc_engine.get/setHungerLevel`, runtime + metadata).
- Food selection via `findBestFood` (avoids golden apples unless allowed, avoids suspicious stew unless flagged, prefers high saturation).
- Action entry: `POST /api/bots/:id/action` with `{ type: "eat" }` → planner picks best food → `minecraft_bridge.dispatchAction` sends:
  ```json
  { "type": "action", "action": "eat", "botId": "bot", "food": { "itemId": "...", "slot": 3 } }
  ```
- Plugin must equip food, play eat, decrement stack, update hunger, and emit:
  ```json
  { "type": "actionComplete", "action": "eat", "botId": "bot", "hunger": 18 }
  ```
- Bridge resolves action, emits `bot:actionComplete` and `bot:hunger-update`, registry/runtime updated.

Auto-eat rules
--------------
- Hunger monitor in `npc_engine.startHungerMonitor`: if hunger < 12 and not in combat, dispatches `eat` via actionPipeline.
- If health <= 50%, allows golden apple.
- Uses same Golden Path (REST/action pipeline); no direct bridge calls.

Food selection
--------------
- `findBestFood(inventory, { allowGoldenApple, allowSuspicious })`
- Scored by hunger + saturation; skips empty stacks, golden apples unless allowed, suspicious stew unless allowed; falls back to any edible item.

Testing quick curl
------------------
- `curl -X POST -H "X-API-Key: $KEY" http://localhost:3000/api/bots/miner_01/action -d '{"type":"eat"}'`
- Watch Socket.IO: `bot:actionDispatched`, `bot:actionComplete`, `bot:hunger-update`.

Paper plugin executor (expected behavior)
-----------------------------------------
- Receive `{ type:"action", action:"eat", botId, food:{itemId,slot} }`.
- Equip food in main hand (use slot if provided), play eating animation.
- Decrement stack; update hunger/saturation server-side.
- Emit `actionComplete` with updated hunger; on errors (no food, cannot eat) emit `actionFailed` with `error`.
