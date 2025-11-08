# Systematic Bug Review Checklist - FGD Codebase

This guide prioritizes files for systematic bug review based on complexity, criticality, and interconnections.

## PHASE 1: CRITICAL INFRASTRUCTURE (High Priority)

These files are foundational and their bugs cascade through the entire system.

### 1. Server Entry Point & Initialization
- **File:** `/home/user/FGD/server.js` (194 lines)
- **Focus Areas:**
  - Route registration order and conflicts
  - Async initialization sequence (database, telemetry, NPC system)
  - Error handling during startup
  - Express/Socket.io configuration
  - Middleware ordering

### 2. Database Layer
- **File:** `src/database/connection.js` (108 lines)
  - Connection pool exhaustion
  - Query error handling
  - Transaction rollback logic
- **File:** `src/database/schema.js` (123 lines)
  - Schema creation idempotency
  - Migration logic
- **File:** `src/database/redis.js` (244 lines)
  - Redis connection stability
  - Pub/Sub message ordering
  - Cache invalidation logic

### 3. Authentication & Authorization
- **File:** `middleware/auth.js` (311 lines)
- **Focus Areas:**
  - JWT token expiration handling
  - API key validation edge cases
  - Role enforcement consistency
  - Default credentials in production code
  - Token refresh logic

### 4. NPC System Initialization
- **File:** `src/services/npc_initializer.js` (221 lines)
- **Focus Areas:**
  - Component initialization order
  - Null/undefined reference checks
  - Error propagation from sub-components
  - Resource cleanup on failure

---

## PHASE 2: CORE AI ENGINES (High Priority)

These files contain the core logic for NPC behavior and task management.

### 5. NPCEngine (Master Task Manager)
- **File:** `/home/user/FGD/npc_engine.js` (1104 lines)
- **Focus Areas:**
  - Event listener memory leaks
  - Task dispatch conflicts
  - Manager initialization order
  - Task queue overflow handling
  - Exception handling in event handlers

### 6. NPC Microcore (Local Bot Loop)
- **File:** `core/npc_microcore.js` (457 lines)
- **Focus Areas:**
  - Timer cleanup on bot deletion
  - Race conditions in concurrent ticks
  - Memory leaks in event listeners
  - Position/velocity calculation accuracy
  - Circular buffer overflow

### 7. Task Broker
- **File:** `/home/user/FGD/task_broker.js` (740 lines)
- **Focus Areas:**
  - Queue back-pressure handling
  - Priority ordering consistency
  - Task timeout handling
  - Memory leaks with long-running queues

### 8. NPC Spawner
- **File:** `/home/user/FGD/npc_spawner.js` (448 lines)
- **Focus Areas:**
  - Spawn limit enforcement
  - Registry synchronization
  - Profile loading errors
  - Learning engine integration

---

## PHASE 3: MINECRAFT INTEGRATION (High Priority)

These files bridge between FGD and the Minecraft game.

### 9. Minecraft Bridge
- **File:** `/home/user/FGD/minecraft_bridge.js` (514 lines)
- **Focus Areas:**
  - RCON command formatting (injection vulnerabilities)
  - WebSocket plugin fallback logic
  - Error handling from Minecraft server
  - Bot state synchronization
  - Command queuing and ordering

### 10. WebSocket Plugin Interface
- **File:** `src/websocket/plugin.js` (242 lines)
- **Focus Areas:**
  - Message ordering guarantees
  - WebSocket reconnection logic
  - Buffer overflow in message queues
  - Error propagation from plugin

### 11. Bot Routes
- **File:** `routes/bot.js` (728 lines)
- **Focus Areas:**
  - Spawn limit enforcement
  - Bot deletion/cleanup
  - State synchronization with spawner
  - Socket.io broadcast consistency

---

## PHASE 4: LEARNING & PROGRESSION (Medium Priority)

These files handle persistent state and progression logic.

### 12. Learning Engine
- **File:** `/home/user/FGD/learning_engine.js` (421 lines)
- **Focus Areas:**
  - Profile save/load consistency
  - Skill calculation accuracy
  - JSON serialization edge cases
  - File I/O error handling

### 13. Progression Engine
- **File:** `core/progression_engine.js` (499 lines)
- **Focus Areas:**
  - Phase detection logic accuracy
  - Automatic advancement triggers
  - Phase state synchronization
  - NPC behavior adaptation per phase

### 14. NPC Registry
- **File:** `/home/user/FGD/npc_registry.js` (393 lines)
- **Focus Areas:**
  - Registry file parsing errors
  - Profile cloning accuracy
  - Concurrent registry updates
  - File locking during saves

### 15. NPC Finalizer
- **File:** `/home/user/FGD/npc_finalizer.js` (395 lines)
- **Focus Areas:**
  - Profile archival correctness
  - Resource cleanup completeness
  - State persistence before deletion

---

## PHASE 5: TASK PLANNING (Medium Priority - High Volume)

The /tasks/ directory has 36 files with 30,000+ lines total. These contain game logic bugs.

### Priority Task Files (largest/most complex):

- **plan_explore.js** (4357 lines)
  - Path planning correctness
  - Biome detection accuracy
  - POI discovery logic

- **plan_build.js** (3725 lines)
  - Blueprint interpretation
  - Block placement validation
  - Material calculation

- **plan_gather.js** (2835 lines)
  - Drop collection logic
  - Inventory management
  - Item deduplication

- **plan_combat.js** (2562 lines)
  - Target detection accuracy
  - Damage calculation
  - Enemy behavior prediction

### Crafting Subsystem (11 files):
- **craft_recipe_database.js** - Recipe correctness
- **craft_automation_system.js** - Multi-step execution
- **craft_enchantment_system.js** - Enchantment logic
- **craft_durability_manager.js** - Item durability tracking

---

## PHASE 6: API ROUTES & SERVICES (Medium Priority)

### 16. API Cluster Routes
- **File:** `src/api/cluster.js` (155 lines)
  - Metrics accuracy
  - Node management consistency

### 17. API NPC Routes
- **File:** `src/api/npcs.js` (218 lines)
  - CRUD operation consistency
  - Profile validation

### 18. LLM Routes
- **File:** `routes/llm.js` (461 lines)
  - LLM integration error handling
  - Command interpretation accuracy
  - Rate limiting

### 19. State Manager
- **File:** `src/services/state.js` (100 lines)
  - State synchronization with Socket.io
  - Memory usage tracking

### 20. Telemetry Pipeline
- **File:** `src/services/telemetry.js` (212 lines)
  - Metric collection accuracy
  - Event streaming reliability
  - Buffer management

---

## PHASE 7: UTILITIES & PATTERNS (Lower Priority)

### 21. Circuit Breaker
- **File:** `src/utils/circuit_breaker.js` (309 lines)
  - State transitions
  - Failure detection threshold
  - Recovery logic

### 22. Batch Processor
- **File:** `src/utils/batch_processor.js` (243 lines)
  - Batch timing accuracy
  - Memory efficiency
  - Flush guarantees

### 23. Worker Pool
- **File:** `src/utils/worker_pool.js` (237 lines)
  - Worker lifecycle management
  - Queue overflow handling
  - Worker health monitoring

---

## PHASE 8: GOVERNANCE & MONITORING (Lower Priority)

### 24. Autonomic Core
- **File:** `/home/user/FGD/autonomic_core.js` (567 lines)
  - Threshold accuracy
  - Metric collection
  - Policy enforcement timing

### 25. Policy Engine
- **File:** `/home/user/FGD/policy_engine.js` (504 lines)
  - Rule evaluation correctness
  - Resource allocation fairness
  - Conflict resolution

---

## PHASE 9: SUPPORTING SYSTEMS (Lower Priority)

### 26. Knowledge Store
- **File:** `/home/user/FGD/knowledge_store.js` (438 lines)

### 27. Fusion Core
- **File:** `/home/user/FGD/fusion_core.js` (529 lines)

### 28. Cognitive Link
- **File:** `/home/user/FGD/cognitive_link.js` (388 lines)

### 29. Peer Link
- **File:** `/home/user/FGD/peer_link.js` (418 lines)

### 30. Node Sync Manager
- **File:** `/home/user/FGD/node_sync_manager.js` (582 lines)

---

## RECOMMENDED BUG REVIEW STRATEGY

### Step 1: Infrastructure Review (1-2 hours)
Start with server.js → database → auth
- This establishes the foundation
- Bugs here affect everything downstream

### Step 2: AI Engine Review (2-3 hours)
Focus on npc_engine.js → microcore → task_broker
- These are the "heart" of the system
- Complex logic with many edge cases

### Step 3: Integration Review (2-3 hours)
Review minecraft_bridge.js → bot.js → websocket plugin
- Handles bidirectional game communication
- Critical for bot responsiveness

### Step 4: Task Planning Review (3-4 hours)
Sample review of largest task files
- plan_explore.js, plan_build.js, plan_gather.js
- Focus on algorithm correctness

### Step 5: Learning & Progression Review (1-2 hours)
Learning engine → progression engine → NPC registry
- Handles persistent state
- Critical for bot skill growth

### Step 6: API & Services Review (1-2 hours)
Review all /src/api/* routes and services
- Validate data consistency
- Check error handling

### Step 7: Utilities & Patterns Review (1 hour)
Circuit breaker, batch processor, worker pool
- Validate pattern implementation
- Check edge cases

---

## COMMON BUG PATTERNS TO WATCH FOR

### Async/Promise Issues
- Unhandled promise rejections
- Missing `await` statements
- Race conditions in concurrent operations
- Callback hell vs promise chains

### Memory Management
- Event listener cleanup
- Circular references
- Large data structure accumulation
- Map/Set memory leaks

### State Synchronization
- Registry out-of-sync with database
- Socket.io broadcast failures
- Profile version conflicts
- Distributed state inconsistencies

### Error Handling
- Null/undefined reference errors
- Missing error catch blocks
- Error message clarity
- Graceful degradation

### Data Validation
- Input sanitization (RCON commands!)
- Schema validation completeness
- Type coercion issues
- Boundary condition handling

### Timing Issues
- Race conditions in initialization
- Timer cleanup
- Event ordering
- Async operation sequencing

---

## TEST COVERAGE

### Existing Tests
- `test/npc_system.test.js` (366 lines)
- `test/npc_microcore.test.js` (26 lines)

### Critical Areas Without Tests
- minecraft_bridge.js
- task_broker.js
- Learning engine persistence
- Progression engine
- NPC spawner limits
- Auth token validation

---

## File Size Statistics (for Review Planning)

| Rank | File | Lines | Category |
|------|------|-------|----------|
| 1 | plan_explore.js | 4357 | Task |
| 2 | plan_build.js | 3725 | Task |
| 3 | plan_gather.js | 2835 | Task |
| 4 | plan_combat.js | 2562 | Task |
| 5 | server_old.js | 1582 | Deprecated |
| 6 | npc_engine.js | 1104 | Core |
| 7 | task_broker.js | 740 | Core |
| 8 | routes/bot.js | 728 | API |
| 9 | dashboard.js | 588 | UI |
| 10 | node_sync_manager.js | 582 | Network |

---

## Quick Bug Checklist by Category

### CRITICAL (Start Here)
- [ ] server.js initialization sequence
- [ ] Database connection handling
- [ ] JWT authentication
- [ ] NPCEngine event loops
- [ ] Microcore bot loop timers
- [ ] Minecraft bridge RCON commands

### HIGH IMPORTANCE
- [ ] Task queue overflow/backpressure
- [ ] Learning engine serialization
- [ ] NPC spawner limits
- [ ] WebSocket plugin reliability
- [ ] State synchronization

### MEDIUM IMPORTANCE
- [ ] Progression phase detection
- [ ] Autonomic core monitoring
- [ ] Circuit breaker transitions
- [ ] Batch processor timing
- [ ] API route validation

### LOWER PRIORITY
- [ ] Knowledge fusion logic
- [ ] Cognitive linking
- [ ] Peer synchronization
- [ ] Utility function edge cases

