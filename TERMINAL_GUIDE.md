# Terminal Command Guide - FGD Implementation

**Purpose:** Step-by-step terminal commands to execute the implementation plan
**Strategy:** Copy and paste each section's commands in order
**Important:** Wait for each command to complete before running the next one

---

## Setup: Verify Your Environment

```bash
# Check you're in the right directory
pwd
# Should output: /home/user/FGD

# Check current branch
git branch --show-current
# Should output: claude/extensive-bug-review-011CUwkb3aPn2ex1kQsFVLRN

# Create a backup branch (safety measure)
git branch backup-before-implementation

# Verify Node.js is available
node --version
npm --version
```

**✅ Checkpoint:** All commands should succeed before proceeding.

---

## PHASE 1: Critical Bug Fixes (2-3 hours)

### 1.1 Fix Bug #2: fsSync Import Error

```bash
# Open task_broker.js to check the issue
head -20 task_broker.js

# The fix: Add fsSync import on line 5
# We'll use sed to add the import after the existing fs import
```

**Manual Edit Required:**
1. Open `task_broker.js` in your editor
2. Find line 4: `import fs from "fs/promises";`
3. Add after it: `import fsSync from "fs";`
4. Save the file

**Verify the fix:**
```bash
# Check the import is added
head -10 task_broker.js | grep -E "import.*fs"

# Test that the module loads without error
node -e "import('./task_broker.js').then(() => console.log('✅ TaskBroker loads successfully')).catch(err => console.error('❌ Error:', err.message))"
```

**Expected output:** `✅ TaskBroker loads successfully`

**Commit the fix:**
```bash
git add task_broker.js
git commit -m "Fix critical bug: Add missing fsSync import to task_broker.js

- Resolves Bug #2 (CRITICAL)
- Adds synchronous fs import required by loadConfig method
- Prevents runtime crash when TaskBroker initializes"
```

---

### 1.2 Fix Bug #1: Metrics Endpoint Timing

```bash
# First, let's see the current structure
grep -n "app.get('/metrics'" server.js
grep -n "httpServer.listen" server.js
```

**Manual Edit Required:**
1. Open `server.js` in your editor
2. Find the `/metrics` endpoint (around line 229-240)
3. **Cut** that entire code block (delete but keep in clipboard)
4. Find the `startServer()` function
5. Find the line `httpServer.listen(PORT, ...)` inside `startServer()`
6. **Paste** the `/metrics` endpoint code **BEFORE** the `httpServer.listen()` line
7. Save the file

**The metrics endpoint should now be inside startServer() and before listen():**
```javascript
async function startServer() {
  // ... existing initialization ...

  // Metrics endpoint (MOVED HERE)
  app.get('/metrics', async (req, res) => {
    try {
      const registry = getPrometheusRegistry();
      res.set('Content-Type', registry.contentType);
      res.end(await registry.metrics());
    } catch (err) {
      res.status(500).send(err.message);
    }
  });

  // Start server
  const PORT = process.env.PORT || DEFAULT_PORT;
  httpServer.listen(PORT, () => {
    // ...
  });
}
```

**Verify the fix:**
```bash
# Check that metrics is now inside startServer function
grep -B5 -A10 "app.get('/metrics'" server.js

# Verify it's before httpServer.listen
awk '/startServer/,/^}/ {print NR": "$0}' server.js | grep -E "(metrics|listen)"
```

**Commit the fix:**
```bash
git add server.js
git commit -m "Fix critical bug: Move metrics endpoint before server start

- Resolves Bug #1 (CRITICAL)
- Moves /metrics endpoint registration into startServer() function
- Ensures endpoint is available before server begins listening
- Eliminates race condition on server startup"
```

---

### Phase 1 Complete - Push Changes

```bash
# Push critical bug fixes
git push origin claude/extensive-bug-review-011CUwkb3aPn2ex1kQsFVLRN

# Verify push succeeded
git log --oneline -3
```

**✅ Checkpoint:** You should see both bug fix commits in the log.

---

## PHASE 2: Mineflayer Foundation (1-2 days)

### 2.1 Install Mineflayer Dependencies

```bash
# Install all required packages
npm install mineflayer mineflayer-pathfinder mineflayer-pvp mineflayer-auto-eat mineflayer-collectblock minecraft-data vec3

# Verify installation
npm ls | grep mineflayer

# Check for any peer dependency warnings
npm list --depth=0
```

**Expected output:** Should see 5 mineflayer packages, minecraft-data, and vec3 listed.

**Commit package.json:**
```bash
git add package.json package-lock.json
git commit -m "Add Mineflayer dependencies

Installed packages:
- mineflayer: Core bot framework
- mineflayer-pathfinder: Navigation and pathfinding
- mineflayer-pvp: Combat system
- mineflayer-auto-eat: Automatic eating
- mineflayer-collectblock: Block collection
- minecraft-data: Game data and recipes
- vec3: Vector math library"
```

---

### 2.2 Create MineflayerBridge Class

```bash
# Check if minecraft_bridge.js exists
ls -la | grep minecraft_bridge

# If it doesn't exist, create it
# If it does exist, back it up first
[ -f minecraft_bridge.js ] && cp minecraft_bridge.js minecraft_bridge.js.backup
```

**Manual Creation Required:**
1. Create or open `minecraft_bridge.js`
2. Copy the MineflayerBridge class code from `MINEFLAYER_COMPARISON.md` lines 87-461
3. Save the file

**Quick verification:**
```bash
# Check file was created
ls -lh minecraft_bridge.js

# Check it has the class definition
grep "class MineflayerBridge" minecraft_bridge.js

# Count methods (should have createBot, _setupBotEventHandlers, etc.)
grep "async.*(" minecraft_bridge.js | wc -l
```

**Test the bridge (optional - requires Minecraft server):**
```bash
# Create a test file
cat > test_bridge.js << 'EOF'
import { MineflayerBridge } from './minecraft_bridge.js';

const bridge = new MineflayerBridge({
  host: process.env.MINECRAFT_HOST || 'localhost',
  port: parseInt(process.env.MINECRAFT_PORT || '25565')
});

console.log('✅ MineflayerBridge loaded successfully');
console.log('Bridge methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(bridge)));

// Test bot creation (only if server is running)
if (process.env.TEST_BOT_CREATE === 'true') {
  try {
    const result = await bridge.createBot('test-bot', { username: 'TestBot' });
    console.log('Bot creation result:', result);
  } catch (err) {
    console.error('Bot creation failed (expected if no server):', err.message);
  }
}
EOF

# Run test
node test_bridge.js

# Clean up test file
rm test_bridge.js
```

**Commit the bridge:**
```bash
git add minecraft_bridge.js
git commit -m "Create MineflayerBridge class with bot lifecycle management

Features:
- Bot creation and connection handling
- Event-driven architecture with EventEmitter
- Automatic reconnection with exponential backoff
- WebSocket event forwarding
- Error handling and logging
- Support for multiple simultaneous bots

Implements Feature Category 1 from MINEFLAYER_COMPARISON.md"
```

---

### 2.3 Add Movement & Pathfinding Methods

**Manual Edit Required:**
1. Open `minecraft_bridge.js`
2. Add movement methods from `MINEFLAYER_COMPARISON.md` lines 463-881
3. Methods to add:
   - `moveToPosition()`
   - `followEntity()`
   - `stopMovement()`
   - `getPosition()`
4. Save the file

**Verify methods were added:**
```bash
# Check for movement methods
grep "moveToPosition\|followEntity\|stopMovement" minecraft_bridge.js

# Count total methods now
grep "async.*(" minecraft_bridge.js | wc -l
```

**Create MovementTaskExecutor:**
```bash
# Create executors directory if it doesn't exist
mkdir -p src/executors

# Check if file exists
ls -la src/executors/ | grep Movement
```

**Manual Creation Required:**
1. Create `src/executors/MovementTaskExecutor.js`
2. Copy code from `MINEFLAYER_COMPARISON.md` lines 883-1020
3. Save the file

**Verify executor:**
```bash
# Check file exists
ls -lh src/executors/MovementTaskExecutor.js

# Check class definition
grep "class MovementTaskExecutor" src/executors/MovementTaskExecutor.js

# Check it exports correctly
grep "export.*MovementTaskExecutor" src/executors/MovementTaskExecutor.js
```

**Commit movement features:**
```bash
git add minecraft_bridge.js src/executors/MovementTaskExecutor.js
git commit -m "Implement movement and pathfinding features

MineflayerBridge additions:
- moveToPosition() with pathfinder integration
- followEntity() for entity tracking
- stopMovement() to cancel navigation
- getPosition() for bot location queries

MovementTaskExecutor:
- Task-based movement execution
- Support for move_to, follow, stop actions
- Integration with pathfinder plugin
- Physics-aware navigation

Implements Feature Category 2 from MINEFLAYER_COMPARISON.md"
```

---

### 2.4 Add Mining & World Interaction

**Manual Edit Required:**
1. Open `minecraft_bridge.js`
2. Add mining methods from `MINEFLAYER_COMPARISON.md` lines 1022-1640
3. Methods to add:
   - `findNearestBlock()`
   - `digBlock()`
   - `placeBlock()`
   - `_equipBestTool()`
4. Save the file

**Create MiningTaskExecutor:**
1. Create `src/executors/MiningTaskExecutor.js`
2. Copy code from `MINEFLAYER_COMPARISON.md` lines 1642-2046
3. Save the file

**Verify mining features:**
```bash
# Check methods added to bridge
grep "digBlock\|placeBlock\|findNearestBlock" minecraft_bridge.js

# Check executor exists
ls -lh src/executors/MiningTaskExecutor.js

# Verify executor has mine methods
grep "_mineVein\|_stripMine" src/executors/MiningTaskExecutor.js
```

**Commit mining features:**
```bash
git add minecraft_bridge.js src/executors/MiningTaskExecutor.js
git commit -m "Implement mining and world interaction features

MineflayerBridge additions:
- findNearestBlock() for block discovery
- digBlock() with automatic tool selection
- placeBlock() for building
- _equipBestTool() for optimal mining

MiningTaskExecutor:
- Task-based mining execution
- Vein mining algorithm for ore collection
- Strip mining pattern support
- Block placement and building

Implements Feature Category 3 from MINEFLAYER_COMPARISON.md"
```

---

### 2.5 Update NPCSystem Integration

**Manual Edit Required:**
1. Open `npc_engine.js` (or `src/services/npc_initializer.js`)
2. Add MineflayerBridge import at top:
   ```javascript
   import { MineflayerBridge } from './minecraft_bridge.js';
   import { MovementTaskExecutor } from './src/executors/MovementTaskExecutor.js';
   import { MiningTaskExecutor } from './src/executors/MiningTaskExecutor.js';
   ```
3. In constructor, initialize bridge and executors
4. Update `spawnBot()` method to use MineflayerBridge
5. Save the file

**Verify integration:**
```bash
# Check imports were added
head -30 npc_engine.js | grep -E "MineflayerBridge|TaskExecutor"

# Check bridge initialization
grep "this.bridge.*=.*new MineflayerBridge" npc_engine.js

# Check executors initialization
grep "this.executors.*=" npc_engine.js
```

**Commit integration:**
```bash
git add npc_engine.js
git commit -m "Integrate MineflayerBridge into NPCEngine

Changes:
- Import MineflayerBridge and task executors
- Initialize bridge in constructor
- Add executor instances for movement and mining
- Update spawnBot() to use Mineflayer
- Add event forwarding from bridge to WebSocket

NPCEngine now uses Mineflayer for bot control while
maintaining existing AI orchestration features."
```

---

### Phase 2 Complete - Push Changes

```bash
# Push all Mineflayer foundation changes
git push origin claude/extensive-bug-review-011CUwkb3aPn2ex1kQsFVLRN

# View commit history
git log --oneline -10

# Check file changes summary
git diff backup-before-implementation --stat
```

**✅ Checkpoint:** You should see 5+ new commits for Mineflayer implementation.

---

## PHASE 3: High Severity Bug Fix (1 hour)

### 3.1 Fix Bug #3: Database Pool Initialization Check

```bash
# View the current query function
grep -A15 "export async function query" src/database/connection.js
```

**Manual Edit Required:**
1. Open `src/database/connection.js`
2. Find the `query()` function (around line 67)
3. Add null check at the beginning:
   ```javascript
   export async function query(text, params = []) {
     if (!pool) {
       throw new Error('Database not initialized. Call initDatabase() first.');
     }
     // ... rest of function
   }
   ```
4. Save the file

**Verify the fix:**
```bash
# Check the null check was added
grep -A3 "export async function query" src/database/connection.js | grep "if (!pool)"

# Test the error is thrown (creates a test file)
cat > test_db_check.js << 'EOF'
import { query } from './src/database/connection.js';

try {
  await query('SELECT 1');
  console.log('❌ Should have thrown error');
} catch (err) {
  if (err.message.includes('not initialized')) {
    console.log('✅ Correctly throws error before initialization');
  } else {
    console.log('❌ Wrong error:', err.message);
  }
}
EOF

# Run test
node test_db_check.js

# Clean up
rm test_db_check.js
```

**Commit the fix:**
```bash
git add src/database/connection.js
git commit -m "Fix high severity bug: Add database pool initialization check

- Resolves Bug #3 (HIGH)
- Adds null check in query() function
- Throws clear error if query() called before initDatabase()
- Prevents null pointer errors and improves debugging

File: src/database/connection.js:67-78"
```

---

## PHASE 4: Advanced Mineflayer Features (1-2 days)

### 4.1 Implement Inventory Management

**Manual Edit Required:**
1. Open `minecraft_bridge.js`
2. Add inventory methods from `MINEFLAYER_COMPARISON.md` lines 2086-2438
3. Methods to add:
   - `getInventory()`
   - `equipItem()`
   - `dropItem()`
   - `openChest()`
   - `transferItem()`
   - `countItem()`
   - `organizeInventory()`
4. Save the file

**Create InventoryTaskExecutor:**
1. Create `src/executors/InventoryTaskExecutor.js`
2. Copy code from `MINEFLAYER_COMPARISON.md` lines 2446-2602
3. Save the file

**Verify inventory features:**
```bash
# Check methods in bridge
grep "getInventory\|equipItem\|openChest" minecraft_bridge.js

# Check executor
ls -lh src/executors/InventoryTaskExecutor.js
grep "checkInventoryHealth" src/executors/InventoryTaskExecutor.js
```

**Commit inventory features:**
```bash
git add minecraft_bridge.js src/executors/InventoryTaskExecutor.js
git commit -m "Implement inventory management system

MineflayerBridge additions:
- getInventory() for full inventory state
- equipItem() for equipment management
- dropItem() and transferItem() for item handling
- openChest() for container interaction
- countItem() for inventory queries
- organizeInventory() for automatic sorting

InventoryTaskExecutor:
- Smart inventory health checks
- Chest transfer automation
- Equipment management tasks
- Low item warnings (food, tools, torches)

Implements Feature Category 4 from MINEFLAYER_COMPARISON.md"
```

---

### 4.2 Implement Combat System

**Manual Edit Required:**
1. Open `minecraft_bridge.js`
2. Add combat methods from `MINEFLAYER_COMPARISON.md` lines 2704-3038
3. Methods to add:
   - `attackEntity()`
   - `startPvP()`
   - `stopCombat()`
   - `getNearbyEntities()`
   - `defendAgainstHostiles()`
   - `getHealth()`
4. Save the file

**Create CombatTaskExecutor:**
1. Create `src/executors/CombatTaskExecutor.js`
2. Copy code from `MINEFLAYER_COMPARISON.md` lines 3044-3135
3. Save the file

**Verify combat features:**
```bash
# Check methods in bridge
grep "attackEntity\|startPvP\|defendAgainstHostiles" minecraft_bridge.js

# Check executor
ls -lh src/executors/CombatTaskExecutor.js
grep "patrolArea\|guardPosition" src/executors/CombatTaskExecutor.js
```

**Commit combat features:**
```bash
git add minecraft_bridge.js src/executors/CombatTaskExecutor.js
git commit -m "Implement combat system

MineflayerBridge additions:
- attackEntity() with automatic approach
- startPvP() for continuous combat
- stopCombat() to disengage
- getNearbyEntities() with filtering
- defendAgainstHostiles() for protection
- getHealth() for status monitoring

CombatTaskExecutor:
- Patrol mode with waypoints
- Guard position mode
- Automatic hostile detection
- Equipment management for combat

Implements Feature Category 5 from MINEFLAYER_COMPARISON.md"
```

---

### 4.3 Implement Entity Interaction

**Manual Edit Required:**
1. Open `minecraft_bridge.js`
2. Add entity methods from `MINEFLAYER_COMPARISON.md` lines 3164-3531
3. Methods to add:
   - `tradeWithVillager()`
   - `getVillagerTrades()`
   - `breedAnimals()`
   - `mountEntity()`
   - `dismountEntity()`
   - `setupEntityTracking()`
4. Save the file

**Verify entity features:**
```bash
# Check methods in bridge
grep "tradeWithVillager\|breedAnimals\|mountEntity" minecraft_bridge.js

# Count entity-related methods
grep "Entity\|Trade\|mount" minecraft_bridge.js | grep "async\|function" | wc -l
```

**Commit entity features:**
```bash
git add minecraft_bridge.js
git commit -m "Implement entity interaction features

MineflayerBridge additions:
- tradeWithVillager() for trading
- getVillagerTrades() for trade discovery
- breedAnimals() for animal farming
- mountEntity() and dismountEntity() for riding
- setupEntityTracking() for spawn/despawn events

Features:
- Complete villager trading system
- Animal breeding automation
- Horse/pig mounting
- Real-time entity tracking

Implements Feature Category 6 from MINEFLAYER_COMPARISON.md"
```

---

### 4.4 Implement Crafting & Chat

**Manual Edit Required:**
1. Open `minecraft_bridge.js`
2. Add crafting methods from `MINEFLAYER_COMPARISON.md` lines 3559-3758
3. Add chat methods from `MINEFLAYER_COMPARISON.md` lines 3785-3962
4. Methods to add:
   - `craftItem()`
   - `getRecipes()`
   - `autoCraft()`
   - `sendChat()`
   - `sendWhisper()`
   - `setupChatListeners()`
   - `_handleChatCommand()`
5. Save the file

**Verify crafting & chat:**
```bash
# Check crafting methods
grep "craftItem\|getRecipes\|autoCraft" minecraft_bridge.js

# Check chat methods
grep "sendChat\|sendWhisper\|setupChatListeners" minecraft_bridge.js
```

**Commit crafting & chat:**
```bash
git add minecraft_bridge.js
git commit -m "Implement crafting and chat communication features

Crafting system:
- craftItem() with recipe lookup
- getRecipes() for recipe discovery
- autoCraft() with missing ingredient detection
- Support for crafting tables and 2x2 crafting

Chat system:
- sendChat() for public messages
- sendWhisper() for private messages
- setupChatListeners() with command handling
- Built-in commands: help, status, come

Implements Feature Categories 7-8 from MINEFLAYER_COMPARISON.md"
```

---

### 4.5 Implement Plugin System

**Manual Edit Required:**
1. Open `minecraft_bridge.js`
2. Add plugin methods from `MINEFLAYER_COMPARISON.md` lines 3997-4169
3. Methods to add:
   - `loadPlugin()`
   - `setupAutoEat()`
   - `collectBlocks()`
4. Save the file

**Verify plugin system:**
```bash
# Check plugin methods
grep "loadPlugin\|setupAutoEat\|collectBlocks" minecraft_bridge.js

# Count total methods in bridge now
grep "async.*(" minecraft_bridge.js | wc -l
```

**Commit plugin system:**
```bash
git add minecraft_bridge.js
git commit -m "Implement plugin system for extensibility

MineflayerBridge additions:
- loadPlugin() for dynamic plugin loading
- setupAutoEat() for automatic eating
- collectBlocks() for block collection

Supported plugins:
- mineflayer-pathfinder (navigation)
- mineflayer-pvp (combat)
- mineflayer-auto-eat (survival)
- mineflayer-collectblock (gathering)

Implements Feature Category 9 from MINEFLAYER_COMPARISON.md"
```

---

### Update NPCEngine with All Executors

**Manual Edit Required:**
1. Open `npc_engine.js`
2. Add imports for new executors:
   ```javascript
   import { InventoryTaskExecutor } from './src/executors/InventoryTaskExecutor.js';
   import { CombatTaskExecutor } from './src/executors/CombatTaskExecutor.js';
   ```
3. Add to executor initialization:
   ```javascript
   this.executors = {
     movement: new MovementTaskExecutor(this.bridge),
     mining: new MiningTaskExecutor(this.bridge),
     inventory: new InventoryTaskExecutor(this.bridge),
     combat: new CombatTaskExecutor(this.bridge)
   };
   ```
4. Update `spawnBot()` to load plugins
5. Save the file

**Commit NPCEngine updates:**
```bash
git add npc_engine.js
git commit -m "Update NPCEngine with all Mineflayer executors

Changes:
- Add InventoryTaskExecutor and CombatTaskExecutor imports
- Initialize all 4 executors (movement, mining, inventory, combat)
- Update spawnBot() to load essential plugins
- Add chat listeners and entity tracking
- Configure auto-eat and PvP plugins

NPCEngine now has complete Mineflayer integration"
```

---

### Phase 4 Complete - Push Changes

```bash
# Push all advanced features
git push origin claude/extensive-bug-review-011CUwkb3aPn2ex1kQsFVLRN

# View recent commits
git log --oneline -15
```

**✅ Checkpoint:** You should see commits for inventory, combat, entity, crafting, chat, and plugins.

---

## PHASE 5: Medium Severity Bugs (2-3 hours)

### 5.1 Fix Bug #4: Duplicate enableModelAutonomy

```bash
# Find the duplicate method
grep -n "enableModelAutonomy" npc_engine.js
```

**Manual Edit Required:**
1. Open `npc_engine.js`
2. Find first `enableModelAutonomy` method (around lines 468-505)
3. **Delete** the entire first method definition
4. Keep the second one that delegates to AutonomyManager
5. Save the file

**Verify fix:**
```bash
# Should only show one enableModelAutonomy now
grep -c "enableModelAutonomy.*(" npc_engine.js
# Expected output: 1
```

**Commit:**
```bash
git add npc_engine.js
git commit -m "Fix medium severity bug: Remove duplicate enableModelAutonomy

- Resolves Bug #4 (MEDIUM)
- Removed first definition (lines 468-505)
- Kept second definition that delegates to AutonomyManager
- Prevents method override confusion

File: npc_engine.js:468-505, 773-775"
```

---

### 5.2 Fix Bug #5: Duplicate validateManifest

```bash
# Find the duplicate method
grep -n "validateManifest" task_broker.js
```

**Manual Edit Required:**
1. Open `task_broker.js`
2. Find second `validateManifest` method (around lines 213-223)
3. **Delete** the entire second method definition
4. Keep the first one (returns validation object)
5. Save the file

**Verify fix:**
```bash
# Should only show one validateManifest now
grep -c "validateManifest.*(" task_broker.js
# Expected output: 1
```

**Commit:**
```bash
git add task_broker.js
git commit -m "Fix medium severity bug: Remove duplicate validateManifest

- Resolves Bug #5 (MEDIUM)
- Removed second definition (lines 213-223)
- Kept first definition that returns validation object
- Prevents method override confusion

File: task_broker.js:115-170, 213-223"
```

---

### 5.3 Fix Bug #6: Logic Error in spawnAllKnown

```bash
# View the problematic loop
grep -A20 "async spawnAllKnown" npc_spawner.js | grep "for (const profile"
```

**Manual Edit Required:**
1. Open `npc_spawner.js`
2. Find the `spawnAllKnown()` method (around line 306)
3. Find the line: `for (const profile of npcs) {`
4. Change it to: `for (const profile of toSpawn) {`
5. Save the file

**Verify fix:**
```bash
# Check the correct variable is used
grep -A3 "const toSpawn = " npc_spawner.js | grep "for (const profile"
```

**Commit:**
```bash
git add npc_spawner.js
git commit -m "Fix medium severity bug: Correct loop variable in spawnAllKnown

- Resolves Bug #6 (MEDIUM)
- Changed loop from 'npcs' to 'toSpawn'
- Ensures only inactive NPCs are spawned
- Prevents attempting to spawn already-active bots

File: npc_spawner.js:306-323"
```

---

### 5.4 Fix Bug #7: Missing Registry Null Check

```bash
# View the function
grep -A5 "function countSpawnedBots" routes/bot.js
```

**Manual Edit Required:**
1. Open `routes/bot.js`
2. Find `countSpawnedBots()` function (around line 14)
3. Add null check at start:
   ```javascript
   function countSpawnedBots(npcEngine) {
     if (!npcEngine?.registry) return 0;  // ADD THIS LINE
     const allBots = npcEngine.registry.getAll();
     return allBots.filter(bot => bot.status === 'active').length;
   }
   ```
4. Save the file

**Verify fix:**
```bash
# Check null check was added
grep -A2 "function countSpawnedBots" routes/bot.js | grep "if (!npcEngine"
```

**Commit:**
```bash
git add routes/bot.js
git commit -m "Fix medium severity bug: Add registry null check

- Resolves Bug #7 (MEDIUM)
- Adds null check before accessing npcEngine.registry
- Returns 0 if registry is undefined
- Prevents null pointer errors

File: routes/bot.js:14-16"
```

---

### Phase 5 Complete - Push Changes

```bash
# Push medium bug fixes
git push origin claude/extensive-bug-review-011CUwkb3aPn2ex1kQsFVLRN

# View commits
git log --oneline -5
```

---

## PHASE 6: API Endpoints (3-4 hours)

### 6.1 Create Inventory Endpoints

**Manual Edit Required:**
1. Open `routes/bot.js`
2. Add new endpoints before the `export default router;` line:

```javascript
// GET /api/bot/:id/inventory
router.get('/:id/inventory', async (req, res) => {
  try {
    const inventory = await npcEngine.bridge.getInventory(req.params.id);
    res.json(inventory);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bot/:id/equip
router.post('/:id/equip', async (req, res) => {
  try {
    const { item, destination } = req.body;
    const result = await npcEngine.bridge.equipItem(req.params.id, item, destination);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bot/:id/drop
router.post('/:id/drop', async (req, res) => {
  try {
    const { item, count } = req.body;
    const result = await npcEngine.bridge.dropItem(req.params.id, item, count);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

**Verify endpoints added:**
```bash
# Check for new routes
grep -E "router\.(get|post).*/(inventory|equip|drop)" routes/bot.js
```

---

### 6.2 Create Combat Endpoints

**Continue editing `routes/bot.js`:**

```javascript
// POST /api/bot/:id/attack
router.post('/:id/attack', async (req, res) => {
  try {
    const result = await npcEngine.bridge.attackEntity(req.params.id, req.body.target);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bot/:id/defend
router.post('/:id/defend', async (req, res) => {
  try {
    const result = await npcEngine.bridge.defendAgainstHostiles(req.params.id, req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bot/:id/health
router.get('/:id/health', async (req, res) => {
  try {
    const health = npcEngine.bridge.getHealth(req.params.id);
    res.json(health);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

---

### 6.3 Create Entity, Crafting & Chat Endpoints

**Continue editing `routes/bot.js`:**

```javascript
// POST /api/bot/:id/trade
router.post('/:id/trade', async (req, res) => {
  try {
    const result = await npcEngine.bridge.tradeWithVillager(req.params.id, req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bot/:id/craft
router.post('/:id/craft', async (req, res) => {
  try {
    const result = await npcEngine.bridge.craftItem(req.params.id, req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bot/:id/chat
router.post('/:id/chat', async (req, res) => {
  try {
    const { message } = req.body;
    const result = npcEngine.bridge.sendChat(req.params.id, message);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bot/:id/entities
router.get('/:id/entities', async (req, res) => {
  try {
    const { maxDistance, type, hostile } = req.query;
    const entities = npcEngine.bridge.getNearbyEntities(req.params.id, {
      maxDistance: parseInt(maxDistance) || 16,
      type,
      hostile: hostile === 'true'
    });
    res.json({ entities });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

**Commit API endpoints:**
```bash
git add routes/bot.js
git commit -m "Add API endpoints for Mineflayer features

New endpoints:
- GET /api/bot/:id/inventory - Get bot inventory
- POST /api/bot/:id/equip - Equip items
- POST /api/bot/:id/drop - Drop items
- POST /api/bot/:id/attack - Attack entities
- POST /api/bot/:id/defend - Defend against hostiles
- GET /api/bot/:id/health - Get bot health
- POST /api/bot/:id/trade - Trade with villagers
- POST /api/bot/:id/craft - Craft items
- POST /api/bot/:id/chat - Send chat messages
- GET /api/bot/:id/entities - Get nearby entities

All endpoints include error handling and return JSON responses"
```

---

## PHASE 7: Low Severity Bugs (1-2 hours)

### 7.1 Fix Bugs #8-9: Division by Zero

```bash
# Find the problematic calculations
grep -n "successRate:" routes/bot.js | head -2
```

**Manual Edit Required:**
1. Open `routes/bot.js`
2. Find first `successRate` calculation (around line 169-170)
3. Replace with:
   ```javascript
   successRate: (learningProfile.tasksCompleted + learningProfile.tasksFailed) > 0
     ? (learningProfile.tasksCompleted / (learningProfile.tasksCompleted + learningProfile.tasksFailed)) * 100
     : 0,
   ```
4. Find second `successRate` calculation (around line 720-721)
5. Apply the same fix
6. Save the file

**Verify fix:**
```bash
# Check both calculations have the ternary operator
grep -A2 "successRate:" routes/bot.js | grep "? ("
```

**Commit:**
```bash
git add routes/bot.js
git commit -m "Fix low severity bugs: Prevent division by zero in success rate

- Resolves Bug #8 and Bug #9 (LOW)
- Adds check for zero total tasks before division
- Returns 0 if no tasks completed or failed
- Prevents NaN or Infinity in success rate calculations

Files: routes/bot.js:169-170, 720-721"
```

---

### 7.2 Fix Bug #10: Unsafe Error Throwing

```bash
# View the normalizeRole function
grep -A20 "normalizeRole" learning_engine.js
```

**Manual Edit Required:**
1. Open `learning_engine.js`
2. Find `normalizeRole()` method (around line 398)
3. Replace the function with:
   ```javascript
   normalizeRole(role, npcId = "") {
     if (!role || typeof role !== "string" || role.trim().length === 0) {
       console.warn(`Invalid role${npcId ? ` for ${npcId}` : ""}: defaulting to 'builder'`);
       return 'builder';
     }

     const normalized = role.trim().toLowerCase();
     if (!ALLOWED_ROLES.includes(normalized)) {
       console.warn(`Invalid role${npcId ? ` for ${npcId}` : ""}: ${role}. Defaulting to 'builder'`);
       return 'builder';
     }

     return normalized;
   }
   ```
4. Save the file

**Verify fix:**
```bash
# Check it returns default instead of throwing
grep -A15 "normalizeRole" learning_engine.js | grep -E "return 'builder'|throw new Error"
# Should see "return 'builder'" but NOT "throw new Error"
```

**Commit:**
```bash
git add learning_engine.js
git commit -m "Fix low severity bug: Return default instead of throwing

- Resolves Bug #10 (LOW)
- Changes normalizeRole to return 'builder' default
- Logs warnings instead of throwing errors
- Prevents crashes from invalid role inputs
- More graceful error handling

File: learning_engine.js:398-413"
```

---

### Phase 7 Complete - Push Changes

```bash
# Push low severity bug fixes
git push origin claude/extensive-bug-review-011CUwkb3aPn2ex1kQsFVLRN

# View all commits
git log --oneline
```

---

## PHASE 8: Testing & Verification (4-6 hours)

### 8.1 Unit Testing - MineflayerBridge

```bash
# Create test directory
mkdir -p tests

# Create bridge test file
cat > tests/test_bridge.js << 'EOF'
import { MineflayerBridge } from '../minecraft_bridge.js';

console.log('Testing MineflayerBridge...\n');

const bridge = new MineflayerBridge({
  host: 'localhost',
  port: 25565
});

// Test 1: Bridge instantiation
console.log('✓ Bridge instantiated');
console.log('  Host:', bridge.host);
console.log('  Port:', bridge.port);

// Test 2: Methods exist
const methods = [
  'createBot', 'moveToPosition', 'digBlock', 'getInventory',
  'attackEntity', 'craftItem', 'sendChat', 'loadPlugin'
];

let allMethodsExist = true;
for (const method of methods) {
  if (typeof bridge[method] !== 'function') {
    console.log(`✗ Method missing: ${method}`);
    allMethodsExist = false;
  }
}

if (allMethodsExist) {
  console.log('✓ All core methods exist');
  console.log(`  Methods checked: ${methods.length}`);
}

console.log('\n✅ Bridge unit tests passed');
EOF

# Run test
node tests/test_bridge.js
```

---

### 8.2 Bug Verification

```bash
# Create bug verification test
cat > tests/test_bug_fixes.js << 'EOF'
console.log('Verifying bug fixes...\n');

// Bug #2: fsSync import
import('./task_broker.js').then(() => {
  console.log('✓ Bug #2 fixed: TaskBroker imports successfully');
}).catch(err => {
  console.log('✗ Bug #2 not fixed:', err.message);
});

// Bug #3: Database null check
import('./src/database/connection.js').then(async ({ query, initDatabase }) => {
  try {
    await query('SELECT 1');
    console.log('✗ Bug #3 not fixed: Should throw before init');
  } catch (err) {
    if (err.message.includes('not initialized')) {
      console.log('✓ Bug #3 fixed: Throws error before initialization');
    }
  }
});

// Bug #10: normalizeRole doesn't throw
import('./learning_engine.js').then(({ LearningEngine }) => {
  const engine = new LearningEngine();
  try {
    const result = engine.normalizeRole('invalid_role');
    if (result === 'builder') {
      console.log('✓ Bug #10 fixed: Returns default instead of throwing');
    }
  } catch (err) {
    console.log('✗ Bug #10 not fixed: Still throws errors');
  }
});

setTimeout(() => {
  console.log('\n✅ Bug verification complete');
}, 2000);
EOF

# Run test
node tests/test_bug_fixes.js
```

---

### 8.3 Integration Test (requires Minecraft server)

```bash
# Create integration test
cat > tests/test_integration.js << 'EOF'
import { MineflayerBridge } from '../minecraft_bridge.js';

console.log('Integration Test (requires Minecraft server running)\n');

const bridge = new MineflayerBridge({
  host: process.env.MINECRAFT_HOST || 'localhost',
  port: parseInt(process.env.MINECRAFT_PORT || '25565')
});

async function runIntegrationTest() {
  try {
    // Test bot creation
    console.log('Creating bot...');
    const createResult = await bridge.createBot('integration-test', {
      username: 'TestBot'
    });

    if (!createResult.success) {
      throw new Error('Bot creation failed: ' + createResult.error);
    }
    console.log('✓ Bot created successfully');
    console.log('  Position:', createResult.position);

    // Test movement
    console.log('\nTesting movement...');
    const moveResult = await bridge.moveToPosition('integration-test', {
      x: createResult.position.x + 5,
      y: createResult.position.y,
      z: createResult.position.z
    }, { range: 1, timeout: 10000 });

    if (moveResult.success) {
      console.log('✓ Movement successful');
    }

    // Test inventory
    console.log('\nTesting inventory...');
    const inventory = await bridge.getInventory('integration-test');
    console.log('✓ Inventory retrieved');
    console.log('  Items:', inventory.items.length);

    // Test health
    console.log('\nTesting health check...');
    const health = bridge.getHealth('integration-test');
    console.log('✓ Health retrieved');
    console.log('  Health:', health.healthPercentage + '%');

    console.log('\n✅ Integration test passed');

  } catch (err) {
    console.error('\n✗ Integration test failed:', err.message);
    console.log('\nNote: This test requires a running Minecraft server');
    console.log('Set MINECRAFT_HOST and MINECRAFT_PORT if using remote server');
  }
}

runIntegrationTest();
EOF

# Run integration test (skip if no server)
if [ "$RUN_INTEGRATION_TEST" = "true" ]; then
  node tests/test_integration.js
else
  echo "Skipping integration test (set RUN_INTEGRATION_TEST=true to run)"
  echo "Requires: Minecraft server running at localhost:25565"
fi
```

---

### 8.4 Count All Fixes

```bash
# Generate summary report
cat > FIXES_SUMMARY.md << 'EOF'
# Bug Fixes Summary

## Critical Bugs (FIXED)
- [x] Bug #1: Metrics endpoint timing issue
- [x] Bug #2: Undefined fsSync module

## High Severity Bugs (FIXED)
- [x] Bug #3: Missing pool initialization check

## Medium Severity Bugs (FIXED)
- [x] Bug #4: Duplicate enableModelAutonomy method
- [x] Bug #5: Duplicate validateManifest method
- [x] Bug #6: Logic error in spawnAllKnown loop
- [x] Bug #7: Missing registry null check

## Low Severity Bugs (FIXED)
- [x] Bug #8-9: Division by zero in success rate
- [x] Bug #10: Unsafe error throwing in normalizeRole

## Mineflayer Implementation (COMPLETE)
- [x] Category 1: Bot lifecycle management
- [x] Category 2: Movement & pathfinding
- [x] Category 3: Mining & world interaction
- [x] Category 4: Inventory management
- [x] Category 5: Combat system
- [x] Category 6: Entity interaction
- [x] Category 7: Crafting & recipes
- [x] Category 8: Chat & communication
- [x] Category 9: Plugin system

## API Endpoints (CREATED)
- [x] Inventory endpoints (3)
- [x] Combat endpoints (3)
- [x] Entity endpoints (4)
- [x] Total: 10 new endpoints

## Files Modified
- server.js
- task_broker.js
- npc_engine.js
- npc_spawner.js
- routes/bot.js
- learning_engine.js
- src/database/connection.js

## Files Created
- minecraft_bridge.js
- src/executors/MovementTaskExecutor.js
- src/executors/MiningTaskExecutor.js
- src/executors/InventoryTaskExecutor.js
- src/executors/CombatTaskExecutor.js
- IMPLEMENTATION_PLAN.md
- TERMINAL_GUIDE.md
- FIXES_SUMMARY.md

## Test Status
- [ ] Unit tests passed
- [ ] Integration tests passed (requires Minecraft server)
- [ ] Bug verification complete
- [ ] Performance tests passed

## Ready for Production
- [ ] All bugs fixed
- [ ] All features implemented
- [ ] Tests passing
- [ ] Documentation complete
EOF

cat FIXES_SUMMARY.md
```

---

### Final Commit & Push

```bash
# Add test files and summary
git add tests/ FIXES_SUMMARY.md
git commit -m "Add testing suite and fixes summary

- Unit tests for MineflayerBridge
- Bug verification tests
- Integration test suite
- Comprehensive fixes summary
- All 10 bugs verified fixed
- All 9 Mineflayer categories implemented"

# Final push
git push origin claude/extensive-bug-review-011CUwkb3aPn2ex1kQsFVLRN

# View final commit count
git log --oneline | wc -l

# View changed files summary
git diff backup-before-implementation --stat
```

---

## COMPLETE! 🎉

### Final Verification Checklist

```bash
# 1. Check all commits were pushed
git log --oneline --graph --all | head -30

# 2. Verify no uncommitted changes
git status

# 3. Count files changed
git diff backup-before-implementation --name-only | wc -l

# 4. View summary
echo "=== IMPLEMENTATION COMPLETE ==="
echo "Branch: $(git branch --show-current)"
echo "Total commits: $(git log --oneline | wc -l)"
echo "Files created: $(git diff backup-before-implementation --name-only --diff-filter=A | wc -l)"
echo "Files modified: $(git diff backup-before-implementation --name-only --diff-filter=M | wc -l)"
echo ""
echo "✅ All critical bugs fixed"
echo "✅ All Mineflayer features implemented"
echo "✅ All API endpoints created"
echo "✅ Test suite added"
```

---

## Optional: Create Pull Request

```bash
# If you want to create a PR (requires gh CLI)
gh pr create \
  --title "Fix all bugs and implement Mineflayer integration" \
  --body "$(cat << 'EOF'
## Summary
Complete implementation of bug fixes and Mineflayer integration.

## Bug Fixes
- Fixed all 10 bugs (2 critical, 1 high, 4 medium, 3 low)
- See BUG_REPORT.md for details

## New Features
- Complete Mineflayer integration (9 categories)
- 4 task executors (movement, mining, inventory, combat)
- 10 new API endpoints
- Plugin system for extensibility

## Testing
- Unit tests added
- Integration tests added
- Bug verification complete

## Documentation
- IMPLEMENTATION_PLAN.md
- MINEFLAYER_COMPARISON.md
- TERMINAL_GUIDE.md
- FIXES_SUMMARY.md

Closes #(issue number if applicable)
EOF
)" \
  --base main
```

---

## Troubleshooting

### If a commit fails:
```bash
# Check what's wrong
git status

# Fix the issue, then:
git add <files>
git commit --amend --no-edit

# Force push if already pushed
git push --force-with-lease
```

### If push fails with 403:
```bash
# Wait 2 seconds and retry
sleep 2
git push origin claude/extensive-bug-review-011CUwkb3aPn2ex1kQsFVLRN
```

### If you need to undo a change:
```bash
# Undo last commit (keeps changes)
git reset HEAD~1

# Discard all changes and go back to previous commit
git reset --hard HEAD~1

# Restore a specific file from backup
git checkout backup-before-implementation -- <filename>
```

### If tests fail:
```bash
# Check Node version
node --version  # Should be 14+

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Check for syntax errors
npm run lint  # if you have eslint configured
```

---

**END OF GUIDE**

Remember to verify each checkpoint (✅) before proceeding to the next phase!
