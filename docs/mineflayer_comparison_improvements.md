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

