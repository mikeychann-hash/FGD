# Mineflayer vs FGD Comparison & Improvement Recommendations

**Date:** 2025-11-09
**Purpose:** Analyze Mineflayer architecture and identify improvements for FGD

---

## Executive Summary

**Mineflayer** is a mature, production-ready Node.js library for creating Minecraft bots with a clean, event-driven API. **FGD** is a more ambitious system attempting to build an AI-driven, multi-bot coordination platform with autonomous task planning, learning, and federation capabilities.

**Key Insight:** Mineflayer excels at low-level bot control, while FGD aims for high-level AI orchestration. FGD can improve by adopting Mineflayer's robust patterns while maintaining its unique AI-driven vision.

---

## Architecture Comparison

### Mineflayer Architecture

```
┌─────────────────────────────────────┐
│         Bot Instance                │
│  - Event-driven control             │
│  - Direct Minecraft protocol access │
│  - Plugin system for extensibility  │
└─────────────────────────────────────┘
           ▼
┌─────────────────────────────────────┐
│     Core Modules (Decomposed)       │
│  - minecraft-protocol               │
│  - prismarine-physics               │
│  - prismarine-chunk                 │
│  - minecraft-data                   │
└─────────────────────────────────────┘
           ▼
┌─────────────────────────────────────┐
│      Minecraft Server (RCON)        │
└─────────────────────────────────────┘
```

**Strengths:**
- ✅ Clean separation of concerns via npm packages
- ✅ Event-driven reactive model
- ✅ Well-documented API surface
- ✅ Plugin architecture for extensibility
- ✅ Multi-version support (1.8 - 1.21.8)
- ✅ Battle-tested stability

**Weaknesses:**
- ❌ No built-in AI/autonomy layer
- ❌ No multi-bot coordination
- ❌ No learning/progression system
- ❌ Manual task scripting required

---

### FGD Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Web Dashboard & API Layer                  │
│  - Express routes, WebSocket, Authentication            │
└─────────────────────────────────────────────────────────┘
           ▼
┌─────────────────────────────────────────────────────────┐
│         High-Level AI Orchestration                     │
│  - AutonomicCore (self-healing)                         │
│  - ProgressionEngine (6-phase system)                   │
│  - PolicyEngine (governance)                            │
│  - LLM Bridge (natural language control)                │
└─────────────────────────────────────────────────────────┘
           ▼
┌─────────────────────────────────────────────────────────┐
│            NPC Management Layer                         │
│  - NPCEngine (task queue, dispatch)                     │
│  - NPCSpawner (bot lifecycle)                           │
│  - NPCRegistry (persistent state)                       │
│  - LearningEngine (skill progression)                   │
│  - NPCMicrocore (individual bot AI)                     │
└─────────────────────────────────────────────────────────┘
           ▼
┌─────────────────────────────────────────────────────────┐
│         Minecraft Communication Layer                   │
│  - MinecraftBridge (RCON)                               │
│  - TaskBroker (federation)                              │
│  - FusionCore (knowledge sharing)                       │
└─────────────────────────────────────────────────────────┘
           ▼
┌─────────────────────────────────────────────────────────┐
│              Minecraft Server (RCON)                    │
└─────────────────────────────────────────────────────────┘
```

**Strengths:**
- ✅ Advanced AI/autonomy features
- ✅ Multi-bot coordination and federation
- ✅ Progressive learning system
- ✅ Natural language control via LLM
- ✅ Web dashboard for monitoring
- ✅ Self-healing governance
- ✅ Phase-aware task planning

**Weaknesses:**
- ❌ Uses basic RCON (limited capabilities vs Mineflayer's protocol)
- ❌ Over-complex architecture with many layers
- ❌ Limited direct bot control APIs
- ❌ No physics simulation
- ❌ No pathfinding
- ❌ Missing core Minecraft awareness (chunks, entities, inventory)

---

## Key Differences

| Aspect | Mineflayer | FGD |
|--------|-----------|-----|
| **Primary Focus** | Low-level bot control | High-level AI orchestration |
| **Connection Method** | Minecraft protocol (as player) | RCON (as server operator) |
| **Bot Awareness** | Full world state, entities, inventory | Limited (via RCON commands) |
| **Physics** | Built-in physics engine | None |
| **Pathfinding** | Via plugins (pathfinder) | None |
| **Task Model** | Event-driven, manual scripting | AI-driven, autonomous planning |
| **Multi-bot** | Manual coordination | Built-in federation/coordination |
| **Learning** | None | Progressive skill system |
| **API Complexity** | Simple, direct | Complex, layered |
| **Extensibility** | Plugin system | Modular but tightly coupled |

---

## Critical Improvements for FGD

### 1. **Adopt Mineflayer as the Bot Control Layer** ⭐⭐⭐⭐⭐

**Problem:** FGD uses RCON, which is limited to server commands and lacks:
- Direct bot control (movement, looking, attacking)
- World awareness (blocks, entities, chunks)
- Inventory management
- Physics simulation
- Pathfinding capabilities

**Solution:** Integrate Mineflayer as FGD's bot control layer

```javascript
// NEW: minecraft_bridge_mineflayer.js
import mineflayer from 'mineflayer';
import { pathfinder, Movements, goals } from 'mineflayer-pathfinder';

export class MineflayerBridge {
  constructor(options = {}) {
    this.host = options.host || 'localhost';
    this.port = options.port || 25565;
    this.bots = new Map(); // botId -> mineflayer bot instance
  }

  /**
   * Spawn a bot using Mineflayer
   */
  async spawnBot(botId, options = {}) {
    const bot = mineflayer.createBot({
      host: this.host,
      port: this.port,
      username: botId,
      auth: 'offline',
      version: options.version || '1.20.1'
    });

    // Load essential plugins
    bot.loadPlugin(pathfinder);

    // Wait for spawn
    await new Promise((resolve, reject) => {
      bot.once('spawn', resolve);
      bot.once('error', reject);
    });

    // Store bot instance
    this.bots.set(botId, bot);

    return {
      success: true,
      botId,
      position: bot.entity.position,
      health: bot.health
    };
  }

  /**
   * Move bot to position with pathfinding
   */
  async moveBot(botId, target) {
    const bot = this.bots.get(botId);
    if (!bot) throw new Error(`Bot ${botId} not found`);

    const mcData = require('minecraft-data')(bot.version);
    const movements = new Movements(bot, mcData);
    bot.pathfinder.setMovements(movements);

    const goal = new goals.GoalNear(target.x, target.y, target.z, 1);
    await bot.pathfinder.goto(goal);

    return {
      success: true,
      position: bot.entity.position
    };
  }

  /**
   * Dig a block
   */
  async digBlock(botId, position) {
    const bot = this.bots.get(botId);
    if (!bot) throw new Error(`Bot ${botId} not found`);

    const block = bot.blockAt(position);
    if (!block) throw new Error('No block at position');

    await bot.dig(block);

    return {
      success: true,
      blockType: block.name
    };
  }

  /**
   * Place a block
   */
  async placeBlock(botId, position, blockType) {
    const bot = this.bots.get(botId);
    if (!bot) throw new Error(`Bot ${botId} not found`);

    // Find block in inventory
    const item = bot.inventory.items().find(i => i.name === blockType);
    if (!item) throw new Error(`No ${blockType} in inventory`);

    // Equip and place
    await bot.equip(item, 'hand');
    const referenceBlock = bot.blockAt(position);
    await bot.placeBlock(referenceBlock, new Vec3(0, 1, 0));

    return { success: true };
  }

  /**
   * Get bot state
   */
  getBotState(botId) {
    const bot = this.bots.get(botId);
    if (!bot) return null;

    return {
      position: bot.entity.position,
      health: bot.health,
      food: bot.food,
      inventory: bot.inventory.items().map(i => ({
        name: i.name,
        count: i.count
      })),
      nearbyEntities: Object.values(bot.entities).slice(0, 10).map(e => ({
        type: e.name,
        position: e.position
      }))
    };
  }

  /**
   * Despawn bot
   */
  async despawnBot(botId) {
    const bot = this.bots.get(botId);
    if (!bot) return { success: false };

    bot.quit();
    this.bots.delete(botId);
    return { success: true };
  }
}
```

**Integration into FGD:**
```javascript
// src/services/npc_initializer.js
import { MineflayerBridge } from '../../minecraft_bridge_mineflayer.js';

async initializeMinecraftBridge() {
  // Try Mineflayer first (preferred)
  try {
    this.minecraftBridge = new MineflayerBridge({
      host: process.env.MINECRAFT_HOST || 'localhost',
      port: parseInt(process.env.MINECRAFT_PORT || '25565')
    });
    logger.info('Mineflayer bridge initialized');
  } catch (err) {
    // Fallback to RCON
    logger.warn('Mineflayer unavailable, falling back to RCON');
    // ... existing RCON code ...
  }
}
```

---

### 2. **Implement Modular Plugin Architecture** ⭐⭐⭐⭐

**Problem:** FGD's functionality is tightly coupled. Adding features requires modifying core files.

**Solution:** Adopt Mineflayer's plugin pattern

```javascript
// npc_engine.js - Add plugin support
export class NPCEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.plugins = new Map();
    // ... existing code ...
  }

  /**
   * Load a plugin
   */
  loadPlugin(plugin) {
    if (typeof plugin !== 'function') {
      throw new Error('Plugin must be a function');
    }

    const pluginName = plugin.name || 'anonymous';
    if (this.plugins.has(pluginName)) {
      throw new Error(`Plugin ${pluginName} already loaded`);
    }

    // Inject plugin
    plugin(this);
    this.plugins.set(pluginName, plugin);
    this.emit('plugin_loaded', { name: pluginName });
  }

  /**
   * Unload a plugin
   */
  unloadPlugin(pluginName) {
    if (!this.plugins.has(pluginName)) {
      return false;
    }

    this.plugins.delete(pluginName);
    this.emit('plugin_unloaded', { name: pluginName });
    return true;
  }
}
```

**Example Plugin:**
```javascript
// plugins/auto_heal.js
export function autoHealPlugin(npcEngine) {
  // Add method to engine
  npcEngine.enableAutoHeal = function(botId, threshold = 10) {
    const checkHealth = () => {
      const bot = this.npcs.get(botId);
      if (!bot || !bot.runtime) return;

      const health = bot.runtime.health || 20;
      if (health < threshold) {
        this.handleCommand(`heal ${botId}`, 'auto_heal');
      }
    };

    const interval = setInterval(checkHealth, 5000);
    npcEngine.on('npc_unregistered', (data) => {
      if (data.id === botId) {
        clearInterval(interval);
      }
    });
  };
}
```

---

### 3. **Add Event-Driven Bot Control** ⭐⭐⭐⭐⭐

**Problem:** FGD's NPCMicrocore simulates bot behavior but doesn't react to real Minecraft events.

**Solution:** Bridge Mineflayer events to FGD's event system

```javascript
// core/npc_microcore.js - Enhanced with real Minecraft events
export class NPCMicrocore extends EventEmitter {
  constructor(bot, options = {}) {
    super();
    this.bot = bot;
    this.mineflayerBot = options.mineflayerBot; // NEW: Real bot instance

    if (this.mineflayerBot) {
      this.#bindMineflayerEvents();
    }
  }

  #bindMineflayerEvents() {
    // Real position updates
    this.mineflayerBot.on('move', () => {
      this.state.position = this.mineflayerBot.entity.position;
      this.emit('move', {
        botId: this.bot.id,
        position: this.state.position,
        timestamp: new Date().toISOString()
      });
    });

    // Health changes
    this.mineflayerBot.on('health', () => {
      this.bot.runtime.health = this.mineflayerBot.health;
      this.emit('statusUpdate', this.#buildStatusPayload('health_change'));
    });

    // Entity awareness
    this.mineflayerBot.on('entitySpawn', (entity) => {
      this.#remember(`Detected ${entity.name} at ${entity.position}`);
    });

    // Block updates
    this.mineflayerBot.on('blockUpdate', (oldBlock, newBlock) => {
      this.#remember(`Block changed: ${oldBlock?.name} -> ${newBlock?.name}`);
    });

    // Damage events
    this.mineflayerBot.on('entityHurt', (entity) => {
      if (entity === this.mineflayerBot.entity) {
        this.emit('error', { botId: this.bot.id, error: 'Bot was hurt!' });
      }
    });
  }
}
```

---

### 4. **Simplify Task Execution with Direct Control** ⭐⭐⭐⭐

**Problem:** FGD's task system is abstract and doesn't directly control bots.

**Solution:** Implement concrete task executors using Mineflayer APIs

```javascript
// tasks/executors/mine_executor.js
export class MineTaskExecutor {
  constructor(bridge) {
    this.bridge = bridge;
  }

  async execute(botId, task) {
    const bot = this.bridge.bots.get(botId);
    if (!bot) throw new Error('Bot not found');

    const { blockType, count = 1, area } = task.params;

    let mined = 0;
    while (mined < count) {
      // Find nearest block of type
      const block = bot.findBlock({
        matching: (b) => b.name === blockType,
        maxDistance: area || 32
      });

      if (!block) {
        throw new Error(`No ${blockType} blocks found nearby`);
      }

      // Navigate to block
      await this.bridge.moveBot(botId, block.position);

      // Dig block
      await bot.dig(block);
      mined++;

      // Emit progress
      this.bridge.emit('task_progress', {
        botId,
        task: task.action,
        progress: mined / count
      });
    }

    return {
      success: true,
      mined,
      blockType
    };
  }
}
```

---

### 5. **Add World Awareness APIs** ⭐⭐⭐⭐⭐

**Problem:** FGD has no understanding of the Minecraft world state.

**Solution:** Expose Mineflayer's world query capabilities

```javascript
// minecraft_bridge_mineflayer.js - Add world queries
export class MineflayerBridge {
  // ... existing methods ...

  /**
   * Find blocks in area
   */
  findBlocks(botId, options) {
    const bot = this.bots.get(botId);
    if (!bot) return [];

    return bot.findBlocks({
      matching: options.blockType
        ? (b) => b.name === options.blockType
        : options.matching,
      maxDistance: options.maxDistance || 32,
      count: options.count || 10
    });
  }

  /**
   * Find entities near bot
   */
  findEntities(botId, options = {}) {
    const bot = this.bots.get(botId);
    if (!bot) return [];

    const entities = Object.values(bot.entities).filter(e => {
      if (options.type && e.name !== options.type) return false;
      if (options.maxDistance) {
        const dist = bot.entity.position.distanceTo(e.position);
        if (dist > options.maxDistance) return false;
      }
      return true;
    });

    return entities.map(e => ({
      id: e.id,
      type: e.name,
      position: e.position,
      health: e.metadata?.[7] // Health metadata
    }));
  }

  /**
   * Get blocks in view
   */
  getBlocksInView(botId, distance = 5) {
    const bot = this.bots.get(botId);
    if (!bot) return [];

    const blocks = [];
    const pos = bot.entity.position;

    for (let x = -distance; x <= distance; x++) {
      for (let y = -distance; y <= distance; y++) {
        for (let z = -distance; z <= distance; z++) {
          const block = bot.blockAt(pos.offset(x, y, z));
          if (block) {
            blocks.push({
              position: block.position,
              type: block.name,
              metadata: block.metadata
            });
          }
        }
      }
    }

    return blocks;
  }
}
```

---

### 6. **Improve Error Handling & Recovery** ⭐⭐⭐⭐

**Problem:** FGD has some error handling but lacks robust recovery mechanisms.

**Solution:** Implement Mineflayer-style error recovery with retries

```javascript
// npc_engine/dispatch.js - Enhanced error handling
export class DispatchManager {
  async assignTask(npc, task, options = {}) {
    const maxRetries = options.maxRetries || 3;
    let attempt = 0;
    let lastError = null;

    while (attempt < maxRetries) {
      try {
        // Clear previous errors
        npc.lastError = null;

        // Execute task
        const result = await this.executeTask(npc, task);

        // Success - clear retry count
        npc.failedAttempts = 0;
        return result;

      } catch (error) {
        attempt++;
        lastError = error;
        npc.failedAttempts = (npc.failedAttempts || 0) + 1;

        this.engine.emit('task_error', {
          npcId: npc.id,
          task: task.action,
          error: error.message,
          attempt,
          maxRetries
        });

        // Exponential backoff
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));

          // Try recovery actions
          await this.attemptRecovery(npc, error);
        }
      }
    }

    // All retries failed
    npc.state = 'error';
    npc.lastError = lastError;
    this.engine.emit('task_failed', {
      npcId: npc.id,
      task: task.action,
      error: lastError.message,
      attempts: maxRetries
    });

    throw lastError;
  }

  async attemptRecovery(npc, error) {
    // Recovery strategies based on error type
    if (error.message.includes('health')) {
      // Bot is low health - try to heal
      await this.engine.handleCommand(`heal ${npc.id}`, 'recovery');
    } else if (error.message.includes('inventory')) {
      // Inventory full - drop items
      await this.engine.handleCommand(`clear inventory ${npc.id}`, 'recovery');
    } else if (error.message.includes('stuck')) {
      // Bot is stuck - teleport to safe location
      const safePos = this.engine.defaultSpawnPosition;
      await this.engine.bridge.moveBot(npc.id, safePos);
    }
  }
}
```

---

## Recommended Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
1. ✅ Install Mineflayer and core plugins
2. ✅ Create MineflayerBridge class
3. ✅ Integrate MineflayerBridge into NPCSystem
4. ✅ Test basic bot spawning and movement
5. ✅ Update MinecraftBridge to support both RCON and Mineflayer

### Phase 2: Enhanced Control (Week 3-4)
1. ✅ Implement world awareness APIs
2. ✅ Add inventory management
3. ✅ Create task executors (mine, build, gather)
4. ✅ Bridge Mineflayer events to NPCMicrocore
5. ✅ Update dashboard to show real bot state

### Phase 3: Advanced Features (Week 5-6)
1. ✅ Add pathfinding integration
2. ✅ Implement combat capabilities
3. ✅ Create plugin system
4. ✅ Build example plugins (auto-heal, auto-eat)
5. ✅ Enhanced error recovery

### Phase 4: Optimization (Week 7-8)
1. ✅ Performance tuning
2. ✅ Multi-bot coordination with real physics
3. ✅ Advanced AI behaviors using world state
4. ✅ Documentation and examples
5. ✅ Testing and bug fixes

---

## Architectural Best Practices from Mineflayer

### 1. **Event-Driven Everything**
Mineflayer uses events for all asynchronous operations. FGD should follow this pattern consistently.

```javascript
// Good: Event-driven
bot.on('health', () => {
  if (bot.health < 10) {
    bot.emit('low_health', { health: bot.health });
  }
});

// Bad: Polling
setInterval(() => {
  if (bot.health < 10) {
    handleLowHealth();
  }
}, 1000);
```

### 2. **Composition Over Inheritance**
Mineflayer uses plugins instead of class hierarchies. FGD should adopt this pattern.

```javascript
// Good: Composition via plugins
bot.loadPlugin(pathfinder);
bot.loadPlugin(pvp);

// Bad: Deep inheritance
class CombatBot extends PathfindingBot extends BaseBot { }
```

### 3. **Promise-Based Async**
Use async/await for cleaner async code.

```javascript
// Good
async function mineOre(bot) {
  const ore = bot.findBlock({ matching: 'iron_ore' });
  await bot.pathfinder.goto(ore.position);
  await bot.dig(ore);
}

// Bad
function mineOre(bot, callback) {
  bot.findBlock({ matching: 'iron_ore' }, (ore) => {
    bot.pathfinder.goto(ore.position, () => {
      bot.dig(ore, callback);
    });
  });
}
```

### 4. **Minimal API Surface**
Keep public APIs small and focused. Internal complexity should be hidden.

```javascript
// Good: Simple, focused API
bridge.spawnBot(id, options);
bridge.moveBot(id, target);
bridge.despawnBot(id);

// Bad: Exposing internals
bridge.bots.get(id).mineflayerBot.pathfinder.setMovements(...);
```

---

## Summary

**FGD's Unique Strengths:**
- Multi-bot AI coordination
- Progressive learning system
- Phase-aware autonomy
- Federation capabilities
- LLM integration

**Critical Gaps (Filled by Mineflayer):**
- Direct bot control
- World awareness
- Physics simulation
- Pathfinding
- Inventory management
- Robust error handling

**Recommended Strategy:**
1. **Adopt Mineflayer** as the low-level bot control layer
2. **Keep FGD's AI orchestration** as the high-level intelligence
3. **Bridge the two** with clean interfaces
4. **Maintain FGD's vision** of autonomous, coordinated, learning bots

This creates a **best-of-both-worlds** system: Mineflayer's battle-tested bot control + FGD's innovative AI orchestration.

---

**Next Steps:**
1. Review this document with the team
2. Decide on integration approach
3. Create proof-of-concept with Mineflayer
4. Incrementally migrate FGD to use Mineflayer bridge
5. Maintain backward compatibility during transition

---

## Detailed Feature Breakdown & Implementation Guide

This section provides specific, actionable steps for implementing each Mineflayer feature into FGD.

---

### Feature Category 1: Bot Connection & Lifecycle Management

#### What to Take from Mineflayer
- Bot creation with configurable options
- Connection state management
- Spawn/respawn handling
- Graceful disconnection
- Multi-version support

#### Implementation Steps

**Step 1: Install Dependencies**
```bash
npm install mineflayer
npm install mineflayer-pathfinder
npm install mineflayer-pvp
npm install mineflayer-auto-eat
npm install vec3
```

**Step 2: Create Base MineflayerBridge**
```javascript
// minecraft_bridge_mineflayer.js
import mineflayer from 'mineflayer';
import { Vec3 } from 'vec3';
import EventEmitter from 'events';

export class MineflayerBridge extends EventEmitter {
  constructor(options = {}) {
    super();

    // Configuration
    this.host = options.host || 'localhost';
    this.port = options.port || 25565;
    this.version = options.version || '1.20.1';
    this.auth = options.auth || 'offline';

    // Bot storage
    this.bots = new Map(); // botId -> { bot, state, metadata }

    // Connection tracking
    this.connectionAttempts = new Map();
    this.maxReconnectAttempts = options.maxReconnectAttempts || 3;
    this.reconnectDelay = options.reconnectDelay || 5000;
  }

  /**
   * Create and connect a bot
   */
  async createBot(botId, options = {}) {
    // Check if bot already exists
    if (this.bots.has(botId)) {
      throw new Error(`Bot ${botId} already exists`);
    }

    // Create bot instance
    const bot = mineflayer.createBot({
      host: this.host,
      port: this.port,
      username: botId,
      version: this.version,
      auth: this.auth,
      hideErrors: false,
      ...options
    });

    // Initialize bot metadata
    const botData = {
      bot,
      id: botId,
      state: 'connecting',
      createdAt: Date.now(),
      lastActivity: Date.now(),
      metadata: options.metadata || {}
    };

    // Store bot
    this.bots.set(botId, botData);

    // Set up event handlers
    this._setupBotEventHandlers(botId, bot);

    // Wait for spawn
    await this._waitForSpawn(bot, botId);

    // Update state
    botData.state = 'ready';
    botData.spawnedAt = Date.now();

    this.emit('bot_created', {
      botId,
      position: bot.entity.position,
      dimension: bot.game.dimension
    });

    return {
      success: true,
      botId,
      position: bot.entity.position,
      health: bot.health,
      food: bot.food
    };
  }

  /**
   * Set up comprehensive event handlers for a bot
   */
  _setupBotEventHandlers(botId, bot) {
    // Connection events
    bot.on('login', () => {
      console.log(`[${botId}] Logged in`);
      this.emit('bot_login', { botId });
    });

    bot.on('spawn', () => {
      console.log(`[${botId}] Spawned at`, bot.entity.position);
      this.emit('bot_spawn', {
        botId,
        position: bot.entity.position,
        dimension: bot.game.dimension
      });
    });

    bot.on('respawn', () => {
      console.log(`[${botId}] Respawned`);
      this.emit('bot_respawn', { botId });
    });

    bot.on('end', (reason) => {
      console.log(`[${botId}] Disconnected:`, reason);
      this._handleDisconnection(botId, reason);
    });

    bot.on('error', (err) => {
      console.error(`[${botId}] Error:`, err.message);
      this.emit('bot_error', { botId, error: err.message });
    });

    bot.on('kicked', (reason) => {
      console.log(`[${botId}] Kicked:`, reason);
      this.emit('bot_kicked', { botId, reason });
    });

    // Health events
    bot.on('health', () => {
      const botData = this.bots.get(botId);
      if (botData) {
        botData.lastActivity = Date.now();
      }

      this.emit('bot_health', {
        botId,
        health: bot.health,
        food: bot.food,
        saturation: bot.foodSaturation
      });

      // Critical health warning
      if (bot.health <= 5) {
        this.emit('bot_critical_health', { botId, health: bot.health });
      }
    });

    bot.on('death', () => {
      console.log(`[${botId}] Died`);
      this.emit('bot_death', { botId });
    });

    // Movement events
    bot.on('move', () => {
      this.emit('bot_move', {
        botId,
        position: bot.entity.position,
        velocity: bot.entity.velocity
      });
    });

    // Chat events
    bot.on('chat', (username, message) => {
      this.emit('bot_chat', { botId, username, message });
    });

    bot.on('whisper', (username, message) => {
      this.emit('bot_whisper', { botId, username, message });
    });
  }

  /**
   * Wait for bot to spawn
   */
  _waitForSpawn(bot, botId) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Bot ${botId} spawn timeout`));
      }, 30000); // 30 second timeout

      bot.once('spawn', () => {
        clearTimeout(timeout);
        resolve();
      });

      bot.once('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      bot.once('kicked', (reason) => {
        clearTimeout(timeout);
        reject(new Error(`Kicked during spawn: ${reason}`));
      });
    });
  }

  /**
   * Handle bot disconnection with reconnect logic
   */
  async _handleDisconnection(botId, reason) {
    const botData = this.bots.get(botId);
    if (!botData) return;

    botData.state = 'disconnected';
    botData.disconnectedAt = Date.now();
    botData.disconnectReason = reason;

    this.emit('bot_disconnected', { botId, reason });

    // Check if should attempt reconnect
    const attempts = this.connectionAttempts.get(botId) || 0;

    if (attempts < this.maxReconnectAttempts &&
        !reason.includes('disconnect.quitting')) {

      this.connectionAttempts.set(botId, attempts + 1);

      console.log(`[${botId}] Attempting reconnect ${attempts + 1}/${this.maxReconnectAttempts}`);

      await new Promise(resolve => setTimeout(resolve, this.reconnectDelay));

      try {
        await this.reconnectBot(botId);
        this.connectionAttempts.delete(botId);
      } catch (err) {
        console.error(`[${botId}] Reconnect failed:`, err.message);
      }
    } else {
      console.log(`[${botId}] Max reconnect attempts reached or manual disconnect`);
      this.bots.delete(botId);
      this.connectionAttempts.delete(botId);
    }
  }

  /**
   * Reconnect a disconnected bot
   */
  async reconnectBot(botId) {
    const oldBotData = this.bots.get(botId);
    if (!oldBotData) {
      throw new Error(`Bot ${botId} not found`);
    }

    // Remove old bot
    this.bots.delete(botId);

    // Create new bot with same settings
    return this.createBot(botId, {
      metadata: oldBotData.metadata
    });
  }

  /**
   * Gracefully disconnect a bot
   */
  async disconnectBot(botId) {
    const botData = this.bots.get(botId);
    if (!botData) {
      return { success: false, error: 'Bot not found' };
    }

    const { bot } = botData;

    // Quit gracefully
    bot.quit('Disconnecting');

    // Remove from storage
    this.bots.delete(botId);
    this.connectionAttempts.delete(botId);

    this.emit('bot_removed', { botId });

    return { success: true };
  }

  /**
   * Get bot instance
   */
  getBot(botId) {
    return this.bots.get(botId)?.bot;
  }

  /**
   * Get bot state
   */
  getBotState(botId) {
    const botData = this.bots.get(botId);
    if (!botData) return null;

    const { bot } = botData;

    return {
      id: botId,
      state: botData.state,
      position: bot.entity?.position || null,
      health: bot.health,
      food: bot.food,
      saturation: bot.foodSaturation,
      experience: {
        level: bot.experience.level,
        points: bot.experience.points,
        progress: bot.experience.progress
      },
      gameMode: bot.game.gameMode,
      dimension: bot.game.dimension,
      createdAt: botData.createdAt,
      lastActivity: botData.lastActivity
    };
  }

  /**
   * Get all bot states
   */
  getAllBotStates() {
    return Array.from(this.bots.keys()).map(botId => this.getBotState(botId));
  }

  /**
   * Disconnect all bots
   */
  async disconnectAll() {
    const botIds = Array.from(this.bots.keys());

    await Promise.all(
      botIds.map(botId => this.disconnectBot(botId))
    );

    return { success: true, count: botIds.length };
  }
}
```

**Step 3: Integrate into NPCSystem**
```javascript
// src/services/npc_initializer.js
import { MineflayerBridge } from '../../minecraft_bridge_mineflayer.js';
import { MinecraftBridge } from '../../minecraft_bridge.js'; // RCON fallback

export class NPCSystem {
  async initializeMinecraftBridge() {
    const useMineflayer = process.env.USE_MINEFLAYER !== 'false';

    if (useMineflayer) {
      try {
        this.minecraftBridge = new MineflayerBridge({
          host: process.env.MINECRAFT_HOST || 'localhost',
          port: parseInt(process.env.MINECRAFT_PORT || '25565'),
          version: process.env.MINECRAFT_VERSION || '1.20.1',
          auth: process.env.MINECRAFT_AUTH || 'offline',
          maxReconnectAttempts: 3,
          reconnectDelay: 5000
        });

        // Set up bridge event forwarding
        this._setupBridgeEvents();

        logger.info('Mineflayer bridge initialized');
        console.log('✅ Mineflayer bridge configured');

      } catch (err) {
        logger.error('Failed to initialize Mineflayer bridge', { error: err.message });
        console.log('⚠️  Falling back to RCON bridge');

        // Fallback to RCON
        await this._initializeRCONBridge();
      }
    } else {
      await this._initializeRCONBridge();
    }
  }

  _setupBridgeEvents() {
    // Forward all bridge events to WebSocket clients
    this.minecraftBridge.on('bot_spawn', (data) => {
      this.io.emit('bot:spawned', data);
    });

    this.minecraftBridge.on('bot_health', (data) => {
      this.io.emit('bot:health', data);
    });

    this.minecraftBridge.on('bot_death', (data) => {
      this.io.emit('bot:death', data);
    });

    this.minecraftBridge.on('bot_move', (data) => {
      this.io.emit('bot:move', data);
    });

    this.minecraftBridge.on('bot_disconnected', (data) => {
      this.io.emit('bot:disconnected', data);
    });

    this.minecraftBridge.on('bot_error', (data) => {
      this.io.emit('bot:error', data);
      logger.error('Bot error', data);
    });
  }

  async _initializeRCONBridge() {
    // Existing RCON initialization code...
  }
}
```

**Step 4: Update NPCSpawner**
```javascript
// npc_spawner.js
async _spawnWithRetry(profile, position, options) {
  const retries = options.maxRetries ?? this.maxRetries;
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = this.retryDelay * Math.pow(2, attempt - 1);
        this.log.info('Retrying NPC spawn', { npcId: profile.id, attempt, delay });
        await this._sleep(delay);
      }

      // NEW: Use Mineflayer if available
      if (this.engine.bridge.createBot) {
        const response = await this.engine.bridge.createBot(profile.id, {
          metadata: {
            profile,
            appearance: profile.appearance,
            personality: profile.personalitySummary,
            role: profile.role
          }
        });

        // Clear failure count on success
        if (this.failureCount.has(profile.id)) {
          this.failureCount.delete(profile.id);
        }

        this.log.info('NPC spawned via Mineflayer', { npcId: profile.id });
        return response;

      } else {
        // Fallback to RCON
        const response = await this.engine.spawnNPC?.(profile.id, {
          npcType: profile.npcType,
          position,
          appearance: profile.appearance,
          metadata: profile.metadata,
          profile
        });

        return response;
      }

    } catch (error) {
      lastError = error;
      this.log.warn('Spawn attempt failed', {
        npcId: profile.id,
        attempt: attempt + 1,
        error: error.message
      });
    }
  }

  // All retries exhausted
  this._addToDeadLetterQueue(profile, position, lastError);
  return null;
}
```

---

### Feature Category 2: Movement & Pathfinding

#### What to Take from Mineflayer
- Pathfinding with obstacle avoidance
- Movement goals (GoalNear, GoalBlock, GoalXZ, etc.)
- Physics-aware movement
- Sprint/sneak/jump controls
- Path calculation and visualization

#### Implementation Steps

**Step 1: Add Pathfinding Plugin**
```javascript
// minecraft_bridge_mineflayer.js
import { pathfinder, Movements, goals } from 'mineflayer-pathfinder';
import mcData from 'minecraft-data';

export class MineflayerBridge extends EventEmitter {
  async createBot(botId, options = {}) {
    // ... existing code ...

    // Load pathfinder plugin
    bot.loadPlugin(pathfinder);

    // Configure movements
    const defaultMove = new Movements(bot);
    defaultMove.canDig = options.canDig !== false;
    defaultMove.canPlaceOn = options.canPlaceOn !== false;
    defaultMove.allow1by1towers = options.allow1by1towers !== false;
    defaultMove.allowFreeMotion = options.allowFreeMotion || false;
    defaultMove.allowParkour = options.allowParkour || false;
    defaultMove.allowSprinting = options.allowSprinting !== false;

    bot.pathfinder.setMovements(defaultMove);

    // ... rest of spawn logic ...
  }

  /**
   * Move bot to a position using pathfinding
   */
  async moveToPosition(botId, target, options = {}) {
    const botData = this.bots.get(botId);
    if (!botData) throw new Error(`Bot ${botId} not found`);

    const { bot } = botData;
    const { x, y, z } = target;

    // Create appropriate goal based on options
    let goal;
    const range = options.range || 0;

    if (range > 0) {
      goal = new goals.GoalNear(x, y, z, range);
    } else {
      goal = new goals.GoalBlock(x, y, z);
    }

    // Set movement restrictions if specified
    if (options.movements) {
      const movements = new Movements(bot);
      Object.assign(movements, options.movements);
      bot.pathfinder.setMovements(movements);
    }

    // Start pathfinding
    bot.pathfinder.setGoal(goal);

    // Wait for path completion or failure
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        bot.pathfinder.setGoal(null);
        reject(new Error('Movement timeout'));
      }, options.timeout || 60000);

      const onGoalReached = () => {
        clearTimeout(timeout);
        cleanup();
        resolve({
          success: true,
          position: bot.entity.position,
          distance: bot.entity.position.distanceTo(new Vec3(x, y, z))
        });
      };

      const onPathUpdate = (results) => {
        if (results.status === 'noPath') {
          clearTimeout(timeout);
          cleanup();
          reject(new Error('No path found to target'));
        }
      };

      const onStuck = () => {
        this.emit('bot_stuck', { botId, position: bot.entity.position });
      };

      const cleanup = () => {
        bot.pathfinder.off('goal_reached', onGoalReached);
        bot.pathfinder.off('path_update', onPathUpdate);
        bot.pathfinder.off('stuck', onStuck);
      };

      bot.pathfinder.once('goal_reached', onGoalReached);
      bot.pathfinder.on('path_update', onPathUpdate);
      bot.pathfinder.on('stuck', onStuck);
    });
  }

  /**
   * Follow another entity
   */
  async followEntity(botId, entityId, options = {}) {
    const botData = this.bots.get(botId);
    if (!botData) throw new Error(`Bot ${botId} not found`);

    const { bot } = botData;
    const entity = bot.entities[entityId];

    if (!entity) {
      throw new Error(`Entity ${entityId} not found`);
    }

    const range = options.range || 2;
    const goal = new goals.GoalFollow(entity, range);

    bot.pathfinder.setGoal(goal, true); // dynamic goal

    return {
      success: true,
      following: entity.username || entity.name
    };
  }

  /**
   * Stop current movement
   */
  stopMovement(botId) {
    const botData = this.bots.get(botId);
    if (!botData) return { success: false };

    const { bot } = botData;
    bot.pathfinder.setGoal(null);
    bot.clearControlStates();

    return { success: true };
  }

  /**
   * Manual movement controls
   */
  setMovementControl(botId, control, state) {
    const botData = this.bots.get(botId);
    if (!botData) throw new Error(`Bot ${botId} not found`);

    const { bot } = botData;

    // Valid controls: forward, back, left, right, jump, sprint, sneak
    bot.setControlState(control, state);

    return { success: true };
  }

  /**
   * Look at a position or entity
   */
  async lookAt(botId, target, options = {}) {
    const botData = this.bots.get(botId);
    if (!botData) throw new Error(`Bot ${botId} not found`);

    const { bot } = botData;

    let targetPos;
    if (target.x !== undefined) {
      // Position
      targetPos = new Vec3(target.x, target.y, target.z);
    } else if (typeof target === 'number') {
      // Entity ID
      const entity = bot.entities[target];
      if (!entity) throw new Error('Entity not found');
      targetPos = entity.position.offset(0, entity.height, 0);
    }

    await bot.lookAt(targetPos, options.force || false);

    return {
      success: true,
      yaw: bot.entity.yaw,
      pitch: bot.entity.pitch
    };
  }
}
```

**Step 2: Create Task Executor for Movement**
```javascript
// tasks/executors/movement_executor.js
export class MovementTaskExecutor {
  constructor(bridge) {
    this.bridge = bridge;
  }

  async execute(botId, task) {
    const { action, target, params = {} } = task;

    switch (action) {
      case 'move_to':
        return await this._moveToPosition(botId, target, params);

      case 'follow':
        return await this._follow(botId, target, params);

      case 'patrol':
        return await this._patrol(botId, params.waypoints, params);

      case 'return_home':
        return await this._returnHome(botId, params);

      default:
        throw new Error(`Unknown movement action: ${action}`);
    }
  }

  async _moveToPosition(botId, target, params) {
    try {
      const result = await this.bridge.moveToPosition(botId, target, {
        range: params.range || 1,
        timeout: params.timeout || 60000,
        movements: {
          canDig: params.canDig !== false,
          allowParkour: params.allowParkour || false,
          allowSprinting: params.allowSprinting !== false
        }
      });

      return {
        success: true,
        action: 'move_to',
        ...result
      };
    } catch (error) {
      return {
        success: false,
        action: 'move_to',
        error: error.message
      };
    }
  }

  async _follow(botId, target, params) {
    const result = await this.bridge.followEntity(botId, target, {
      range: params.range || 3
    });

    // Follow is continuous, return immediately
    return {
      success: true,
      action: 'follow',
      ...result
    };
  }

  async _patrol(botId, waypoints, params) {
    if (!Array.isArray(waypoints) || waypoints.length === 0) {
      throw new Error('Waypoints must be a non-empty array');
    }

    const loop = params.loop || false;
    let currentIndex = 0;
    const results = [];

    do {
      for (const waypoint of waypoints) {
        try {
          const result = await this.bridge.moveToPosition(botId, waypoint, params);
          results.push({ waypoint, success: true, ...result });

          // Pause at waypoint
          if (params.pauseAtWaypoint) {
            await new Promise(resolve => setTimeout(resolve, params.pauseAtWaypoint));
          }
        } catch (error) {
          results.push({ waypoint, success: false, error: error.message });

          if (!params.continueOnError) {
            throw error;
          }
        }
      }
      currentIndex++;
    } while (loop && (params.maxLoops ? currentIndex < params.maxLoops : true));

    return {
      success: true,
      action: 'patrol',
      waypoints: waypoints.length,
      loops: currentIndex,
      results
    };
  }

  async _returnHome(botId, params) {
    const botState = this.bridge.getBotState(botId);
    const homePosition = params.home || { x: 0, y: 64, z: 0 };

    return await this._moveToPosition(botId, homePosition, params);
  }
}
```

**Step 3: Integrate into NPCEngine**
```javascript
// npc_engine.js
import { MovementTaskExecutor } from './tasks/executors/movement_executor.js';

export class NPCEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    // ... existing code ...

    // Initialize task executors
    this.taskExecutors = new Map();
    if (options.bridge) {
      this.taskExecutors.set('movement', new MovementTaskExecutor(options.bridge));
    }
  }

  async executeTask(npc, task) {
    const executor = this.taskExecutors.get(task.category || 'movement');

    if (!executor) {
      throw new Error(`No executor found for task category: ${task.category}`);
    }

    return await executor.execute(npc.id, task);
  }
}
```

---

### Feature Category 3: World Awareness & Block Interaction

#### What to Take from Mineflayer
- Block querying and finding
- Block digging with tool selection
- Block placing with proper orientation
- Chunk loading awareness
- Biome detection

#### Implementation Steps

**Step 1: Add World Query Methods**
```javascript
// minecraft_bridge_mineflayer.js

export class MineflayerBridge extends EventEmitter {
  /**
   * Find blocks matching criteria
   */
  findBlocks(botId, options) {
    const botData = this.bots.get(botId);
    if (!botData) return [];

    const { bot } = botData;

    const matching = options.matching || ((block) => {
      if (options.blockType) {
        return block.name === options.blockType;
      }
      if (options.blockTypes) {
        return options.blockTypes.includes(block.name);
      }
      return true;
    });

    const blocks = bot.findBlocks({
      matching,
      maxDistance: options.maxDistance || 32,
      count: options.count || 100,
      useExtraInfo: options.useExtraInfo || false
    });

    return blocks.map(pos => ({
      position: pos,
      block: bot.blockAt(pos)
    }));
  }

  /**
   * Find nearest block of type
   */
  findNearestBlock(botId, blockType, options = {}) {
    const botData = this.bots.get(botId);
    if (!botData) return null;

    const { bot } = botData;

    const block = bot.findBlock({
      matching: (b) => b.name === blockType,
      maxDistance: options.maxDistance || 64
    });

    if (!block) return null;

    return {
      position: block.position,
      type: block.name,
      metadata: block.metadata,
      distance: bot.entity.position.distanceTo(block.position)
    };
  }

  /**
   * Get block at position
   */
  getBlockAt(botId, position) {
    const botData = this.bots.get(botId);
    if (!botData) return null;

    const { bot } = botData;
    const block = bot.blockAt(new Vec3(position.x, position.y, position.z));

    if (!block) return null;

    return {
      position: block.position,
      type: block.name,
      displayName: block.displayName,
      hardness: block.hardness,
      metadata: block.metadata,
      biome: bot.blockAt(block.position.offset(0, -1, 0))?.biome
    };
  }

  /**
   * Dig a block with proper tool
   */
  async digBlock(botId, position, options = {}) {
    const botData = this.bots.get(botId);
    if (!botData) throw new Error(`Bot ${botId} not found`);

    const { bot } = botData;
    const block = bot.blockAt(new Vec3(position.x, position.y, position.z));

    if (!block) {
      throw new Error('No block at position');
    }

    // Check if bot can dig this block
    if (!bot.canDigBlock(block)) {
      throw new Error(`Cannot dig ${block.name}`);
    }

    // Equip best tool if requested
    if (options.equipTool !== false) {
      await this._equipBestTool(bot, block);
    }

    // Start digging
    await bot.dig(block, options.forceLook !== false);

    return {
      success: true,
      blockType: block.name,
      position: block.position
    };
  }

  /**
   * Place a block
   */
  async placeBlock(botId, position, blockType, options = {}) {
    const botData = this.bots.get(botId);
    if (!botData) throw new Error(`Bot ${botId} not found`);

    const { bot } = botData;

    // Find item in inventory
    const item = bot.inventory.items().find(i => i.name === blockType);
    if (!item) {
      throw new Error(`No ${blockType} in inventory`);
    }

    // Equip item
    await bot.equip(item, 'hand');

    // Get reference block
    const refBlock = bot.blockAt(new Vec3(position.x, position.y, position.z));
    if (!refBlock) {
      throw new Error('No reference block at position');
    }

    // Determine face vector
    const faceVector = options.faceVector || new Vec3(0, 1, 0);

    // Place block
    await bot.placeBlock(refBlock, faceVector);

    return {
      success: true,
      blockType,
      position: refBlock.position.plus(faceVector)
    };
  }

  /**
   * Equip best tool for block
   */
  async _equipBestTool(bot, block) {
    const tools = bot.inventory.items().filter(item => {
      return item.name.includes('pickaxe') ||
             item.name.includes('shovel') ||
             item.name.includes('axe');
    });

    if (tools.length === 0) return;

    // Find best tool (simplified - could use proper tool effectiveness)
    let bestTool = tools[0];
    let bestTime = block.digTime(bestTool);

    for (const tool of tools) {
      const digTime = block.digTime(tool);
      if (digTime < bestTime) {
        bestTime = digTime;
        bestTool = tool;
      }
    }

    await bot.equip(bestTool, 'hand');
  }

  /**
   * Get blocks in area
   */
  getBlocksInArea(botId, start, end) {
    const botData = this.bots.get(botId);
    if (!botData) return [];

    const { bot } = botData;
    const blocks = [];

    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);
    const minZ = Math.min(start.z, end.z);
    const maxZ = Math.max(start.z, end.z);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const block = bot.blockAt(new Vec3(x, y, z));
          if (block) {
            blocks.push({
              position: block.position,
              type: block.name,
              metadata: block.metadata
            });
          }
        }
      }
    }

    return blocks;
  }

  /**
   * Get blocks bot can see
   */
  getVisibleBlocks(botId, maxDistance = 128) {
    const botData = this.bots.get(botId);
    if (!botData) return [];

    const { bot } = botData;
    const targetBlock = bot.blockAtCursor(maxDistance);

    if (!targetBlock) return [];

    // Get blocks in line of sight
    const blocks = [];
    const start = bot.entity.position.offset(0, bot.entity.height, 0);
    const direction = targetBlock.position.minus(start).normalize();

    for (let i = 0; i < maxDistance; i++) {
      const pos = start.plus(direction.scaled(i)).floor();
      const block = bot.blockAt(pos);

      if (block && block.name !== 'air') {
        blocks.push({
          position: block.position,
          type: block.name,
          metadata: block.metadata,
          distance: start.distanceTo(block.position)
        });
      }
    }

    return blocks;
  }
}
```

**Step 2: Create Mining Task Executor**
```javascript
// tasks/executors/mining_executor.js
export class MiningTaskExecutor {
  constructor(bridge) {
    this.bridge = bridge;
  }

  async execute(botId, task) {
    const { action, params = {} } = task;

    switch (action) {
      case 'mine_blocks':
        return await this._mineBlocks(botId, params);

      case 'mine_vein':
        return await this._mineVein(botId, params);

      case 'strip_mine':
        return await this._stripMine(botId, params);

      default:
        throw new Error(`Unknown mining action: ${action}`);
    }
  }

  async _mineBlocks(botId, params) {
    const { blockType, count = 1, area = 32, equipTool = true } = params;
    const mined = [];
    const errors = [];

    for (let i = 0; i < count; i++) {
      try {
        // Find nearest block
        const nearest = this.bridge.findNearestBlock(botId, blockType, { maxDistance: area });

        if (!nearest) {
          throw new Error(`No ${blockType} blocks found within ${area} blocks`);
        }

        // Move to block
        await this.bridge.moveToPosition(botId, nearest.position, { range: 4 });

        // Dig block
        const result = await this.bridge.digBlock(botId, nearest.position, { equipTool });

        mined.push(result);

      } catch (error) {
        errors.push({ index: i, error: error.message });

        if (!params.continueOnError) {
          break;
        }
      }
    }

    return {
      success: errors.length === 0,
      action: 'mine_blocks',
      mined: mined.length,
      target: count,
      blocks: mined,
      errors
    };
  }

  async _mineVein(botId, params) {
    const { blockType, maxBlocks = 100 } = params;
    const mined = [];
    const checked = new Set();

    const mineConnected = async (position) => {
      const key = `${position.x},${position.y},${position.z}`;

      if (checked.has(key) || mined.length >= maxBlocks) {
        return;
      }

      checked.add(key);

      // Check if this block is the target type
      const block = this.bridge.getBlockAt(botId, position);
      if (!block || block.type !== blockType) {
        return;
      }

      // Mine this block
      try {
        await this.bridge.moveToPosition(botId, position, { range: 4 });
        const result = await this.bridge.digBlock(botId, position);
        mined.push(result);
      } catch (error) {
        console.error(`Failed to mine block at ${key}:`, error.message);
        return;
      }

      // Check adjacent blocks
      const adjacent = [
        { x: 1, y: 0, z: 0 },
        { x: -1, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
        { x: 0, y: -1, z: 0 },
        { x: 0, y: 0, z: 1 },
        { x: 0, y: 0, z: -1 }
      ];

      for (const offset of adjacent) {
        await mineConnected({
          x: position.x + offset.x,
          y: position.y + offset.y,
          z: position.z + offset.z
        });
      }
    };

    // Start from first found block
    const start = this.bridge.findNearestBlock(botId, blockType);
    if (!start) {
      return {
        success: false,
        action: 'mine_vein',
        error: `No ${blockType} found`
      };
    }

    await mineConnected(start.position);

    return {
      success: true,
      action: 'mine_vein',
      blockType,
      mined: mined.length,
      blocks: mined
    };
  }

  async _stripMine(botId, params) {
    const { length = 50, branches = 4, spacing = 3 } = params;
    const mined = [];

    // Main tunnel
    // Implementation would create tunnels in a strip mining pattern
    // This is a simplified version

    return {
      success: true,
      action: 'strip_mine',
      mined: mined.length
    };
  }
}
```

---

I'll continue adding more feature categories. Would you like me to continue with:
1. Inventory Management
2. Combat System
3. Entity Interaction
4. Crafting & Recipes
5. Chat & Communication
6. Plugin System Implementation

Or would you prefer I commit what we have so far and continue in a follow-up?
