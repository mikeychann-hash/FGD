# FGD Agent Development Guide

> Detailed technical reference for AI agents working on the FGD codebase

---

## Quick Context

**What is FGD?**  
A Minecraft NPC swarm management system with:
- REST API + WebSocket for bot control
- Mineflayer for native bot connections
- RCON + Java plugin for server integration
- AI-driven autonomous task planning

**Primary Entry Points:**
- `server.js` - Main production server
- `npc_engine.js` - Core NPC management
- `minecraft_bridge.js` - RCON/plugin bridge
- `minecraft_bridge_mineflayer.js` - Native bot bridge

---

## Code Conventions

### Module System
```javascript
// ES Modules (type: "module" in package.json)
import { foo } from './bar.js';  // Always include .js extension
export { something };
export default class MyClass {}
```

### Error Handling Pattern
```javascript
try {
  const result = await operation();
  return { success: true, data: result };
} catch (error) {
  logger.error('Operation failed', { error: error.message });
  return { success: false, error: error.message };
}
```

### Event Emission Pattern
```javascript
// Always emit events for state changes
this.emit('npc_registered', { id, type, position });
this.emit('task_completed', { taskId, npcId, result });
```

### Logging Convention
```javascript
import { logger } from './logger.js';

logger.info('Message', { key: 'value' });
logger.warn('Warning', { details });
logger.error('Error', { error: err.message });
logger.debug('Debug info', { data });

// Child loggers for components
const log = logger.child({ component: 'NPCSpawner' });
```

---

## Key Patterns

### 1. NPC Registration

```javascript
// Full registration with all options
engine.registerNPC('bot_01', 'miner', {
  position: { x: 0, y: 64, z: 0 },
  role: 'miner',
  personality: { aggression: 0.2, caution: 0.8 },
  appearance: { skin: 'steve' },
  metadata: { homeChest: { x: 10, y: 64, z: 10 } },
  profile: existingProfile, // Optional
  autoSpawn: true,
  persist: true
});
```

### 2. Task Structure

```javascript
const task = {
  id: 'task_uuid',          // Auto-generated if not provided
  action: 'mine',           // Action type
  target: 'iron_ore',       // Target block/entity
  position: { x, y, z },    // Optional target position
  params: { count: 5 },     // Action-specific params
  priority: 'normal',       // low|normal|high|critical
  sender: 'admin',          // Who assigned
  createdAt: Date.now()
};

await engine.assignTask(npc, task);
```

### 3. Spawn Pipeline Usage

```javascript
import { spawnBot, spawnAllBots, SpawnError } from './src/services/spawn_pipeline.js';

// Single bot spawn
try {
  const result = await spawnBot(npcSystem, io, {
    botId: 'miner_01',
    position: { x: 100, y: 64, z: 100 },
    user: { username: 'admin' },
    source: 'api'
  });
  // result: { success, spawned, bot, position, spawnResponse }
} catch (error) {
  if (error instanceof SpawnError) {
    console.error(error.message, error.status, error.meta);
  }
}

// Spawn all registered bots
const results = await spawnAllBots(npcSystem, io, { user, source: 'cli' });
```

### 4. Action Pipeline (UAF)

```javascript
import { createActionPipeline } from './src/services/action_pipeline/index.js';

const pipeline = createActionPipeline(npcSystem, io);

// Execute action
const result = await pipeline.run('bot_01', {
  type: 'mine',
  block: 'stone',
  count: 10
});

// Available action types:
// - mine, dig
// - place, build
// - move, navigate
// - attack, defend
// - eat
// - inventory (get, equip, drop)
// - chest.interact (deposit, withdraw)
// - craft
```

### 5. Bridge Actions

```javascript
// RCON Bridge
await bridge.sendCommand('tp player 0 64 0');
await bridge.moveBot(botId, dx, dy, dz, options);
await bridge.scanArea(botId, radius);
await bridge.dig(botId, { x, y, z });
await bridge.place(botId, { x, y, z }, 'stone');

// Mineflayer Bridge
await mineflayerBridge.createBot('bot_01', { username: 'Bot01' });
await mineflayerBridge.moveToPosition('bot_01', { x, y, z }, { range: 1 });
await mineflayerBridge.digBlock('bot_01', { x, y, z }, { equipTool: true });
await mineflayerBridge.collectBlocks('bot_01', { blockType: 'iron_ore', count: 5 });
await mineflayerBridge.attackEntity('bot_01', { entityType: 'zombie' });
```

---

## API Route Patterns

### Creating a New Route

```javascript
// routes/myfeature.js
import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../src/middleware/validate.js';
import { mySchema } from '../src/validators/my.schemas.js';

export function initMyRoutes(npcSystem, io) {
  const router = express.Router();
  const engine = npcSystem?.npcEngine;

  // Public endpoint
  router.get('/health', (req, res) => {
    res.json({ success: true, status: 'healthy' });
  });

  // Protected endpoint
  router.get('/', authenticate, authorize('read'), (req, res) => {
    try {
      const data = engine.getSomething();
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ error: 'Internal error', message: error.message });
    }
  });

  // With validation
  router.post('/', authenticate, authorize('write'), validate(mySchema), async (req, res) => {
    try {
      const result = await engine.doSomething(req.body);
      if (io) io.emit('something:done', result);
      res.status(201).json({ success: true, result });
    } catch (error) {
      res.status(400).json({ error: 'Failed', message: error.message });
    }
  });

  return router;
}
```

### Validation Schemas (Zod)

```javascript
// src/validators/bot.schemas.js
import { z } from 'zod';

export const createBotSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  role: z.string().min(1).max(50).optional(),
  type: z.string().min(1).max(50).optional(),
  position: z.object({
    x: z.number(),
    y: z.number().min(-64).max(320),
    z: z.number()
  }).optional(),
  personality: z.record(z.number()).optional(),
  autoSpawn: z.boolean().optional()
}).refine(data => data.role || data.type, {
  message: 'Either role or type is required'
});
```

---

## WebSocket Integration

### Server-Side Events

```javascript
// Emit to all clients
io.emit('bot:spawned', { botId, position, timestamp });

// Emit to specific socket
socket.emit('private:message', data);

// Listen for client events
io.on('connection', (socket) => {
  socket.on('plugin_heartbeat', () => {
    bridge.recordHeartbeat('plugin');
  });
});
```

### Event Replay Buffer

```javascript
// handlers.js - Recent events are replayed to new connections
const MAX_REPLAY_EVENTS = 50;
replayEventsToSocket(socket, replayBuffer);
```

---

## Database Operations

```javascript
import { query, transaction, getPool } from './src/database/connection.js';

// Simple query
const result = await query('SELECT * FROM npcs WHERE id = $1', [npcId]);

// Transaction
await transaction(async (client) => {
  await client.query('UPDATE npcs SET status = $1 WHERE id = $2', ['active', npcId]);
  await client.query('INSERT INTO spawn_log (npc_id) VALUES ($1)', [npcId]);
});
```

---

## Testing Patterns

### Unit Test Structure

```javascript
// test/my_module.test.js
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

describe('MyModule', () => {
  let instance;

  beforeEach(() => {
    instance = new MyModule();
  });

  it('should do something', async () => {
    const result = await instance.doSomething();
    expect(result.success).toBe(true);
  });
});
```

### Mocking

```javascript
// test/utils/mocks.js
export const mockBridge = {
  spawnBot: jest.fn().mockResolvedValue({ success: true }),
  moveBot: jest.fn().mockResolvedValue({ x: 0, y: 64, z: 0 }),
  isConnected: jest.fn().mockReturnValue(true)
};

export const mockIo = {
  emit: jest.fn()
};
```

---

## Common Tasks

### Adding a New Bot Role

1. Update `constants.js`:
```javascript
export const BOT_ROLES = {
  // ... existing
  MERCHANT: 'merchant'
};
```

2. Create task planner in `tasks/`:
```javascript
// tasks/plan_trade.js
export async function planTrade(bot, target, options) {
  // Implementation
}
```

3. Add to router table in `adapters/mineflayer/router.js`:
```javascript
'trade': {
  handler: 'interaction',
  requiresBot: true,
  description: 'Trade with villager'
}
```

### Adding a New API Endpoint

1. Create route file or add to existing
2. Register in `server.js`:
```javascript
const myRouter = initMyRoutes(npcSystem, io);
apiV1.use('/myfeature', myRouter);
```

3. Add to OpenAPI spec (`docs/openapi/swagger.yaml`)

### Adding a New WebSocket Event

1. Emit from appropriate location:
```javascript
io.emit('custom:event', { data });
```

2. Document in handlers.js comments
3. Update CLAUDE.md WebSocket events section

---

## File Locations Reference

| Need | Location |
|------|----------|
| Add NPC behavior | `npc_engine/autonomy.js` |
| Add task type | `adapters/mineflayer/router.js` |
| Add API endpoint | `routes/*.js` |
| Add validation | `src/validators/*.schemas.js` |
| Add constants | `constants.js` |
| Add database table | `migrations/*.sql` |
| Add test | `test/*.test.js` or `tests/*.test.js` |
| Configure server | `src/config/server.js` |

---

## Debugging Tips

### Log Levels
```javascript
// Set LOG_LEVEL=debug for verbose output
logger.debug('Detailed info');

// Component-specific logs
const log = logger.child({ component: 'MyComponent' });
```

### Health Endpoints
```bash
# Full system health
curl localhost:3000/api/health

# Bridge status
curl localhost:3000/api/minecraft/status

# Prometheus metrics
curl localhost:3000/metrics
```

### Common Debug Points
1. Check `logs/app-*.log` for application logs
2. Check `minecraft-servers/logs/latest.log` for server logs
3. WebSocket events in browser DevTools Network tab
4. RCON commands via `bridge.sendCommand()`

---

## Architecture Decisions

### Why Dual Bridge Architecture?
- **RCON Bridge**: Works with FGDProxyPlayer plugin for server-side control
- **Mineflayer Bridge**: Direct bot connections for full autonomy
- Both can coexist for different use cases

### Why Microcore?
- Per-bot tick loop enables independent state management
- Physics-lite interpolation for smooth movement
- Event-driven updates to macro systems

### Why Golden Path Spawning?
- Single entry point prevents spawn limit bypasses
- Consistent event emission
- Dead letter queue for reliability

---

## Performance Notes

- Max 8 bots recommended (`MAX_BOTS`)
- Tick rate: 200ms (configurable)
- Scan interval: 1500ms (configurable)
- Task queue limit: 100 (backpressure)
- Rate limits on all API endpoints

---

*This guide is optimized for AI agent consumption and rapid codebase navigation.*
