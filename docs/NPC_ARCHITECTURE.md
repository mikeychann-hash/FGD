# NPC System Architecture

## Overview

The NPC System is a comprehensive autonomous agent framework for Minecraft, featuring persistent identity management, learning capabilities, task execution, and complete lifecycle tracking.

## System Components

### 1. NPCRegistry (`npc_registry.js`)
**Purpose**: Persistent storage for NPC identities, roles, and profiles.

**Responsibilities**:
- NPC profile creation and ID generation
- Personality trait management
- Spawn/despawn tracking
- Status management (active/inactive/retired/archived)
- Async file operations with save queue

**Data Structure**:
```javascript
{
  "version": 1,
  "npcs": [
    {
      "id": "miner_01",
      "npcType": "miner",
      "role": "miner",
      "appearance": { "skin": "default", "outfit": "overalls" },
      "spawnPosition": { "x": 100, "y": 65, "z": 200 },
      "personality": {
        "curiosity": 0.72,
        "patience": 0.58,
        "motivation": 0.85,
        "empathy": 0.45,
        "aggression": 0.30,
        "creativity": 0.62,
        "loyalty": 0.78
      },
      "personalitySummary": "highly motivated and curious",
      "personalityTraits": ["determined", "inquisitive"],
      "metadata": { "description": "...", "learning": {...} },
      "status": "active",
      "spawnCount": 5,
      "lastSpawnedAt": "2024-01-01T12:00:00.000Z",
      "lastDespawnedAt": null,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T12:00:00.000Z"
    }
  ]
}
```

**Key Methods**:
- `load()` - Load registry from disk
- `save()` - Save registry (debounced)
- `ensureProfile(options)` - Create or retrieve NPC profile
- `get(id)` - Get NPC by ID
- `getAll()` - Get all NPCs
- `listActive()` - Get active NPCs
- `recordSpawn(id, position)` - Record spawn event
- `recordDespawn(id, options)` - Record despawn event

### 2. LearningEngine (`learning_engine.js`)
**Purpose**: Tracks NPC skills, XP, and task history for progression.

**Responsibilities**:
- Skill tracking and progression
- XP accumulation
- Task success/failure recording
- Personality trait evolution
- Profile persistence

**Data Structure**:
```javascript
{
  "npc_id": {
    "role": "miner",
    "xp": 150,
    "tasksCompleted": 25,
    "tasksFailed": 3,
    "skills": {
      "mining": 12,
      "building": 5,
      "gathering": 3,
      "exploring": 2,
      "guard": 0
    },
    "personality": { ... },
    "createdAt": "2024-01-01T00:00:00.000Z",
    "lastActivity": "2024-01-01T12:00:00.000Z"
  }
}
```

**Key Methods**:
- `initialize()` - Load learning profiles
- `getOrCreateProfile(npcId, role)` - Get or create learning profile
- `getProfile(npcId)` - Get learning profile
- `recordTask(npcId, skill, success)` - Record task completion
- `incrementSkill(npcId, skill, amount)` - Increase skill level
- `forceSave()` - Immediately save profiles

### 3. NPCSpawner (`npc_spawner.js`)
**Purpose**: Orchestrates NPC creation, registration, and in-world spawning.

**Responsibilities**:
- Profile resolution (create or load)
- Learning data integration
- Engine registration
- Bridge communication for spawning
- Error recovery with retry logic
- Dead letter queue for failed spawns

**Spawning Process**:
```
1. Resolve Profile (create new or load existing)
   ↓
2. Merge Learning Data (if available)
   ↓
3. Register with Engine (if engine present)
   ↓
4. Spawn in World (via bridge, with retries)
   ↓
5. Record Spawn Event (update registry)
   ↓
6. Return Complete Profile
```

**Error Recovery**:
- **Retry Logic**: Up to 3 retries with exponential backoff (1s, 2s, 4s)
- **Dead Letter Queue**: Failed spawns queued for manual retry
- **Graceful Degradation**: Returns profile even if spawn fails

**Key Methods**:
- `spawn(options)` - Spawn single NPC
- `spawnAllKnown(options)` - Spawn all registered NPCs
- `getDeadLetterQueue()` - Get failed spawns
- `retryDeadLetterQueue()` - Retry failed spawns
- `clearDeadLetterQueue()` - Clear DLQ

### 4. NPCFinalizer (`npc_finalizer.js`)
**Purpose**: Proper NPC lifecycle closure with statistics archival.

**Responsibilities**:
- Final statistics collection
- Archive creation
- Registry status updates
- Learning profile cleanup
- Historical record keeping

**Finalization Process**:
```
1. Collect Final Statistics
   - Registry data
   - Learning data
   - Computed metrics (success rate, dominant skill, etc.)
   ↓
2. Remove from World (if requested)
   - Send despawn command via bridge
   ↓
3. Update Registry
   - Set status to 'retired' or 'archived'
   - Record final position
   ↓
4. Create Archive Entry
   - Store complete lifecycle data
   ↓
5. Cleanup (if not preserving)
   - Remove learning profile
   - Mark as archived
   ↓
6. Return Finalization Report
```

**Archive Structure**:
```javascript
{
  "npcId": "miner_01",
  "reason": "retirement",
  "finalizedAt": "2024-01-01T00:00:00.000Z",
  "stats": {
    "registry": { ... },
    "learning": { ... },
    "computed": {
      "totalTasks": 28,
      "successRate": 89.3,
      "dominantSkill": { "skill": "mining", "level": 12 },
      "totalXP": 150,
      "averageXPPerTask": 5.36,
      "totalLifetime": 86400000,  // ms
      "totalSpawns": 5
    }
  }
}
```

**Key Methods**:
- `finalizeNPC(npcId, options)` - Finalize NPC lifecycle
- `getArchive(filter)` - Get archived NPCs
- `getArchivedStats(npcId)` - Get specific archive entry
- `generateReport(npcId)` - Generate human-readable report

### 5. NPCIdentity (`npc_identity.js`)
**Purpose**: Identity composition and personality management utilities.

**Responsibilities**:
- Personality bundle building
- Trait description generation
- Learning data merging
- Profile normalization
- Deep cloning utilities

**Key Functions**:
- `buildPersonalityBundle(personality, traitsHelper)` - Create complete personality
- `applyPersonalityMetadata(metadata, bundle)` - Add personality to metadata
- `mergeLearningIntoProfile(profile, learning, traits)` - Merge learning data
- `serializeRegistryEntry(entry)` - Prepare for JSON storage
- `cloneValue(value)` - Deep clone objects

### 6. Traits (`traits.js`)
**Purpose**: Personality trait generation and management.

**Seven Core Traits**:
- **Curiosity**: Exploration and learning tendency
- **Patience**: Tolerance for repetition and delays
- **Motivation**: Drive to complete tasks
- **Empathy**: Cooperation and social behavior
- **Aggression**: Defensive and competitive tendencies
- **Creativity**: Problem-solving approaches
- **Loyalty**: Dedication to tasks and roles

**Key Methods**:
- `generate(count)` - Generate random trait values
- `describe(value)` - Convert 0-1 value to text description
- `buildDescription(personality)` - Generate personality summary
- `adjustTrait(value, delta)` - Modify trait (clamped 0-1)
- `compatibility(p1, p2)` - Calculate compatibility between NPCs

### 7. Logger (`logger.js`)
**Purpose**: Structured logging system with file output.

**Features**:
- Log levels: DEBUG, INFO, WARN, ERROR, FATAL
- JSON file output (daily rotation)
- Console output with colors
- Context-aware child loggers
- Automatic timestamps

**Usage**:
```javascript
import { logger } from './logger.js';

const log = logger.child({ component: 'NPCSpawner' });
log.info('NPC spawned', { npcId: 'miner_01', position: {...} });
log.error('Spawn failed', { npcId: 'failed', error: err.message });
```

### 8. Validator (`validator.js`)
**Purpose**: Schema validation for NPC profiles and data structures.

**Features**:
- JSON Schema validation
- Type checking (object, array, string, number, boolean, null)
- Property validation (required, min/max, pattern)
- Error reporting with paths

**Usage**:
```javascript
import { validator } from './validator.js';

try {
  validator.validate(profile, 'npc_profile');
  // Profile is valid
} catch (error) {
  console.error('Validation errors:', error.errors);
}
```

## Data Flow

### NPC Creation Flow
```
User/API Request
  ↓
NPCSpawner.spawn()
  ↓
NPCRegistry.ensureProfile() ← Creates/loads profile
  ↓
LearningEngine.getProfile() ← Loads learning data
  ↓
mergeLearningIntoProfile() ← Combines data
  ↓
NPCRegistry.upsert() ← Saves merged profile
  ↓
MinecraftBridge.spawnEntity() ← Spawns in world
  ↓
NPCRegistry.recordSpawn() ← Updates spawn count
  ↓
Return complete profile to caller
```

### Task Execution Flow
```
Task Queued
  ↓
NPCEngine.assignTask(npc, task)
  ↓
DispatchManager.assignTask()
  ↓
MinecraftBridge.dispatchTask() ← Sends to Minecraft
  ↓
[NPC executes in world]
  ↓
Bridge receives completion event
  ↓
DispatchManager.completeTask()
  ↓
LearningEngine.recordTask() ← Updates XP/skills
  ↓
Task complete, NPC returns to idle
```

### NPC Finalization Flow
```
Finalization Request
  ↓
NPCFinalizer.finalizeNPC()
  ↓
Collect stats (Registry + Learning)
  ↓
MinecraftBridge.despawnNPC() ← Remove from world
  ↓
NPCRegistry.recordDespawn() ← Update status
  ↓
Create archive entry
  ↓
NPCFinalizer.save() ← Persist archive
  ↓
LearningEngine.deleteProfile() (if not preserving)
  ↓
Return finalization report
```

## File Structure

```
FGD/
├── npc_registry.js          # NPC profile storage
├── npc_spawner.js           # Spawning orchestration
├── npc_finalizer.js         # Lifecycle closure
├── npc_identity.js          # Identity utilities
├── learning_engine.js       # Skill/XP tracking
├── traits.js                # Personality system
├── logger.js                # Logging system
├── validator.js             # Schema validation
├── server.js                # API server
├── npc_profile.schema.json  # Validation schema
├── data/
│   ├── npc_registry.json    # Active NPCs
│   ├── npc_profiles.json    # Learning data
│   └── npc_archive.json     # Finalized NPCs
├── logs/
│   └── app-YYYY-MM-DD.log   # Daily logs
├── test/
│   └── npc_system.test.js   # Test suite
└── docs/
    ├── NPC_API.md           # API documentation
    └── NPC_ARCHITECTURE.md  # This file
```

## Design Principles

### 1. Separation of Concerns
Each component has a single, well-defined responsibility:
- **Registry**: Storage
- **Spawner**: Orchestration
- **Finalizer**: Closure
- **Learning**: Progression
- **Identity**: Composition

### 2. Error Resilience
- Automatic retries with exponential backoff
- Dead letter queues for persistent failures
- Graceful degradation when components fail
- Comprehensive error logging

### 3. Data Persistence
- All state changes immediately saved to disk
- Async save queues prevent file corruption
- Backup on corrupt file detection
- Transaction-safe operations

### 4. Modularity
- Each component can be used independently
- Dependency injection for flexibility
- Optional components (e.g., bridge, engine)
- Clean interfaces between layers

### 5. Observability
- Structured logging with context
- Comprehensive metrics endpoints
- Health checks for all components
- Event emissions for monitoring

## Extension Points

### Adding New NPC Types
1. Update `npc_profile.schema.json` with new type
2. Add type-specific behavior in `npc_engine.js`
3. Update spawner appearance mappings
4. Add type-specific skills to learning engine

### Adding New Personality Traits
1. Add trait to `traits.js` (TRAIT_SCHEMA)
2. Update validation in `validator.js`
3. Implement trait-based behavior in engine
4. Update description generation

### Custom Finalization Hooks
```javascript
const finalizer = new NPCFinalizer({
  registry,
  learningEngine,
  onBeforeFinalize: async (npcId) => {
    // Custom pre-finalization logic
  },
  onAfterFinalize: async (npcId, report) => {
    // Custom post-finalization logic
  }
});
```

## Performance Considerations

### Memory Management
- Registry uses Map for O(1) lookups
- Save queues prevent excessive disk I/O
- Pagination on list endpoints
- Archive queries filterable

### Scalability
- Async operations throughout
- No blocking synchronous file I/O
- Stateless API endpoints
- Horizontal scaling ready (with shared storage)

### Bottlenecks
- File I/O (mitigated by debouncing)
- Minecraft bridge communication
- Archive size growth (consider rotation)

## Security Considerations

- Input validation on all API endpoints
- Schema validation for NPC profiles
- No code injection in personality data
- Rate limiting (future enhancement)
- Authentication (future enhancement)

## Future Enhancements

1. **Personality Evolution**: Dynamic trait adjustment based on experience
2. **NPC Relationships**: Cooperation and compatibility systems
3. **Advanced Metrics**: Performance profiling and analytics
4. **Backup/Restore**: Snapshot and recovery functionality
5. **Migration System**: Schema versioning and upgrades
6. **Distributed System**: Multi-server coordination
7. **Machine Learning**: Behavioral pattern learning
8. **WebUI**: Admin dashboard for NPC management
