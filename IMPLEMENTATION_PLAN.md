# FGD Implementation Plan: Bug Fixes + Mineflayer Integration

**Date:** 2025-11-09
**Strategy:** Hybrid Approach - Fix Critical Bugs First, Parallel Development
**Estimated Timeline:** 3-5 days

---

## Executive Summary

**Recommended Approach: Fix Critical Bugs → Implement Mineflayer Core → Fix Remaining Bugs in Parallel**

### Reasoning

1. **Critical bugs will break development** - The `fsSync` import error (Bug #2) causes runtime crashes that would interfere with any development work
2. **Clean foundation for integration** - Bug #1 (metrics endpoint) affects server startup and could cause issues during Mineflayer testing
3. **Some bugs become irrelevant** - Medium/low severity bugs can be fixed in parallel or skipped if Mineflayer replaces affected code
4. **Faster time to value** - Get core Mineflayer features working while addressing remaining bugs

---

## Phase 1: Critical Bug Fixes (Priority: URGENT)
**Estimated Time:** 2-3 hours

### Why First?
- These bugs cause **runtime crashes** and **race conditions**
- Will interfere with all subsequent development
- Must be fixed regardless of Mineflayer integration

### Tasks

#### 1.1 Fix Bug #2: Undefined fsSync Module (CRITICAL)
**File:** `task_broker.js:4,94-96`
**Impact:** Runtime crash when TaskBroker loads config
**Fix:**
```javascript
// Add synchronous fs import
import fs from "fs/promises";
import fsSync from "fs";  // ADD THIS LINE
```

**Test:**
```bash
node -e "import('./task_broker.js').then(() => console.log('✓ Import successful'))"
```

**Estimated Time:** 15 minutes

---

#### 1.2 Fix Bug #1: Metrics Endpoint After Server Start (CRITICAL)
**File:** `server.js:229-240`
**Impact:** Race condition - endpoint may not be available
**Fix:** Move endpoint definition into `startServer()` before `httpServer.listen()`

**Location:**
```javascript
async function startServer() {
  // ... existing initialization ...

  // ADD HERE (before httpServer.listen):
  app.get('/metrics', async (req, res) => {
    try {
      const registry = getPrometheusRegistry();
      res.set('Content-Type', registry.contentType);
      res.end(await registry.metrics());
    } catch (err) {
      res.status(500).send(err.message);
    }
  });

  // Then start server
  const PORT = process.env.PORT || DEFAULT_PORT;
  httpServer.listen(PORT, () => {
    // ...
  });
}
```

**Test:**
```bash
# Start server and verify metrics endpoint
curl http://localhost:3000/metrics
```

**Estimated Time:** 30 minutes

---

## Phase 2: Mineflayer Foundation (Priority: HIGH)
**Estimated Time:** 1-2 days

### Why Now?
- Critical bugs are fixed
- Clean foundation to build on
- Core features needed before advanced integration

### Tasks

#### 2.1 Install Dependencies
```bash
npm install mineflayer
npm install mineflayer-pathfinder
npm install mineflayer-pvp
npm install mineflayer-auto-eat
npm install mineflayer-collectblock
npm install minecraft-data
npm install vec3
```

**Test:**
```bash
npm ls | grep mineflayer
```

**Estimated Time:** 15 minutes

---

#### 2.2 Create MineflayerBridge Class
**File:** Create `minecraft_bridge.js` (if doesn't exist) or update existing
**Features:**
- Bot connection and lifecycle management
- Event handling (spawn, disconnect, error)
- Reconnection logic with exponential backoff
- WebSocket event forwarding

**Implementation:** Use code from MINEFLAYER_COMPARISON.md lines 87-461

**Test:**
```javascript
// Test bot creation
const bridge = new MineflayerBridge({
  host: 'localhost',
  port: 25565
});

const result = await bridge.createBot('test-bot-1', {
  username: 'TestBot'
});

console.log('Bot spawned:', result.success);
```

**Estimated Time:** 4 hours

---

#### 2.3 Implement Movement & Pathfinding (Categories 1-2)
**Files:**
- Update `minecraft_bridge.js` with movement methods
- Create `src/executors/MovementTaskExecutor.js`

**Features:**
- Basic movement (moveToPosition, followEntity)
- Pathfinder plugin integration
- Physics-aware navigation
- Movement goals (GoalNear, GoalBlock, GoalFollow)

**Implementation:** Use code from MINEFLAYER_COMPARISON.md lines 463-881

**Test:**
```javascript
// Test pathfinding
await bridge.moveToPosition('test-bot-1', { x: 100, y: 64, z: 100 }, {
  range: 2,
  timeout: 30000
});
```

**Estimated Time:** 3 hours

---

#### 2.4 Implement Mining & World Interaction (Category 3)
**Files:**
- Update `minecraft_bridge.js` with mining methods
- Create `src/executors/MiningTaskExecutor.js`

**Features:**
- Block finding and digging
- Automatic tool selection
- Vein mining algorithm
- Block placement

**Implementation:** Use code from MINEFLAYER_COMPARISON.md lines 883-2046

**Test:**
```javascript
// Test mining
await bridge.digBlock('test-bot-1', { x: 95, y: 63, z: 100 }, {
  equipTool: true
});
```

**Estimated Time:** 3 hours

---

#### 2.5 Update NPCSystem Integration
**File:** `src/services/npc_initializer.js`

**Changes:**
```javascript
async initializeMinecraftBridge() {
  // Replace RCON-only approach with MineflayerBridge
  this.minecraftBridge = new MineflayerBridge({
    host: process.env.MINECRAFT_HOST || 'localhost',
    port: parseInt(process.env.MINECRAFT_PORT || '25565'),
    version: process.env.MINECRAFT_VERSION || '1.20.1'
  });

  await this.minecraftBridge.initialize();
  logger.info('Mineflayer Bridge initialized');
}
```

**Estimated Time:** 1 hour

---

## Phase 3: High Severity Bug Fix (Priority: MEDIUM)
**Estimated Time:** 1 hour

### Why Here?
- Core Mineflayer is working
- This bug affects database operations
- Can be done in parallel with advanced Mineflayer features

#### 3.1 Fix Bug #3: Missing Pool Initialization Check
**File:** `src/database/connection.js:67-78`
**Impact:** Null pointer error if query() called before initDatabase()

**Fix:**
```javascript
export async function query(text, params = []) {
  if (!pool) {  // ADD THIS CHECK
    throw new Error('Database not initialized. Call initDatabase() first.');
  }

  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Query executed', { duration, rows: result.rowCount });
    return result;
  } catch (err) {
    logger.error('Query failed', { error: err.message, query: text });
    throw err;
  }
}
```

**Test:**
```javascript
// Should throw error
try {
  await query('SELECT 1');
} catch (err) {
  console.log('✓ Throws error before init:', err.message);
}

// Should work after init
await initDatabase();
const result = await query('SELECT 1');
console.log('✓ Query works after init');
```

**Estimated Time:** 1 hour

---

## Phase 4: Advanced Mineflayer Features (Priority: MEDIUM)
**Estimated Time:** 1-2 days

### Tasks

#### 4.1 Implement Inventory Management (Category 4)
**Files:**
- Update `minecraft_bridge.js`
- Create `src/executors/InventoryTaskExecutor.js`

**Features:**
- Inventory tracking and equipment
- Chest interaction
- Item transfer and organization

**Implementation:** Use code from MINEFLAYER_COMPARISON.md lines 2050-2663

**Estimated Time:** 3 hours

---

#### 4.2 Implement Combat System (Category 5)
**Files:**
- Update `minecraft_bridge.js`
- Create `src/executors/CombatTaskExecutor.js`

**Features:**
- Entity targeting and attack
- PvP plugin integration
- Hostile mob defense
- Health tracking

**Implementation:** Use code from MINEFLAYER_COMPARISON.md lines 2665-3136

**Estimated Time:** 3 hours

---

#### 4.3 Implement Entity Interaction (Category 6)
**Features:**
- Villager trading
- Animal breeding
- Entity mounting/dismounting
- Entity tracking

**Implementation:** Use code from MINEFLAYER_COMPARISON.md lines 3138-3532

**Estimated Time:** 2 hours

---

#### 4.4 Implement Crafting & Chat (Categories 7-8)
**Features:**
- Recipe lookup and crafting
- Chat messaging and commands
- Whisper support

**Implementation:** Use code from MINEFLAYER_COMPARISON.md lines 3534-3963

**Estimated Time:** 2 hours

---

#### 4.5 Implement Plugin System (Category 9)
**Features:**
- Plugin loading infrastructure
- Auto-eat, collect-block plugins
- Custom plugin support

**Implementation:** Use code from MINEFLAYER_COMPARISON.md lines 3965-4280

**Estimated Time:** 2 hours

---

## Phase 5: Medium Severity Bugs (Priority: LOW)
**Estimated Time:** 2-3 hours

### Why Here?
- Core features are working
- These bugs don't block functionality
- Can skip bugs in code that Mineflayer replaces

### Tasks

#### 5.1 Fix Bug #4: Duplicate enableModelAutonomy Method
**File:** `npc_engine.js:468-505, 773-775`
**Action:** Remove first definition (lines 468-505), keep second (delegates to AutonomyManager)

**Estimated Time:** 15 minutes

---

#### 5.2 Fix Bug #5: Duplicate validateManifest Method
**File:** `task_broker.js:115-170, 213-223`
**Action:** Remove second definition, keep first (returns validation object)

**Estimated Time:** 15 minutes

---

#### 5.3 Fix Bug #6: Logic Error in spawnAllKnown
**File:** `npc_spawner.js:306-323`
**Action:** Change `for (const profile of npcs)` to `for (const profile of toSpawn)`

**Estimated Time:** 15 minutes

---

#### 5.4 Fix Bug #7: Missing Registry Null Check
**File:** `routes/bot.js:14-16`
**Fix:**
```javascript
function countSpawnedBots(npcEngine) {
  if (!npcEngine?.registry) return 0;  // ADD THIS
  const allBots = npcEngine.registry.getAll();
  return allBots.filter(bot => bot.status === 'active').length;
}
```

**Estimated Time:** 15 minutes

---

## Phase 6: API Endpoints for Mineflayer (Priority: MEDIUM)
**Estimated Time:** 3-4 hours

### Tasks

#### 6.1 Create Inventory Endpoints
**File:** `routes/bot.js`

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
  const { item, destination } = req.body;
  const result = await npcEngine.bridge.equipItem(req.params.id, item, destination);
  res.json(result);
});
```

**Estimated Time:** 1 hour

---

#### 6.2 Create Combat Endpoints
```javascript
// POST /api/bot/:id/attack
router.post('/:id/attack', async (req, res) => {
  const result = await npcEngine.bridge.attackEntity(req.params.id, req.body.target);
  res.json(result);
});

// POST /api/bot/:id/defend
router.post('/:id/defend', async (req, res) => {
  const result = await npcEngine.bridge.defendAgainstHostiles(req.params.id, req.body);
  res.json(result);
});
```

**Estimated Time:** 1 hour

---

#### 6.3 Create Entity & Crafting Endpoints
```javascript
// POST /api/bot/:id/trade
// POST /api/bot/:id/craft
// POST /api/bot/:id/chat
```

**Estimated Time:** 1.5 hours

---

## Phase 7: Low Severity Bugs & Polish (Priority: LOW)
**Estimated Time:** 1-2 hours

### Tasks

#### 7.1 Fix Bugs #8-9: Division by Zero in Success Rate
**File:** `routes/bot.js:169-170, 720-721`

**Fix:**
```javascript
successRate: (learningProfile.tasksCompleted + learningProfile.tasksFailed) > 0
  ? (learningProfile.tasksCompleted / (learningProfile.tasksCompleted + learningProfile.tasksFailed)) * 100
  : 0,
```

**Estimated Time:** 30 minutes

---

#### 7.2 Fix Bug #10: Unsafe Error Throwing in normalizeRole
**File:** `learning_engine.js:398-413`

**Fix:** Return default value instead of throwing
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

**Estimated Time:** 30 minutes

---

## Phase 8: Testing & Verification (Priority: HIGH)
**Estimated Time:** 4-6 hours

### Tasks

#### 8.1 Unit Testing
- Test MineflayerBridge bot creation
- Test all movement methods
- Test mining and block interaction
- Test inventory management
- Test combat system

**Estimated Time:** 2 hours

---

#### 8.2 Integration Testing
- Spawn bot via API
- Execute complete task workflow (move → mine → craft)
- Test WebSocket event forwarding
- Test automatic reconnection
- Test all API endpoints

**Estimated Time:** 2 hours

---

#### 8.3 Bug Verification
- Verify all 10 bugs are fixed
- Run regression tests
- Check no new bugs introduced

**Estimated Time:** 1 hour

---

#### 8.4 Performance Testing
- Test with multiple bots (5, 10, 20)
- Monitor memory usage
- Check WebSocket event throughput
- Test pathfinding performance

**Estimated Time:** 1 hour

---

## Timeline Summary

| Phase | Description | Time | Cumulative |
|-------|-------------|------|------------|
| 1 | Critical Bug Fixes | 2-3 hours | 3 hours |
| 2 | Mineflayer Foundation | 1-2 days | 2 days |
| 3 | High Severity Bug | 1 hour | 2 days |
| 4 | Advanced Mineflayer | 1-2 days | 3.5 days |
| 5 | Medium Severity Bugs | 2-3 hours | 3.5 days |
| 6 | API Endpoints | 3-4 hours | 4 days |
| 7 | Low Severity Bugs | 1-2 hours | 4 days |
| 8 | Testing & Verification | 4-6 hours | 5 days |

**Total Estimated Time:** 3-5 days (assuming 8-hour work days)

---

## Parallel Development Opportunities

These tasks can be done simultaneously by different developers:

- **Track 1 (Backend):** Phases 2-4 (Mineflayer implementation)
- **Track 2 (Bug Fixes):** Phases 3, 5, 7 (Non-critical bugs)
- **Track 3 (API):** Phase 6 (Endpoints - after Phase 2 is complete)

With 2-3 developers, timeline reduces to **2-3 days**.

---

## Risk Mitigation

### Risk 1: Mineflayer Integration Breaks Existing Features
**Mitigation:**
- Keep RCON fallback in MinecraftBridge
- Feature flag for Mineflayer vs RCON mode
- Comprehensive regression testing

### Risk 2: Bug Fixes Introduce New Bugs
**Mitigation:**
- Test each bug fix individually
- Use version control for easy rollback
- Code review all changes

### Risk 3: Minecraft Server Unavailable
**Mitigation:**
- Use local test server
- Mock bot responses for unit tests
- Graceful degradation if connection fails

### Risk 4: Performance Issues with Multiple Bots
**Mitigation:**
- Connection pooling
- Event throttling
- Bot limit configuration
- Memory profiling

---

## Success Criteria

### Phase 1-3 Success
- [ ] All critical bugs fixed and tested
- [ ] No runtime crashes
- [ ] Server starts successfully
- [ ] Database queries safe

### Phase 2-4 Success
- [ ] Bot spawns and connects to Minecraft
- [ ] Movement and pathfinding work
- [ ] Mining operations successful
- [ ] All advanced features implemented
- [ ] Events forward to WebSocket

### Phase 5-7 Success
- [ ] All 10 bugs verified fixed
- [ ] API endpoints working
- [ ] No regressions introduced

### Phase 8 Success
- [ ] All tests passing
- [ ] Multiple bots working simultaneously
- [ ] Performance meets requirements
- [ ] Documentation updated

---

## Next Steps

1. **Review this plan** with the team
2. **Prioritize** if timeline needs compression
3. **Start Phase 1** immediately (critical bugs)
4. **Set up test environment** (local Minecraft server)
5. **Begin development** following phase order

---

## Notes

- This plan assumes familiarity with the codebase
- Times are estimates and may vary
- Phases can be adjusted based on priority changes
- Consider feature branches for major changes
- Document all changes for team knowledge transfer

---

**Plan Created:** 2025-11-09
**Last Updated:** 2025-11-09
**Status:** Ready for Implementation
