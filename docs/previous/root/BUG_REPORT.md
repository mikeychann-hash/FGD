# Bug Report - FGD Codebase Review

**Date:** 2025-11-09
**Review Type:** Comprehensive Codebase Bug Analysis
**Total Bugs Found:** 10

---

## Table of Contents
- [Critical Bugs](#critical-bugs)
- [High Severity Bugs](#high-severity-bugs)
- [Medium Severity Bugs](#medium-severity-bugs)
- [Low Severity Bugs](#low-severity-bugs)
- [Summary](#summary)

---

## Critical Bugs

### Bug #1: Metrics Endpoint Defined After Server Starts
**File:** `server.js`
**Lines:** 232-240
**Severity:** Critical
**Category:** Code Structure

**Description:**
The `/metrics` endpoint is defined after `startServer()` is called (line 229), which means the endpoint registration happens after the HTTP server begins listening. This could lead to race conditions or the endpoint not being available.

**Current Code:**
```javascript
// Start the server
startServer();

// Expose Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    const registry = getPrometheusRegistry();
    res.set('Content-Type', registry.contentType);
    res.end(await registry.metrics());
  } catch (err) {
    res.status(500).send(err.message);
  }
});
```

**Recommended Fix:**
Move the metrics endpoint definition inside the `startServer()` function before `httpServer.listen()` is called.

```javascript
async function startServer() {
  try {
    // ... existing initialization code ...

    // Expose Prometheus metrics endpoint
    app.get('/metrics', async (req, res) => {
      try {
        const registry = getPrometheusRegistry();
        res.set('Content-Type', registry.contentType);
        res.end(await registry.metrics());
      } catch (err) {
        res.status(500).send(err.message);
      }
    });

    // Start HTTP server
    const PORT = process.env.PORT || DEFAULT_PORT;
    httpServer.listen(PORT, () => {
      // ... existing code ...
    });
  } catch (err) {
    // ... existing error handling ...
  }
}
```

---

### Bug #2: Undefined `fsSync` Module Reference
**File:** `task_broker.js`
**Lines:** 94-96
**Severity:** Critical
**Category:** Import Error

**Description:**
The code uses `fsSync.existsSync()` and `fsSync.readFileSync()` but only imports `fs` from "fs/promises". The `fsSync` variable is never defined, causing a ReferenceError at runtime.

**Current Code:**
```javascript
// Line 4
import fs from "fs/promises";

// Line 94
if (fsSync.existsSync(this.configPath)) {
  const data = fsSync.readFileSync(this.configPath, "utf-8");
  // ...
}
```

**Recommended Fix:**
Add the synchronous fs import:

```javascript
import fs from "fs/promises";
import fsSync from "fs";
```

---

## High Severity Bugs

### Bug #3: Missing Pool Initialization Check in Database Query
**File:** `src/database/connection.js`
**Lines:** 67-78
**Severity:** High
**Category:** Missing Validation

**Description:**
The `query()` function doesn't check if `pool` is initialized before using it, which could cause a null pointer error if called before `initDatabase()`.

**Current Code:**
```javascript
export async function query(text, params = []) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params); // pool might be null
    const duration = Date.now() - start;
    logger.debug('Query executed', { duration, rows: result.rowCount });
    return result;
  } catch (err) {
    logger.error('Query failed', { error: err.message, query: text });
    throw err;
  }
}
```

**Recommended Fix:**
Add initialization check like `getPool()` does:

```javascript
export async function query(text, params = []) {
  if (!pool) {
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

---

## Medium Severity Bugs

### Bug #4: Duplicate Method Definition - enableModelAutonomy
**File:** `npc_engine.js`
**Lines:** 468-505 and 773-775
**Severity:** Medium
**Category:** Code Structure

**Description:**
The `enableModelAutonomy()` method is defined twice in the NPCEngine class. The first definition (lines 468-505) is a full implementation, while the second (lines 773-775) delegates to AutonomyManager. The second definition will overwrite the first.

**Current Code:**
```javascript
// Lines 468-505 - First definition
enableModelAutonomy(options = {}) {
  this.disableModelAutonomy();
  // ... full implementation ...
}

// Lines 773-775 - Second definition
enableModelAutonomy(options = {}) {
  this.autonomyManager.enableModelAutonomy(options);
}
```

**Recommended Fix:**
Remove the first definition (lines 468-505) since the architecture uses AutonomyManager for this functionality.

---

### Bug #5: Duplicate Method Definition - validateManifest
**File:** `task_broker.js`
**Lines:** 115-170 and 213-223
**Severity:** Medium
**Category:** Code Structure

**Description:**
The `validateManifest()` method is defined twice with different implementations. The first returns a validation object with `{valid, errors}`, while the second throws errors directly.

**Current Code:**
```javascript
// Lines 115-170 - First definition
validateManifest(manifest) {
  const errors = [];
  // ... validation logic ...
  return {
    valid: errors.length === 0,
    errors
  };
}

// Lines 213-223 - Second definition
validateManifest(manifest) {
  if (!manifest.nodeName || typeof manifest.nodeName !== "string") {
    throw new Error("Manifest must have a valid nodeName");
  }
  // ... throws errors ...
}
```

**Recommended Fix:**
Remove one definition and standardize on a single validation approach. Recommend keeping the first approach (returning validation object) as it's more flexible.

---

### Bug #6: Logic Error in spawnAllKnown Method
**File:** `npc_spawner.js`
**Lines:** 306-323
**Severity:** Medium
**Category:** Logic Error

**Description:**
The method filters NPCs to get `toSpawn` (those not already active) for the spawn limit check, but then iterates over all `npcs` instead of just `toSpawn`, potentially attempting to spawn already-active NPCs.

**Current Code:**
```javascript
async spawnAllKnown(options = {}) {
  await this.initialize();
  const npcs = this.registry
    ? this.registry.listActive()
    : [];

  const currentlySpawned = this._countSpawnedBots();
  const toSpawn = npcs.filter(npc => npc.status !== "active");

  if (toSpawn.length > 0) {
    this._checkSpawnLimit(toSpawn.length);
  }

  const results = [];
  for (const profile of npcs) { // BUG: Should iterate over toSpawn
    const merged = {
      ...profile,
      ...options.overrides,
      position: options.overrides?.position || profile.spawnPosition || this.defaultPosition,
      autoSpawn: options.autoSpawn
    };
    const result = await this.spawn(merged);
    results.push(result);
  }
  return results;
}
```

**Recommended Fix:**
Change the iteration to use `toSpawn`:

```javascript
for (const profile of toSpawn) {
  const merged = {
    ...profile,
    ...options.overrides,
    position: options.overrides?.position || profile.spawnPosition || this.defaultPosition,
    autoSpawn: options.autoSpawn
  };
  const result = await this.spawn(merged);
  results.push(result);
}
```

---

### Bug #7: Missing Null Check for Registry
**File:** `routes/bot.js`
**Lines:** 14-16
**Severity:** Medium
**Category:** Missing Validation

**Description:**
The `countSpawnedBots()` function doesn't check if `npcEngine.registry` exists before calling `getAll()`, which could cause a null pointer error.

**Current Code:**
```javascript
function countSpawnedBots(npcEngine) {
  const allBots = npcEngine.registry.getAll();
  return allBots.filter(bot => bot.status === 'active').length;
}
```

**Recommended Fix:**
Add null check:

```javascript
function countSpawnedBots(npcEngine) {
  if (!npcEngine?.registry) return 0;
  const allBots = npcEngine.registry.getAll();
  return allBots.filter(bot => bot.status === 'active').length;
}
```

---

## Low Severity Bugs

### Bug #8: Division by Zero Risk in Success Rate Calculation
**File:** `routes/bot.js`
**Lines:** 169-170
**Severity:** Low
**Category:** Math Error

**Description:**
Calculating success rate without checking if the denominator is zero, which could result in `NaN` or `Infinity`.

**Current Code:**
```javascript
successRate: learningProfile.tasksCompleted /
  (learningProfile.tasksCompleted + learningProfile.tasksFailed) * 100,
```

**Recommended Fix:**
```javascript
successRate: (learningProfile.tasksCompleted + learningProfile.tasksFailed) > 0
  ? (learningProfile.tasksCompleted / (learningProfile.tasksCompleted + learningProfile.tasksFailed)) * 100
  : 0,
```

---

### Bug #9: Division by Zero Risk in Learning Profiles Endpoint
**File:** `routes/bot.js`
**Lines:** 720-721
**Severity:** Low
**Category:** Math Error

**Description:**
Same division by zero issue as Bug #8 in the learning profiles endpoint.

**Current Code:**
```javascript
successRate: p.tasksCompleted /
  (p.tasksCompleted + p.tasksFailed) * 100,
```

**Recommended Fix:**
```javascript
successRate: (p.tasksCompleted + p.tasksFailed) > 0
  ? (p.tasksCompleted / (p.tasksCompleted + p.tasksFailed)) * 100
  : 0,
```

---

### Bug #10: Unsafe Error Throwing in normalizeRole
**File:** `learning_engine.js`
**Lines:** 398-413
**Severity:** Low
**Category:** Error Handling

**Description:**
The `normalizeRole()` method throws errors for invalid roles, but it's called in `ensureProfile()` and `getOrCreateProfile()` without try-catch blocks. This could crash the application on invalid input.

**Current Code:**
```javascript
normalizeRole(role, npcId = "") {
  if (!role || typeof role !== "string" || role.trim().length === 0) {
    throw new Error(
      `Invalid role${npcId ? ` for ${npcId}` : ""}: role must be one of ${ALLOWED_ROLES.join(", ")}`
    );
  }

  const normalized = role.trim().toLowerCase();
  if (!ALLOWED_ROLES.includes(normalized)) {
    throw new Error(
      `Invalid role${npcId ? ` for ${npcId}` : ""}: ${role}. Valid roles: ${ALLOWED_ROLES.join(", ")}`
    );
  }

  return normalized;
}
```

**Recommended Fix:**
Either wrap calls in try-catch or modify to return a default:

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

---

## Summary

### Bug Distribution by Severity
- **Critical:** 2 bugs
- **High:** 1 bug
- **Medium:** 4 bugs
- **Low:** 3 bugs

### Bug Distribution by Category
- **Code Structure Issues (Duplicates):** 2 bugs
- **Missing Validation/Checks:** 4 bugs
- **Logic Errors:** 2 bugs
- **Import Errors:** 1 bug
- **Math Errors (Division by Zero):** 2 bugs
- **Error Handling:** 1 bug

### Priority Recommendations
1. **Immediate Action Required:** Fix Bug #2 (fsSync import) - this will cause runtime crashes
2. **High Priority:** Fix Bugs #1, #3 - these affect core functionality and stability
3. **Medium Priority:** Fix Bugs #4, #5, #6, #7 - these affect code maintainability and edge cases
4. **Low Priority:** Fix Bugs #8, #9, #10 - these are defensive improvements

### Files Requiring Updates
1. `server.js` - 1 bug
2. `task_broker.js` - 2 bugs
3. `src/database/connection.js` - 1 bug
4. `npc_engine.js` - 1 bug
5. `npc_spawner.js` - 1 bug
6. `routes/bot.js` - 3 bugs
7. `learning_engine.js` - 1 bug

---

**Review Completed By:** Claude (AI Code Review)
**Next Steps:** Prioritize fixes based on severity and test thoroughly after implementation.
