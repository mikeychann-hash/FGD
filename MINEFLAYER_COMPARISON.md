# Mineflayer vs FGD Comparison - Quick Reference

**Date:** 2025-11-09
**Purpose:** API reference and integration guide for Mineflayer adoption in FGD

---

## Executive Summary

| Aspect | Mineflayer | FGD |
|--------|-----------|-----|
| **Scope** | Low-level bot control | High-level AI orchestration |
| **Strengths** | Event-driven, plugin system, stable | Multi-bot coordination, learning, LLM bridge |
| **Gaps** | No autonomy/AI | Needs robust bot control layer |
| **Solution** | FGD wraps Mineflayer for AI orchestration |

---

## Key Function Categories (Implementation Priority)

### Category 1: Connection & Lifecycle
**Purpose:** Bot spawning, connecting, and cleanup
- `createBot(botId, options)` - Spawn bot instance
- `disconnectBot(botId)` - Clean disconnect
- `getBot(botId)` - Retrieve active bot
- `listBots()` - Get all connected bots

**Mineflayer Events:** `spawn`, `end`, `error`, `kicked`

---

### Category 2: Movement & Navigation
**Purpose:** Pathfinding, following entities, goal-based movement
- `moveToPosition(botId, pos, options)` - Navigate to coordinate
- `followEntity(botId, entityId, range)` - Track entity
- `stopMovement(botId)` - Halt movement
- `getPosition(botId)` - Get bot location

**Mineflayer API:** `mineflayer-pathfinder` plugin with GoalNear/GoalFollow/GoalBlock

---

### Category 3: Mining & Block Interaction
**Purpose:** Block detection, digging, placement
- `findBlock(botId, blockName, range)` - Locate blocks
- `digBlock(botId, pos, options)` - Mine block
- `placeBlock(botId, pos, face)` - Place block
- `selectTool(botId, itemId)` - Equip tool

**Mineflayer API:** `bot.blockAt()`, `bot.dig()`, `bot.placeBlock()`

---

### Category 4: Inventory Management
**Purpose:** Item tracking, equipment, storage interaction
- `getInventory(botId)` - List items
- `equipItem(botId, item, destination)` - Equip/store
- `openChest(botId, pos)` - Access container
- `dropItem(botId, itemId, count)` - Drop item

**Mineflayer API:** `bot.inventory`, `bot.openChest()`, `bot.windowOpen.deposit()`

---

### Category 5: Combat System
**Purpose:** Entity targeting, attacking, defense
- `attackEntity(botId, entityId)` - Attack target
- `defendAgainstHostiles(botId, options)` - Auto-defend
- `getEntities(botId, filter)` - List entities
- `getHealth(botId)` - Get bot health

**Mineflayer API:** `mineflayer-pvp` plugin, `bot.attack()`, `bot.health`, `bot.entity`

---

### Category 6: Entity Interaction
**Purpose:** Trading, breeding, mounting
- `tradeWithVillager(botId, villagerPos, offers)` - Trade
- `breedAnimals(botId, pos)` - Animal breeding
- `mountEntity(botId, entityId)` - Mount/ride

**Mineflayer API:** `bot.trade()`, breeding mechanics via items

---

### Category 7: Crafting System
**Purpose:** Recipe lookup, crafting operations
- `getCraftingRecipe(botId, itemName)` - Find recipe
- `craftItem(botId, recipe, count)` - Craft item
- `furnaceSmelt(botId, item, fuel)` - Furnace operation

**Mineflayer API:** `minecraft-data` for recipes, `bot.recipesFor()`

---

### Category 8: Chat & Communication
**Purpose:** Server communication, commands
- `sendChat(botId, message)` - Send message
- `sendWhisper(botId, playerName, message)` - Private msg
- `executeCommand(botId, command)` - Run command

**Mineflayer API:** `bot.chat()`, custom command handling

---

### Category 9: Plugin System
**Purpose:** Extensibility framework
- `loadPlugin(botId, pluginName)` - Load plugin
- Built-in plugins: `mineflayer-auto-eat`, `mineflayer-collectblock`
- Custom plugin pattern: `function inject(bot, options) { ... }`

---

## MineflayerBridge Class Skeleton

```javascript
class MineflayerBridge {
  constructor(options) {
    this.options = options;
    this.bots = new Map();
    this.eventEmitter = new EventEmitter();
  }

  async createBot(botId, options) {
    // Connect via mineflayer.createBot()
    // Register event listeners
    // Return { success, botId, message }
  }

  async disconnectBot(botId) {
    // Quit bot and cleanup
  }

  async moveToPosition(botId, pos, options) {
    // Use pathfinder plugin with goal
  }

  async digBlock(botId, pos, options) {
    // Find block, select tool, dig
  }

  async getInventory(botId) {
    // Return inventory array
  }

  // ... other methods per categories 1-9
}
```

---

## Implementation Strategy

### Phase 1: Foundation (Days 1-2)
1. Install dependencies: mineflayer, mineflayer-pathfinder, mineflayer-pvp, minecraft-data
2. Create MineflayerBridge class with connection/lifecycle (Category 1)
3. Integrate with NPCEngine

### Phase 2: Core Features (Days 2-3)
4. Movement & pathfinding (Category 2)
5. Mining & interaction (Category 3)
6. Inventory management (Category 4)

### Phase 3: Advanced Features (Days 3-4)
7. Combat system (Category 5)
8. Entity interaction (Category 6)
9. Crafting & chat (Categories 7-8)
10. Plugin system (Category 9)

### Phase 4: Integration & Testing (Days 4-5)
11. API endpoint wrappers
12. WebSocket event forwarding
13. Comprehensive testing

---

## Key Differences from RCON Approach

| Feature | RCON (Current) | Mineflayer |
|---------|---|---|
| **Real-time state** | Limited (polls) | Event-driven |
| **Position tracking** | Via coords command | Native `bot.entity.position` |
| **Inventory access** | Command output parsing | Native `bot.inventory` |
| **Block detection** | Difficult/unreliable | Native `bot.blockAt()` |
| **Entity tracking** | None | Native `bot.entities` |
| **Latency** | High (~100-500ms) | Low (~10-50ms) |
| **Learning curve** | Medium | Moderate |

---

## Mineflayer API Cheat Sheet

```javascript
// Connection
const bot = mineflayer.createBot({
  host: 'localhost',
  port: 25565,
  username: 'BotName'
});

// Movement
const pathfinder = require('mineflayer-pathfinder');
const { GoalNear, GoalBlock } = pathfinder.goals;
bot.loadPlugin(pathfinder.pathfinder);
bot.pathfinder.setGoal(new GoalNear(x, y, z, 1));

// Block interaction
const block = bot.blockAt(new Vec3(x, y, z));
await bot.dig(block);
await bot.placeBlock(block, new Vec3(0, 1, 0));

// Inventory
bot.inventory.items(); // All items
bot.equip(item, 'head'); // Equip item
await bot.openChest(chestBlock);

// Combat
const pvp = require('mineflayer-pvp');
bot.loadPlugin(pvp.PvP);
bot.pvp.attack(targetEntity);

// Chat
bot.chat('Hello world');
bot.whisper(playerName, 'Private message');

// Crafting
const recipes = bot.recipesFor(mcData.itemsByName.wood);
bot.craft(recipes[0], 1);
```

---

## Integration Checklist

- [ ] Install all Mineflayer dependencies
- [ ] Create MineflayerBridge class
- [ ] Implement Category 1 (Connection) functions
- [ ] Update NPCEngine to use MineflayerBridge
- [ ] Implement Category 2-3 (Movement, Mining)
- [ ] Add API endpoints for bot control
- [ ] Implement Categories 4-9
- [ ] Create WebSocket forwarding for events
- [ ] Write comprehensive tests
- [ ] Update documentation

---

## Testing Quick Start

```javascript
// Unit test example
const bridge = new MineflayerBridge({ host: 'localhost' });
const result = await bridge.createBot('test-bot', { username: 'TestBot' });
assert(result.success === true);
assert(result.botId === 'test-bot');

// Integration test
await bridge.moveToPosition('test-bot', { x: 100, y: 64, z: 100 });
await bridge.digBlock('test-bot', { x: 99, y: 63, z: 100 });
```

---

## References

- [Mineflayer GitHub](https://github.com/PrismarineJS/mineflayer)
- [mineflayer-pathfinder](https://github.com/PrismarineJS/mineflayer-pathfinder)
- [mineflayer-pvp](https://github.com/PrismarineJS/mineflayer-pvp)
- [minecraft-data](https://github.com/PrismarineJS/minecraft-data)
- [FGD Implementation Plan](./IMPLEMENTATION_PLAN.md)
- [FGD Bug Report](./BUG_REPORT.md)
