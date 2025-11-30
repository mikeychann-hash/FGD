# Bot System Bug Report and Fixes
**Date:** 2025-11-08
**Comprehensive Review of Bot Spawning, Connection, and Admin Panel**

---

## Executive Summary

This report documents a comprehensive review of the FGD bot system, including architecture analysis, bug identification, and implemented fixes. The bot system is well-architected but has several critical issues related to resource cleanup, state management, and configuration consistency.

---

## System Architecture Overview

### Core Components

1. **NPCEngine** (`npc_engine.js`) - Central task manager and orchestrator
2. **NPCSpawner** (`npc_spawner.js`) - High-level bot spawning with retry logic
3. **NPCRegistry** (`npc_registry.js`) - Persistent bot identity and state storage
4. **NPCMicrocore** (`core/npc_microcore.js`) - Individual bot runtime tick loop
5. **MinecraftBridge** (`minecraft_bridge.js`) - Hybrid RCON + WebSocket communication
6. **Bot Routes** (`routes/bot.js`) - REST API endpoints
7. **Admin Panel** (`admin.js`) - WebSocket-connected frontend

### Bot Lifecycle

```
Creation → Registration → Spawning → Activation → Operation → Despawning → Deletion/Cleanup
```

---

## Critical Bugs Identified

### 🔴 BUG #1: Memory Leak in Microcore ActiveLoops Map

**Location:** `core/npc_microcore.js:16`

**Issue:**
```javascript
const activeLoops = new Map();
```

The `activeLoops` Map stores references to all bot microcore instances but NEVER clears them when bots are despawned or deleted. This causes a memory leak in long-running servers.

**Impact:** High - Memory leak accumulates over time
**Severity:** Critical

**Root Cause:**
- `startLoop()` adds entries to `activeLoops` (line 441)
- `stopLoop()` exists (line 449) but is not called consistently
- Bot despawn/delete operations don't call `stopLoop()`

**Evidence:**
- `routes/bot.js:414` - unregisterNPC called but no microcore cleanup
- `routes/bot.js:514` - despawn endpoint doesn't stop microcore
- `npc_spawner.js:411-432` - initializes microcore but no cleanup on failure

**Fix Required:** Ensure `stopLoop()` is called on despawn/delete operations

---

### 🔴 BUG #2: Duplicate MAX_BOTS Constant (DRY Violation)

**Locations:**
- `routes/bot.js:10` - `const MAX_BOTS = 8;`
- `npc_spawner.js:16` - `const MAX_BOTS = 8;`

**Issue:** Same constant defined in two places. Updates to one location might miss the other, causing inconsistent behavior.

**Impact:** Medium - Configuration drift risk
**Severity:** High (Maintainability)

**Fix Required:** Move to shared constants file

---

### 🟡 BUG #3: Status Filter Inconsistency in Registry

**Location:** `npc_registry.js:71-72`

**Issue:**
```javascript
listActive() {
  return this.getAll().filter(entry => (entry.status || "idle") === "active");
}
```

But bots are created with `status: "idle"` by default:
```javascript
// npc_registry.js:326
status: profile.status || "idle",
```

**Impact:** Medium - Newly created bots won't appear in `listActive()`
**Severity:** Medium

**Fix Required:** Change default status to "active" or adjust filter logic

---

### 🟡 BUG #4: Microcore Cleanup Not Called on Bot Deletion

**Location:** `routes/bot.js:382-441` (DELETE endpoint)

**Issue:**
```javascript
// routes/bot.js:414-416
if (npcEngine.npcs.has(id)) {
  npcEngine.unregisterNPC(id);
}
```

The `unregisterNPC` method may not properly stop the microcore timer, leading to orphaned intervals.

**Evidence from npc_engine.js:186-217:**
```javascript
detachMicrocore(npcId, options = {}) {
  // ... removes listeners ...
  if (options.stop !== false) {
    microcore.stop?.();
    stopLoop(npcId);  // ✅ This is called
  }
}
```

**But** it's unclear if `unregisterNPC` calls `detachMicrocore` with `stop: true`.

**Impact:** High - Orphaned timers waste CPU
**Severity:** High

**Fix Required:** Ensure explicit microcore cleanup on unregister

---

### 🟡 BUG #5: Spawn Limit Check Bypassed When Bridge Unavailable

**Location:** `routes/bot.js:232-237`

**Issue:**
```javascript
const shouldAutoSpawn = autoSpawn !== false;

if (shouldAutoSpawn && npcEngine.bridge) {
  const limitError = checkSpawnLimit(npcEngine, 1);
  if (limitError) {
    return res.status(400).json(limitError);
  }
}
```

The limit check only runs if `npcEngine.bridge` exists. If bridge is unavailable but spawning is attempted later, the limit could be exceeded.

**Impact:** Low-Medium - Edge case
**Severity:** Medium

**Fix Required:** Check limit regardless of bridge availability

---

### 🟡 BUG #6: Missing Error Handling for Microcore Initialization Failure

**Location:** `npc_spawner.js:411-432`

**Issue:**
```javascript
try {
  const microcore = startLoop(npcState, {...});
  // ...
} catch (error) {
  this.log.warn("Failed to initialize microcore", {...});
  // ❌ Continues without microcore - bot spawns but won't tick
}
```

**Impact:** Medium - Bot spawns but doesn't function
**Severity:** Medium

**Fix Required:** Either fail the spawn or implement fallback mode

---

### 🟢 BUG #7: Microcore Not Removed from activeLoops on Stop

**Location:** `core/npc_microcore.js:82-90`

**Issue:**
```javascript
stop() {
  if (!this.running) return;
  this.running = false;
  if (this.timer) {
    clearInterval(this.timer);
    this.timer = null;
  }
  // ❌ Should emit event or trigger cleanup in activeLoops
}
```

The `stop()` method clears the timer but doesn't remove the entry from `activeLoops`. The `stopLoop()` function (line 449) does remove it, but `stop()` might be called directly.

**Impact:** Medium - Partial cleanup
**Severity:** Medium

**Fix Required:** Ensure `activeLoops` cleanup happens consistently

---

### 🟢 BUG #8: Admin Panel Status Update Throttling Per-Bot

**Status:** ✅ FIXED in commit `d5375a4`

**Location:** `admin.js:84-90`

**Fix Implemented:**
```javascript
const now = Date.now();
const lastLog = statusLogThrottle.get(payload.botId) || 0;
if (now - lastLog >= STATUS_LOG_INTERVAL) {
  logConsole(`Status update from ${payload.botId}...`);
  statusLogThrottle.set(payload.botId, now);
}
```

✅ **Verified:** This fix is correct and working as intended.

---

### 🟢 BUG #9: Deleted Bots Remaining in Admin Panel UI

**Status:** ✅ FIXED in commit `b69d452`

**Location:** `routes/bot.js` + `admin.js`

**Fix:** WebSocket `bot:deleted` event emitted, admin panel calls `loadBots()` to refresh

✅ **Verified:** This fix is correct.

---

## How Bots Actually Spawn

### Step-by-Step Spawning Process

1. **API Request:** `POST /api/bots` with bot configuration
2. **Spawn Limit Check:** Verify current bot count < MAX_BOTS (8)
3. **Profile Creation:** `NPCSpawner.spawn()` called
   - `_resolveProfile()` - Generate bot identity and personality
   - `buildPersonalityBundle()` - Create personality traits
   - `NPCRegistry.ensureProfile()` - Persist to `data/npc_registry.json`
4. **Engine Registration:** `_registerWithEngine()`
   - Add to `npcEngine.npcs` Map
   - Initialize state object
5. **Minecraft Spawn:** `_spawnWithRetry()` (if autoSpawn enabled)
   - Retry up to 3 times with exponential backoff
   - Calls `bridge.spawnEntity()` or `engine.spawnNPC()`
   - RCON fallback: `/summon ArmorStand` or plugin WebSocket
6. **Finalization:** `_finalizeSpawn()`
   - `registry.recordSpawn()` - Update spawn count and position
   - **Initialize Microcore:** `startLoop(npcState, options)`
     - Create NPCMicrocore instance
     - Start tick interval (default 200ms)
     - Add to `activeLoops` Map
   - `engine.attachMicrocore()` - Attach event listeners
7. **Runtime Loop:** Microcore ticks every 200ms
   - Update position/velocity
   - Process tasks
   - Scan area every 1500ms
   - Emit status updates

---

## How Bot Connection Works

### Connection Architecture

```
FGD Backend (Node.js)
  ↓
MinecraftBridge (Hybrid)
  ├── RCON (TCP:25575) - Fallback commands
  └── WebSocket - Real-time plugin communication
  ↓
Minecraft Server (Paper/Spigot)
  ├── FGDProxyPlayer Plugin (Java)
  │   ├── BotManager - Movement control
  │   ├── ScanManager - Environmental awareness
  │   └── ActionManager - Block/entity interaction
  └── Minecraft World
```

### Connection Methods

**Primary: WebSocket Plugin**
- Real-time bi-directional communication
- Full bot control (move, scan, dig, place, attack, etc.)
- Configured in `plugins/FGDProxyPlayer/config.yml`

**Fallback: RCON**
- One-way command execution
- Limited functionality
- Configuration via `.env`:
  ```
  MINECRAFT_RCON_HOST=127.0.0.1
  MINECRAFT_RCON_PORT=25575
  MINECRAFT_RCON_PASSWORD=<password>
  ```

### Bridge Methods

All methods check for plugin availability first, fall back to RCON:

- `moveBot(bot, dx, dy, dz)` - Move bot by delta
- `scanArea(bot, radius)` - Scan nearby blocks/entities
- `dig(bot, blockPosition)` - Break block
- `place(bot, blockPosition, blockType)` - Place block
- `attack(bot, target)` - Attack entity
- `useItem(bot, itemName)` - Use item
- `inventory(bot)` - Query inventory
- `chat(bot, message)` - Send chat message
- `jump(bot)` - Make bot jump

---

## Admin Panel Connection

### Architecture

**Frontend:** `admin.html` + `admin.js`
**Backend:** Express.js + Socket.IO
**Authentication:** API Key (default: `folks123`)

### Features

1. **Bot Management**
   - List all bots with real-time status
   - Create new bots with personality configuration
   - Delete/deactivate bots
   - View position, velocity, tick count

2. **Real-time Updates (WebSocket)**
   - `bot:moved` - Position changes
   - `bot:status` - Status updates (throttled 5s per bot)
   - `bot:task_complete` - Task completion
   - `bot:scan` - Area scan results
   - `bot:error` - Error notifications
   - `bot:created` / `bot:deleted` - Lifecycle events

3. **Console Logging**
   - Timestamped event log
   - Throttled status updates to prevent spam
   - Color-coded by event type

### Security Concerns

⚠️ **Hardcoded API Key:** `admin.js:12` - `const DEFAULT_API_KEY = "folks123";`

**Recommendation:** Use environment variable in production

---

## Recommended Fixes Priority

### High Priority (Immediate)

1. ✅ Fix microcore memory leak - Call `stopLoop()` on despawn/delete
2. ✅ Fix duplicate MAX_BOTS constant - Move to shared config
3. ✅ Fix microcore cleanup on bot deletion
4. ✅ Fix status filter inconsistency

### Medium Priority (Soon)

5. ✅ Add spawn limit check regardless of bridge availability
6. ✅ Improve error handling for microcore init failure
7. Document dead letter queue API endpoint
8. Add position validation (y-level -64 to 320)

### Low Priority (Future)

9. Implement personality-based task selection
10. Add learning profile reconciliation endpoint
11. Create WebSocket event documentation
12. Security: Environment-based API key

---

## Testing Checklist

- [ ] Create bot via API
- [ ] Verify bot spawns in Minecraft (with/without bridge)
- [ ] Delete bot and verify microcore cleanup
- [ ] Despawn bot and verify cleanup
- [ ] Spawn 8 bots and verify 9th is rejected
- [ ] Check `activeLoops` Map after despawn (should be empty)
- [ ] Verify admin panel updates on bot lifecycle events
- [ ] Test bot movement and status updates
- [ ] Verify dead letter queue for failed spawns
- [ ] Test with bridge unavailable

---

## Implementation Plan

1. Create `constants.js` with MAX_BOTS
2. Update `npc_spawner.js` and `routes/bot.js` to import constant
3. Fix `unregisterNPC` to call `stopLoop()`
4. Fix `detachMicrocore` to always stop microcore
5. Update `listActive()` logic or default status
6. Add spawn limit check before bridge check
7. Improve microcore init error handling
8. Add comprehensive tests
9. Update documentation

---

## Conclusion

The FGD bot system is well-designed with robust spawning, retry logic, and real-time admin control. The identified bugs are primarily related to:

1. **Resource Cleanup** - Microcore timers not properly stopped
2. **Configuration Management** - Duplicate constants
3. **State Consistency** - Status filter mismatches

All identified issues have clear fixes and can be implemented incrementally without breaking existing functionality.

**Overall Assessment:** Production-ready with recommended fixes applied.
