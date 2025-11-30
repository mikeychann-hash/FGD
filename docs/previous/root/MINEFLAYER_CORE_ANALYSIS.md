# MINEFLAYER CORE ANALYSIS

**Analysis Date:** 2025-11-18
**FGD Version:** 2.1.0
**Target:** Extract all capabilities from core Mineflayer repositories for FGD integration

---

## Executive Summary

This document provides a comprehensive analysis of the core Mineflayer ecosystem repositories to identify capabilities that FGD should implement. The analysis covers five primary repositories and their APIs, comparing them against FGD's current implementation to identify gaps and integration opportunities.

**Key Findings:**
- Mineflayer supports Minecraft versions **1.8 through 1.21.8** with automatic version detection
- FGD currently implements **basic movement, inventory, and interaction** but lacks many advanced features
- Critical missing implementations: **combat mechanics, crafting automation, window management, NBT handling, advanced physics**
- Version compatibility: FGD uses `mineflayer: ^4.0.0` which is up-to-date with current releases

---

## 1. Mineflayer Main Library Analysis

**Repository:** https://github.com/PrismarineJS/mineflayer
**Purpose:** Core bot creation, control, and world interaction library

### 1.1 Core Features

#### **World & Entity Management**
- **Entity Knowledge & Tracking**
  - Real-time entity tracking (players, mobs, items, vehicles)
  - Entity position, health, velocity monitoring
  - Nearest entity queries with filtering
  - Entity metadata and NBT data access

- **Block Knowledge & Query System**
  - Millisecond-level block queries across loaded chunks
  - Block state, metadata, and properties
  - Block hardness, diggable status, material types
  - Biome detection and environmental data

- **Physics Engine Integration**
  - Bounding box collision detection
  - Gravity, velocity, and acceleration simulation
  - Water/lava physics interactions
  - Elytra flight and firework propulsion

#### **Player Control & Movement**
- **Navigation & Locomotion**
  - Physics-based movement simulation
  - Sprint, sneak, jump mechanics
  - Auto-jump capability tracking
  - Vehicle control (minecarts, boats, horses)

- **Pathfinding Integration**
  - A* pathfinding with mineflayer-pathfinder plugin
  - Goal-based navigation system
  - Obstacle avoidance and terrain analysis
  - Dynamic rerouting

#### **Building & Interaction**
- **Block Operations**
  - Block placement with face targeting
  - Block destruction (digging)
  - Tool selection for optimal mining
  - Multi-block structure building

- **Container Interaction**
  - Chest, furnace, dispenser access
  - Enchantment table interaction
  - Crafting table and inventory crafting
  - Window/GUI management system

- **Item Management**
  - Inventory slot manipulation
  - Item activation and use
  - Equipment management (armor, tools, weapons)
  - Item dropping and pickup

#### **Combat & Defense**
- **Entity Attacking**
  - Melee attack mechanics
  - Attack cooldown tracking
  - Critical hit detection
  - Knockback calculation

- **Health & Status Awareness**
  - Health and hunger monitoring
  - Effect tracking (poison, regeneration, etc.)
  - Death detection and respawn handling
  - Environmental hazard awareness

#### **Communication**
- **Chat System**
  - Message sending and receiving
  - Command execution
  - Whisper/DM support
  - Chat event filtering

### 1.2 Key APIs & Methods

#### **Bot Creation**
```javascript
const mineflayer = require('mineflayer');
const bot = mineflayer.createBot({
  host: 'localhost',
  port: 25565,
  username: 'BotName',
  auth: 'offline|microsoft',
  version: '1.21.8' // Auto-detected if not specified
});
```

#### **Core Bot Properties**
- `bot.entity` - Bot's entity object (position, velocity, yaw, pitch)
- `bot.entities` - Object of all entities in view
- `bot.health` - Current health (0-20)
- `bot.food` - Current hunger level (0-20)
- `bot.inventory` - Inventory management interface
- `bot.game` - Game mode, dimension, difficulty
- `bot.time` - Game time and weather

#### **Movement & Navigation**
- `bot.setControlState(control, active)` - Control states: forward, back, left, right, jump, sprint, sneak
- `bot.look(yaw, pitch, force)` - Look direction control
- `bot.lookAt(point)` - Look at specific position
- `bot.entity.position` - Current position (Vec3)
- `bot.entity.velocity` - Current velocity (Vec3)

#### **Block Interaction**
- `bot.blockAt(point)` - Get block at position (instant lookup)
- `bot.dig(block)` - Mine/destroy block
- `bot.placeBlock(referenceBlock, faceVector)` - Place block
- `bot.activateBlock(block)` - Right-click block (open chest, press button, etc.)
- `bot.canSeeBlock(block)` - Line-of-sight check

#### **Entity Operations**
- `bot.nearestEntity(filter?)` - Find nearest entity matching filter
- `bot.attack(entity)` - Attack entity
- `bot.mount(entity)` - Mount vehicle/animal
- `bot.dismount()` - Dismount vehicle

#### **Inventory Management**
- `bot.inventory.slots` - Array of all inventory slots
- `bot.inventory.items()` - Array of non-null items
- `bot.equip(item, destination)` - Equip item to hand/armor slot
- `bot.toss(itemType, metadata, count)` - Drop items
- `bot.craft(recipe, count)` - Craft items
- `bot.openContainer(containerBlock)` - Open chest/furnace/etc.

#### **Communication**
- `bot.chat(message)` - Send chat message
- `bot.whisper(username, message)` - Send private message
- Event: `bot.on('chat', (username, message) => {})` - Receive chat

#### **Core Events**
- `spawn` - Bot spawned in world
- `kicked` - Kicked from server
- `end` - Connection ended
- `error` - Error occurred
- `health` - Health/food changed
- `death` - Bot died
- `physicsTick` - Physics update (every 50ms)
- `move` - Bot moved
- `chat` - Chat message received
- `entitySpawn` - Entity spawned
- `entityGone` - Entity despawned
- `entityMoved` - Entity moved
- `blockUpdate` - Block changed

### 1.3 FGD Current Implementation Status

✅ **Implemented:**
- Bot connection and lifecycle management (`MineflayerBridge`)
- Basic movement with pathfinding integration (`moveToTarget`, `navigateWaypoints`)
- Entity following (`followEntity`)
- Block digging (`_mineBlock`)
- Block placement (`_placeBlock`)
- Block interaction (`_interact`)
- Basic inventory operations (`_getInventory`, `_equipItem`, `_dropItem`)
- Health monitoring and state tracking
- Event subscription system

❌ **Missing:**
- **Combat mechanics** (attack, defend, critical hits)
- **Crafting automation** (recipe discovery, multi-step crafting)
- **Window management** (chest transfer, furnace automation, enchanting)
- **Advanced movement** (elytra flight, vehicle control, swimming)
- **Entity mounting** (horses, minecarts, boats)
- **Chat command parsing** and response automation
- **Experience and enchanting** management
- **Death handling** and respawn logic
- **Physics tick integration** for precise timing
- **Tool selection** optimization for mining

---

## 2. minecraft-protocol Analysis

**Repository:** https://github.com/PrismarineJS/node-minecraft-protocol
**Purpose:** Low-level Minecraft protocol parsing, serialization, and network handling

### 2.1 Protocol Features

#### **Packet Handling**
- **Bidirectional Parsing**
  - Parse incoming packets → JavaScript objects
  - Serialize JavaScript objects → outgoing packets
  - Automatic packet ID mapping per version
  - Full packet schema validation

- **Packet Types**
  - Login/authentication packets
  - Play state packets (movement, block updates, entities)
  - Status ping/query packets
  - Configuration packets

#### **Version Compatibility**
- **Supported Versions:** 1.7.10 through 1.21.8
- **Snapshots & Pre-releases:** Extensive snapshot support
- **Protocol Version Mapping:** Automatic detection and version negotiation
- **Breaking Changes:** Transparent handling across protocol versions

#### **Authentication Methods**

##### **1. Offline Mode**
```javascript
const client = mc.createClient({
  host: 'localhost',
  port: 25565,
  username: 'BotName',
  auth: 'offline'
});
```
- No Microsoft/Mojang validation
- For private servers with `online-mode=false`
- No encryption or profile validation

##### **2. Microsoft Authentication**
```javascript
const client = mc.createClient({
  host: 'server.com',
  port: 25565,
  auth: 'microsoft',
  // Token caching for repeated logins
});
```
- Full Microsoft OAuth flow
- Cached token management
- Profile verification
- Xbox Live integration

##### **3. Realms Support**
```javascript
const client = mc.createClient({
  realms: {
    pickRealm: (realms) => realms[0] // Select realm
  },
  auth: 'microsoft'
});
```
- Microsoft Realm server discovery
- Account ownership verification
- Automatic realm invitation handling

#### **Connection Management**

- **DNS Service Records (SRV)**
  - Automatic `_minecraft._tcp.domain.com` resolution
  - Port discovery from DNS
  - Fallback to standard port 25565

- **Keep-Alive Handling**
  - Automatic keep-alive packet responses
  - Connection timeout detection
  - Ping/latency measurement

- **Server Status Pinging**
```javascript
mc.ping({ host, port }, (err, result) => {
  console.log(result.version.name); // "1.21.8"
  console.log(result.players.online); // Current player count
  console.log(result.description); // MOTD
});
```

#### **Security & Performance**

- **Encryption**
  - AES/CFB8 stream cipher
  - RSA key exchange
  - Transparent encryption layer
  - No manual key management needed

- **Compression**
  - Zlib compression for large packets
  - Automatic threshold detection
  - Configurable compression level
  - Bandwidth optimization

#### **Error Handling**
- Connection errors (timeout, refused, DNS failure)
- Protocol errors (invalid packets, version mismatch)
- Authentication errors (invalid credentials, banned)
- Kick/disconnect reasons parsing

### 2.2 FGD Current Implementation Status

✅ **Implemented:**
- Basic connection via Mineflayer (which uses minecraft-protocol)
- Offline authentication mode
- Automatic version detection (defaults to 1.21.8)
- Basic error handling and reconnection logic

❌ **Missing:**
- **Microsoft authentication** integration
- **Realms support** for hosted servers
- **SRV record resolution** for domain-based servers
- **Custom packet handling** for mods/plugins
- **Compression level tuning** for bandwidth optimization
- **Server status pinging** before connection
- **Protocol encryption validation** and debugging
- **Advanced error recovery** (banned handling, rate limiting)

### 2.3 Integration Recommendations

1. **Add Microsoft Authentication Support**
   ```javascript
   // adapters/mineflayer/auth_manager.js
   export class AuthenticationManager {
     async authenticateWithMicrosoft(credentials) {
       // Microsoft OAuth flow
       // Token caching
       // Refresh token handling
     }
   }
   ```

2. **Implement Server Discovery**
   ```javascript
   async function discoverServer(hostname) {
     // SRV record lookup
     // Fallback to ping
     // Return host + port + version
   }
   ```

3. **Add Pre-Connection Validation**
   - Ping server before creating bot
   - Check version compatibility
   - Validate player count/whitelist status

---

## 3. prismarine-physics Analysis

**Repository:** https://github.com/PrismarineJS/prismarine-physics
**Purpose:** Minecraft player physics simulation engine

### 3.1 Physics Simulation

#### **Core Simulation Loop**
```javascript
const { Physics, PlayerState } = require('prismarine-physics');
const physics = Physics(mcData, world);

// Create player state
const state = new PlayerState(bot, controls);

// Simulate one tick (50ms)
physics.simulatePlayer(state, world);
```

#### **Movement Mechanics**

##### **Ground Movement**
- **Directional Controls:**
  - `forward` - Move forward
  - `back` - Move backward
  - `left` - Strafe left
  - `right` - Strafe right

- **Movement Speed Modifiers:**
  - Walking: 4.317 m/s
  - Sprinting: 5.612 m/s
  - Sneaking: 1.295 m/s
  - Flying (creative): 10.92 m/s

##### **Sprint Mode**
- Enhanced movement speed (130% of walk speed)
- Requires hunger > 6
- Auto-sprint when double-tapping forward
- FOV increase effect

##### **Sneaking**
- Slower, controlled movement (30% of walk speed)
- Prevents falling off blocks (edge detection)
- Reduced collision box height
- Prevents detection by mobs

##### **Jumping**
- Jump initiation with `jump` control
- Jump velocity: 0.42 m/tick
- Auto-jump capability tracking via `jumpTicks`
- Jump height: ~1.25 blocks

#### **Environmental Physics**

##### **Water Interaction** (`isInWater`)
- Movement resistance (reduced speed)
- Buoyancy simulation
- Swimming mechanics
- Drowning detection (air meter)
- Water current effects

##### **Lava Interaction** (`isInLava`)
- Movement resistance (severe)
- Damage tick tracking
- Visual obstruction
- Fire effect application

##### **Web Collision** (`isInWeb`)
- Severe movement restriction (15% speed)
- No fall damage while in web
- Slow vertical movement

#### **Collision Detection**

##### **Horizontal Collision** (`isCollidedHorizontally`)
- Wall/block collision
- Entity pushing
- Fence/wall special cases
- Slime block bouncing

##### **Vertical Collision** (`isCollidedVertically`)
- Ceiling collision
- Ground collision
- Slab/stair step-up
- Ladder climbing

##### **Ground Detection** (`onGround`)
- Fall damage calculation
- Jump availability
- Sprint initiation
- Step sound effects

#### **Advanced Movement**

##### **Elytra Flying** (`elytraFlying`)
- Gliding mechanics
- Pitch-based acceleration/deceleration
- Firework propulsion integration
- Durability tracking
- Collision detection while flying

##### **Firework Propulsion** (`fireworkRocketDuration`)
- Boost duration tracking
- Velocity increase calculation
- Explosion effect timing
- Durability cost

#### **Key Configuration Parameters**

##### **PlayerState Properties**
```javascript
const state = {
  // Position
  pos: new Vec3(x, y, z),
  vel: new Vec3(0, 0, 0), // Velocity

  // Rotation
  yaw: 0,    // Horizontal rotation
  pitch: 0,  // Vertical rotation

  // Controls (boolean states)
  control: {
    forward: false,
    back: false,
    left: false,
    right: false,
    jump: false,
    sprint: false,
    sneak: false
  },

  // State flags
  onGround: true,
  isInWater: false,
  isInLava: false,
  isInWeb: false,
  isCollidedHorizontally: false,
  isCollidedVertically: false,
  elytraFlying: false,

  // Tracking
  jumpTicks: 0,
  fireworkRocketDuration: 0
};
```

### 3.2 Physics Tick Integration

**Standard Tick Rate:** 20 TPS (ticks per second) = 50ms per tick

```javascript
// Physics simulation loop
setInterval(() => {
  physics.simulatePlayer(playerState, world);

  // Update bot position from physics
  bot.entity.position.set(
    playerState.pos.x,
    playerState.pos.y,
    playerState.pos.z
  );

  // Update velocity
  bot.entity.velocity.set(
    playerState.vel.x,
    playerState.vel.y,
    playerState.vel.z
  );
}, 50); // 50ms = 1 tick
```

### 3.3 FGD Current Implementation Status

✅ **Implemented:**
- Basic movement controls via Mineflayer's abstraction
- Position and velocity tracking
- Ground detection (via Mineflayer)

❌ **Missing:**
- **Direct physics engine integration** (relying on Mineflayer's internal physics)
- **Custom physics simulation** for predictive pathfinding
- **Elytra flight mechanics** and control
- **Swimming optimization** and water navigation
- **Precise collision prediction** for building
- **Sprint/sneak state management** automation
- **Jump optimization** (edge jumps, precise parkour)
- **Physics-based damage calculation** (fall damage prediction)

### 3.4 Integration Recommendations

1. **Add Physics Predictor**
   ```javascript
   // adapters/mineflayer/physics_predictor.js
   export class PhysicsPredictor {
     predictTrajectory(startPos, startVel, ticks) {
       // Simulate physics forward
       // Return predicted positions
     }

     calculateFallDamage(height) {
       // (height - 3) blocks = damage
       return Math.max(0, Math.ceil(height - 3));
     }
   }
   ```

2. **Elytra Flight Controller**
   ```javascript
   export class ElytraController {
     async flyToTarget(bot, target) {
       // Equip elytra
       // Jump and activate
       // Adjust pitch for glide
       // Use fireworks for boost
     }
   }
   ```

3. **Advanced Movement Optimizer**
   - Calculate optimal jump timing for parkour
   - Predict landing positions
   - Optimize sprint/jump combinations
   - Water navigation with current prediction

---

## 4. prismarine-windows Analysis

**Repository:** https://github.com/PrismarineJS/prismarine-windows
**Purpose:** Minecraft window and inventory GUI management

### 4.1 Core Capabilities

#### **Window Creation & Management**
```javascript
const windows = require('prismarine-windows')('1.21.8');

// Create window instance
const window = new windows.Window(
  windowId,        // Unique window ID
  'minecraft:chest', // Window type
  'Large Chest',    // Display name
  54               // Slot count
);
```

#### **Supported Window Types**

##### **Container Windows**
1. **minecraft:inventory** (Player inventory)
   - 36 inventory slots
   - 9 hotbar slots
   - 4 armor slots
   - 1 offhand slot
   - Total: 46 slots

2. **minecraft:chest** (Chest, Large Chest, Ender Chest)
   - Small chest: 27 slots
   - Large chest: 54 slots
   - Ender chest: 27 slots

3. **minecraft:shulker_box**
   - 27 slots
   - Portable storage
   - NBT data preservation

4. **minecraft:barrel**
   - 27 slots
   - Similar to chest

##### **Crafting Windows**
5. **minecraft:crafting_table** (Crafting Table)
   - 9 crafting grid slots
   - 1 output slot
   - Access to all recipes

6. **minecraft:crafting** (Inventory Crafting)
   - 4 crafting grid slots (2x2)
   - 1 output slot
   - Limited recipe access

##### **Smelting/Processing Windows**
7. **minecraft:furnace**
   - 1 input slot (ore/food)
   - 1 fuel slot (coal, lava bucket, etc.)
   - 1 output slot (smelted item)
   - Progress tracking

8. **minecraft:blast_furnace**
   - Same as furnace
   - 2x speed for ores only

9. **minecraft:smoker**
   - Same as furnace
   - 2x speed for food only

##### **Trading & Enchanting Windows**
10. **minecraft:enchanting_table**
    - 1 item slot
    - 1 lapis slot
    - 3 enchantment options
    - Level requirements

11. **minecraft:anvil**
    - 2 input slots (item + modifier)
    - 1 output slot
    - XP cost calculation

12. **minecraft:villager** (Trading)
    - Multiple trade slots
    - Trade offer management
    - Experience tracking

##### **Brewing & Beacons**
13. **minecraft:brewing_stand**
    - 3 potion slots
    - 1 ingredient slot
    - 1 fuel slot (blaze powder)
    - Brewing progress

14. **minecraft:beacon**
    - 1 payment slot (diamond, emerald, etc.)
    - Effect selection UI
    - Range and level display

##### **Other Windows**
15. **minecraft:hopper** (5 slots)
16. **minecraft:dropper** (9 slots)
17. **minecraft:dispenser** (9 slots)
18. **minecraft:cartography_table**
19. **minecraft:loom**
20. **minecraft:stonecutter**
21. **minecraft:grindstone**
22. **minecraft:smithing_table**

#### **Inventory Operations**

##### **Slot Management**
```javascript
// Update specific slot
window.updateSlot(slotId, item);

// Get slot contents
const item = window.slots[slotId];

// Check if slot is empty
if (window.slots[slotId] === null) {
  // Slot is empty
}
```

##### **Item Structure**
```javascript
const item = {
  type: 1,           // Item ID (numeric)
  count: 64,         // Stack size
  metadata: 0,       // Damage/variant
  nbt: {...},        // NBT data (enchantments, etc.)
  name: 'stone',     // Item name
  displayName: 'Stone', // Display name
  stackSize: 64      // Max stack size
};
```

#### **Window Events**
- `windowOpen` - Window opened by server
- `windowClose` - Window closed
- `updateSlot` - Slot contents changed
- `setSlot` - Specific slot set
- `craft` - Item crafted

### 4.2 Multi-Version Support

**Version Initialization:**
```javascript
// Version-specific window definitions
const windows_1_8 = require('prismarine-windows')('1.8');
const windows_1_16 = require('prismarine-windows')('1.16.5');
const windows_1_21 = require('prismarine-windows')('1.21.8');
```

**Version Differences:**
- 1.8: No offhand slot
- 1.9+: Offhand slot added
- 1.14+: New villager trading UI
- 1.16+: Netherite smithing
- 1.20+: Armor trim smithing

### 4.3 FGD Current Implementation Status

✅ **Implemented:**
- Basic inventory viewing (`_getInventory`)
- Item equipping (`_equipItem`)
- Item dropping (`_dropItem`)

❌ **Missing:**
- **Window opening** and closing automation
- **Chest interaction** (transfer items to/from chest)
- **Furnace automation** (smelting operations)
- **Crafting table usage** (complex recipes)
- **Enchanting automation** (enchant selection)
- **Anvil operations** (repair, rename, combine)
- **Villager trading** automation
- **Beacon management** (effect selection)
- **Brewing stand** automation
- **Slot clicking** strategies (shift-click, drag, quick-move)
- **Window state tracking** (open windows, pending operations)

### 4.4 Integration Recommendations

1. **Create WindowManager**
   ```javascript
   // adapters/mineflayer/window_manager.js
   export class WindowManager {
     async openChest(bot, chestBlock) {
       // Open chest window
       // Wait for window open event
       // Return window object
     }

     async transferItems(bot, window, items) {
       // Transfer items between windows
       // Optimize with shift-clicks
       // Handle full containers
     }

     async closeWindow(bot) {
       // Close current window
       // Return items to inventory
     }
   }
   ```

2. **Add Crafting Automation**
   ```javascript
   export class CraftingManager {
     async craftItem(bot, recipe, count) {
       // Find crafting table or use inventory crafting
       // Open window
       // Place ingredients
       // Retrieve output
       // Repeat for count
     }

     async findRecipe(bot, itemName) {
       // Search recipe database
       // Check ingredient availability
       // Return recipe if possible
     }
   }
   ```

3. **Implement Furnace Controller**
   ```javascript
   export class FurnaceController {
     async smeltItems(bot, furnaceBlock, items, fuel) {
       // Open furnace
       // Place items in input
       // Place fuel
       // Wait for completion
       // Retrieve output
     }
   }
   ```

---

## 5. prismarine-nbt Analysis

**Repository:** https://github.com/PrismarineJS/prismarine-nbt
**Purpose:** Named Binary Tag (NBT) data parsing and serialization

### 5.1 Core Parsing Capabilities

#### **Primary Parsing Functions**

##### **parse() - Promise/Callback Based**
```javascript
const nbt = require('prismarine-nbt');

// Promise-based
nbt.parse(buffer).then(({ parsed, type }) => {
  console.log('Tag type:', type);
  console.log('Data:', parsed);
});

// Callback-based
nbt.parse(buffer, (error, data) => {
  if (error) throw error;
  console.log(data.parsed);
});
```

- Handles **optionally compressed** data (gzip/zlib)
- Automatic decompression
- Returns parsed NBT object + root tag type

##### **parseUncompressed() - Synchronous**
```javascript
const { parsed, type, metadata } = nbt.parseUncompressed(buffer);
```

- Requires uncompressed buffer
- Synchronous operation (faster for known uncompressed data)
- Optional array size validation
- Returns metadata (buffer size, offset, etc.)

##### **parseAs() - Format-Specific**
```javascript
// Automatically decompress gzipped data
const data = nbt.parseAs(gzippedBuffer, 'big');
```

- Automatic gzip decompression before parsing
- Specify format explicitly
- Useful for known compressed NBT files

### 5.2 Format Support

#### **Endianness Formats**

1. **'big'** (Big-endian - Java Edition)
   - Used by Java Edition Minecraft
   - Level.dat, player.dat files
   - Structure files (.nbt)
   - Default for most operations

2. **'little'** (Little-endian - Bedrock Edition)
   - Used by Bedrock Edition
   - MCPE worlds
   - Different byte order

3. **'littleVarint'** (Little-endian with VarInt)
   - Bedrock Edition network protocol
   - Variable-length integers
   - Network packet optimization

#### **Automatic Format Detection**
```javascript
// Try all formats sequentially until one succeeds
nbt.parse(buffer, (error, data) => {
  // Automatically detects big/little/littleVarint
});
```

### 5.3 Serialization

#### **writeUncompressed() - Buffer Generation**
```javascript
const buffer = nbt.writeUncompressed(nbtData, 'big');
```

- Generates uncompressed NBT buffer
- Specify endianness format
- Default: big-endian
- Returns Buffer object ready for file/network

### 5.4 Data Type Builders

#### **Compound Tags** (`comp()`)
```javascript
const compound = nbt.comp({
  name: nbt.string('PlayerName'),
  health: nbt.float(20.0),
  position: nbt.list(nbt.double([100.5, 64.0, 200.5]))
});
```

- Key-value pairs (like JSON objects)
- Nested compound support
- Named tags

#### **List Tags** (`list()`)
```javascript
const list = nbt.list(nbt.int([1, 2, 3, 4, 5]));
```

- Ordered collection of same-type tags
- Array-like structure
- Type homogeneity enforced

#### **Primitive Type Builders**

```javascript
// Numeric types
nbt.byte(127);           // 8-bit signed (-128 to 127)
nbt.short(32000);        // 16-bit signed
nbt.int(2147483647);     // 32-bit signed
nbt.long([0, 1000000]);  // 64-bit signed (array format)
nbt.float(3.14159);      // 32-bit floating point
nbt.double(2.71828);     // 64-bit floating point

// Other types
nbt.string('Hello World');     // UTF-8 string
nbt.byteArray(Buffer.from([1,2,3])); // Byte array
nbt.intArray([100, 200, 300]);       // Integer array
nbt.longArray([[0,10], [0,20]]);     // Long array
```

### 5.5 Utility Functions

#### **simplify() - Convert to Plain JavaScript**
```javascript
const complex = nbt.comp({
  health: nbt.float(20.0),
  name: nbt.string('Player')
});

const simple = nbt.simplify(complex);
// Result: { health: 20.0, name: 'Player' }
```

- Removes NBT wrapper objects
- Converts to plain JavaScript objects
- **Loses type information** (cannot serialize back without re-typing)
- Easier for JSON operations

#### **equal() - Deep Comparison**
```javascript
const isEqual = nbt.equal(nbtObj1, nbtObj2);
```

- Compares two NBT objects for equivalence
- Deep comparison (nested tags)
- Type-aware comparison

#### **protos - Protocol Definitions**
```javascript
const protoBig = nbt.protos.big;
const protoLittle = nbt.protos.little;
```

- Access pre-compiled ProtoDef protocol definitions
- Big-endian and little-endian variants
- Used for custom parsing/serialization

### 5.6 Integration with ProtoDef

#### **addTypesToCompiler()**
```javascript
const ProtoDef = require('protodef').ProtoDef;
const proto = new ProtoDef();
nbt.addTypesToCompiler(proto);
```

- Extends ProtoDef compiler with NBT types
- Enables custom packet/data structure definitions
- Used by minecraft-protocol

#### **addTypesToInterpreter()**
```javascript
nbt.addTypesToInterpreter(proto);
```

- Extends ProtoDef interpreter with NBT types
- Enables NBT parsing within custom protocols

### 5.7 Common Use Cases in Minecraft

#### **Player Data (player.dat)**
```javascript
// Player NBT structure
{
  Health: float(20.0),
  foodLevel: int(20),
  Pos: list(double([x, y, z])),
  Rotation: list(float([yaw, pitch])),
  Inventory: list([
    comp({
      id: string('minecraft:diamond_sword'),
      Count: byte(1),
      Slot: byte(0),
      tag: comp({
        Enchantments: list([...])
      })
    })
  ])
}
```

#### **Item NBT (Enchantments, Display Name)**
```javascript
{
  display: comp({
    Name: string('{"text":"Magic Sword"}'),
    Lore: list([
      string('{"text":"A legendary weapon"}')
    ])
  }),
  Enchantments: list([
    comp({
      id: string('minecraft:sharpness'),
      lvl: short(5)
    }),
    comp({
      id: string('minecraft:unbreaking'),
      lvl: short(3)
    })
  ])
}
```

#### **Block Entity NBT (Chest, Sign, etc.)**
```javascript
// Chest NBT
{
  Items: list([
    comp({
      Slot: byte(0),
      id: string('minecraft:diamond'),
      Count: byte(64)
    })
  ]),
  CustomName: string('{"text":"Treasure Chest"}')
}
```

#### **Structure Files (.nbt)**
```javascript
{
  size: list(int([width, height, length])),
  blocks: list([
    comp({
      pos: list(int([x, y, z])),
      state: int(blockStateId),
      nbt: comp({...}) // Block entity data
    })
  ]),
  entities: list([...]),
  palette: list([...])
}
```

### 5.8 FGD Current Implementation Status

✅ **Implemented:**
- None (NBT handling not directly implemented)
- Mineflayer internally uses prismarine-nbt for protocol operations

❌ **Missing:**
- **Item NBT reading** (enchantments, custom names, lore)
- **Item NBT writing** (create custom items, enchant, rename)
- **Block entity data reading** (chest contents, sign text, spawner settings)
- **Block entity data writing** (modify chests, signs, etc.)
- **Player data parsing** (inventory analysis, XP, effects)
- **Structure file parsing** (read/write .nbt structures)
- **Custom item creation** (enchanted tools, custom lore, attributes)

### 5.9 Integration Recommendations

1. **Create NBT Manager**
   ```javascript
   // adapters/mineflayer/nbt_manager.js
   export class NBTManager {
     readItemNBT(item) {
       // Parse item.nbt
       // Extract enchantments, lore, attributes
       // Return simplified object
     }

     createEnchantedItem(baseItem, enchantments) {
       // Build NBT structure
       // Apply enchantments
       // Return item with NBT
     }

     readBlockEntityNBT(block) {
       // Get block entity data
       // Parse NBT
       // Return contents (chest items, sign text, etc.)
     }
   }
   ```

2. **Add Item Enhancement System**
   ```javascript
   export class ItemEnhancer {
     async enchantItem(bot, item, enchantments) {
       // Use enchanting table
       // Apply NBT data
       // Return enchanted item
     }

     async renameItem(bot, item, newName) {
       // Use anvil
       // Set display name in NBT
       // Return renamed item
     }

     async addLore(bot, item, loreLines) {
       // Add Lore NBT tag
       // Format as JSON text components
     }
   }
   ```

3. **Implement Structure Handler**
   ```javascript
   export class StructureHandler {
     async loadStructure(filePath) {
       // Read .nbt file
       // Parse NBT
       // Return structure data
     }

     async placeStructure(bot, structure, position) {
       // Iterate blocks in structure
       // Place each block with NBT data
       // Handle block entities
     }
   }
   ```

---

## 6. Version Compatibility Matrix

| Component | FGD Current | Mineflayer Latest | Recommended |
|-----------|-------------|-------------------|-------------|
| mineflayer | ^4.0.0 | 4.20.1 | ✅ Up-to-date |
| minecraft-protocol | (via mineflayer) | 1.47.0 | ✅ Transitive |
| prismarine-physics | (via mineflayer) | 1.9.0 | ✅ Transitive |
| prismarine-windows | (via mineflayer) | 2.9.0 | ✅ Transitive |
| prismarine-nbt | (via mineflayer) | 2.5.0 | ✅ Transitive |
| mineflayer-pathfinder | ^2.4.5 | 2.4.5 | ✅ Up-to-date |
| mineflayer-pvp | ^1.3.2 | 1.3.2 | ✅ Up-to-date |
| mineflayer-auto-eat | ^3.3.6 | 3.3.6 | ✅ Up-to-date |
| mineflayer-collectblock | ^1.6.0 | 1.6.0 | ✅ Up-to-date |

**Minecraft Version Support:**
- FGD Target: 1.21.8 (latest)
- Mineflayer Range: 1.8 - 1.21.8
- Status: ✅ Full compatibility

---

## 7. Missing Features - Priority Analysis

### Priority 0 (Critical - Core Functionality)

1. **Combat System Implementation**
   - Attack mechanics with cooldown tracking
   - Defense and health management
   - Hostile mob detection and avoidance
   - **Reason:** Essential for autonomous survival

2. **Crafting Automation**
   - Recipe discovery and validation
   - Ingredient availability checking
   - Multi-step crafting chains
   - Crafting table vs inventory crafting
   - **Reason:** Required for progression and tool creation

3. **Window Management System**
   - Chest opening and item transfer
   - Furnace automation (smelting)
   - General container interaction
   - **Reason:** Core to resource gathering and storage

### Priority 1 (High - Enhanced Capabilities)

4. **Advanced Movement**
   - Elytra flight control
   - Swimming and water navigation
   - Vehicle mounting (minecarts, boats, horses)
   - **Reason:** Expands mobility and exploration

5. **Item NBT Handling**
   - Read enchantments and item properties
   - Create custom items with NBT
   - Item naming and lore
   - **Reason:** Required for advanced item management

6. **Enchanting & Anvil Operations**
   - Enchantment table automation
   - Anvil repair and combining
   - XP management
   - **Reason:** Item enhancement and durability management

### Priority 2 (Medium - Quality of Life)

7. **Villager Trading**
   - Trade discovery
   - Automated trading sessions
   - Reputation management
   - **Reason:** Resource acquisition and economy

8. **Brewing Automation**
   - Potion recipes
   - Brewing stand operations
   - Effect management
   - **Reason:** Buffs and effects for combat/exploration

9. **Death Handling & Respawn**
   - Death detection
   - Respawn logic
   - Inventory recovery
   - **Reason:** Autonomous recovery from failures

### Priority 3 (Low - Nice to Have)

10. **Structure Parsing**
    - Load .nbt structure files
    - Place structures in-world
    - Structure analysis
    - **Reason:** Advanced building automation

11. **Beacon Management**
    - Effect selection
    - Beacon activation
    - Range optimization
    - **Reason:** Base enhancement

12. **Microsoft Authentication**
    - OAuth flow
    - Token management
    - Realms support
    - **Reason:** Official server compatibility

---

## 8. Integration Roadmap

### Phase 1: Core Combat & Survival (Priority 0)

**Week 1-2: Combat System**
- [ ] Create `CombatController` class
  - [ ] Attack mechanics with cooldown
  - [ ] Target selection (nearest hostile)
  - [ ] Health monitoring and retreat logic
  - [ ] Critical hit tracking
- [ ] Create `SurvivalManager` class
  - [ ] Health regeneration tracking
  - [ ] Hunger management integration
  - [ ] Damage avoidance (lava, fall, drowning)
- [ ] Integrate `mineflayer-pvp` plugin
  - [ ] Enable auto-attack mode
  - [ ] Shield blocking
- [ ] Integrate `mineflayer-auto-eat` plugin
  - [ ] Enable auto-eating
  - [ ] Food priority configuration

**Week 3-4: Crafting System**
- [ ] Create `CraftingManager` class
  - [ ] Recipe database integration (minecraft-data)
  - [ ] Ingredient availability checker
  - [ ] Crafting table finder and navigator
  - [ ] Inventory vs table crafting decision
- [ ] Implement multi-step crafting chains
  - [ ] Dependency tree resolution (e.g., planks → sticks → tools)
  - [ ] Automated intermediate crafting
- [ ] Add crafting task types to planner
  - [ ] `craft_item` task
  - [ ] `craft_chain` task (multi-step)

**Week 5-6: Window Management**
- [ ] Create `WindowManager` class
  - [ ] Window opening and closing
  - [ ] Slot click strategies (shift-click, quick-move)
  - [ ] Container type detection
- [ ] Implement `ChestController`
  - [ ] Item deposit automation
  - [ ] Item retrieval by name/count
  - [ ] Smart storage organization
- [ ] Implement `FurnaceController`
  - [ ] Smelting automation
  - [ ] Fuel management
  - [ ] Output collection

### Phase 2: Advanced Capabilities (Priority 1)

**Week 7-8: Movement Enhancement**
- [ ] Create `ElytraController`
  - [ ] Elytra equipping
  - [ ] Flight initiation and landing
  - [ ] Firework boost integration
- [ ] Create `VehicleController`
  - [ ] Minecart mounting and navigation
  - [ ] Boat water navigation
  - [ ] Horse taming and riding
- [ ] Enhance `MovementAdapter`
  - [ ] Swimming optimization
  - [ ] Ladder climbing
  - [ ] Parkour mechanics

**Week 9-10: NBT & Item Enhancement**
- [ ] Create `NBTManager`
  - [ ] Item NBT parsing
  - [ ] Enchantment reading
  - [ ] Custom item creation
- [ ] Create `ItemEnhancer`
  - [ ] Enchanting table automation
  - [ ] Anvil operations (repair, combine, rename)
  - [ ] Lore and display name setting
- [ ] Create `XPManager`
  - [ ] XP tracking
  - [ ] Level calculation
  - [ ] Enchanting cost validation

### Phase 3: Quality of Life (Priority 2)

**Week 11-12: Trading & Brewing**
- [ ] Create `VillagerTrader`
  - [ ] Villager discovery
  - [ ] Trade offer parsing
  - [ ] Automated trading sessions
  - [ ] Reputation tracking
- [ ] Create `BrewingController`
  - [ ] Potion recipe database
  - [ ] Brewing stand automation
  - [ ] Ingredient management

**Week 13-14: Death Handling & Recovery**
- [ ] Create `DeathManager`
  - [ ] Death event detection
  - [ ] Respawn automation
  - [ ] Death location marking
- [ ] Create `RecoveryAgent`
  - [ ] Navigate to death location
  - [ ] Item pickup automation
  - [ ] Inventory restoration

### Phase 4: Advanced Features (Priority 3)

**Week 15+: Structure & Authentication**
- [ ] Create `StructureHandler`
  - [ ] .nbt file parsing
  - [ ] Structure placement
  - [ ] Schematic conversion
- [ ] Create `AuthenticationManager`
  - [ ] Microsoft OAuth integration
  - [ ] Token caching
  - [ ] Realms support

---

## 9. API Method Comparison

### 9.1 Movement APIs

| Feature | Mineflayer Core | FGD Current | FGD Missing |
|---------|----------------|-------------|-------------|
| Basic movement | `bot.setControlState()` | ✅ Via pathfinder | - |
| Pathfinding | `bot.pathfinder.goto()` | ✅ `moveToTarget()` | - |
| Look control | `bot.lookAt()` | ❌ Not exposed | `lookAt()` method |
| Sprint control | `bot.setControlState('sprint')` | ❌ Manual only | Auto-sprint logic |
| Sneak control | `bot.setControlState('sneak')` | ❌ Not exposed | Sneak automation |
| Jump | `bot.setControlState('jump')` | ❌ Not exposed | Jump automation |
| Elytra flight | Direct control + physics | ❌ Not implemented | `flyWithElytra()` |
| Vehicle mounting | `bot.mount(entity)` | ❌ Not implemented | `mountVehicle()` |
| Swimming | Automatic via physics | ✅ Passive | - |

### 9.2 Block Interaction APIs

| Feature | Mineflayer Core | FGD Current | FGD Missing |
|---------|----------------|-------------|-------------|
| Block query | `bot.blockAt(pos)` | ✅ Internal use | Exposed API |
| Dig block | `bot.dig(block)` | ✅ `_mineBlock()` | - |
| Place block | `bot.placeBlock()` | ✅ `_placeBlock()` | - |
| Activate block | `bot.activateBlock()` | ✅ `_interact()` | - |
| Tool selection | Automatic | ❌ Not implemented | `selectBestTool()` |
| Block reach check | `bot.canSeeBlock()` | ❌ Not implemented | `canReach()` |
| Multi-block dig | Sequential | ❌ Not optimized | `digArea()` |

### 9.3 Inventory APIs

| Feature | Mineflayer Core | FGD Current | FGD Missing |
|---------|----------------|-------------|-------------|
| List inventory | `bot.inventory.items()` | ✅ `_getInventory()` | - |
| Equip item | `bot.equip()` | ✅ `_equipItem()` | - |
| Toss item | `bot.toss()` | ✅ `_dropItem()` | - |
| Find item | `bot.inventory.findInventoryItem()` | ✅ Internal | Exposed API |
| Craft item | `bot.craft()` | ❌ Not implemented | `craftItem()` |
| Window operations | `bot.openContainer()` | ❌ Not implemented | `openWindow()`, `transferItems()` |
| Slot clicking | Direct window API | ❌ Not implemented | `clickSlot()`, `shiftClick()` |

### 9.4 Combat APIs

| Feature | Mineflayer Core | FGD Current | FGD Missing |
|---------|----------------|-------------|-------------|
| Attack entity | `bot.attack(entity)` | ❌ Not implemented | `attackEntity()` |
| Attack cooldown | `bot.attackCooldown` | ❌ Not tracked | Cooldown timer |
| Critical hits | Jump + attack | ❌ Not implemented | `criticalAttack()` |
| Shield blocking | `bot.activateItem()` (shield) | ❌ Not implemented | `blockWithShield()` |
| PvP plugin | `mineflayer-pvp` | ✅ Installed | ❌ Not activated |
| Auto-attack | Via plugin | ❌ Not configured | Enable plugin |

### 9.5 Entity APIs

| Feature | Mineflayer Core | FGD Current | FGD Missing |
|---------|----------------|-------------|-------------|
| Nearest entity | `bot.nearestEntity()` | ✅ `followEntity()` | - |
| Entity list | `bot.entities` | ✅ World observer | - |
| Entity tracking | Automatic events | ✅ Event caching | - |
| Entity filtering | Filter function | ✅ Observer filters | - |
| Entity mounting | `bot.mount()` | ❌ Not implemented | `mountEntity()` |

### 9.6 Chat & Communication APIs

| Feature | Mineflayer Core | FGD Current | FGD Missing |
|---------|----------------|-------------|-------------|
| Send chat | `bot.chat()` | ❌ Not implemented | `sendChat()` |
| Receive chat | `bot.on('chat')` | ✅ Event handler | - |
| Whisper | `bot.whisper()` | ❌ Not implemented | `whisperPlayer()` |
| Command parsing | Manual | ❌ Not implemented | Command parser |

### 9.7 World APIs

| Feature | Mineflayer Core | FGD Current | FGD Missing |
|---------|----------------|-------------|-------------|
| World scanning | Manual iteration | ✅ `WorldObserver` | - |
| Biome detection | `bot.biome` | ✅ Observer | - |
| Time/weather | `bot.time`, `bot.isRaining` | ✅ Observer | - |
| Block updates | `bot.on('blockUpdate')` | ❌ Not tracked | Event tracking |
| Chunk loading | Automatic | ✅ Passive | - |

---

## 10. Plugin Integration Status

### 10.1 Installed Plugins

| Plugin | Version | Status | Usage in FGD |
|--------|---------|--------|--------------|
| mineflayer-pathfinder | 2.4.5 | ✅ Active | Movement, navigation |
| mineflayer-pvp | 1.3.2 | ⚠️ Installed, not activated | Combat (not enabled) |
| mineflayer-auto-eat | 3.3.6 | ⚠️ Installed, not activated | Hunger management (not enabled) |
| mineflayer-collectblock | 1.6.0 | ⚠️ Installed, not activated | Item collection (not enabled) |

### 10.2 Plugin Activation Recommendations

#### **mineflayer-pvp** (Combat)
```javascript
// In MineflayerBridge.connectBot()
const { plugin: pvp } = require('mineflayer-pvp');
bot.loadPlugin(pvp);

// Usage
bot.pvp.attack(targetEntity); // Auto-attack
bot.pvp.stop(); // Stop combat
```

**Benefits:**
- Automatic attack timing with cooldown
- Optimal distance maintenance
- Shield blocking
- Critical hit optimization

#### **mineflayer-auto-eat** (Survival)
```javascript
const autoEat = require('mineflayer-auto-eat');
bot.loadPlugin(autoEat);

// Configure
bot.autoEat.options = {
  priority: 'foodPoints', // or 'saturation'
  startAt: 14, // Start eating at 14/20 hunger
  bannedFood: ['poisonous_potato', 'spider_eye']
};

// Enable
bot.autoEat.enable();
```

**Benefits:**
- Automatic hunger management
- Prevents starvation
- Food priority optimization
- Bannedlist for dangerous foods

#### **mineflayer-collectblock** (Resource Gathering)
```javascript
const collectBlock = require('mineflayer-collectblock');
bot.loadPlugin(collectBlock);

// Collect specific block type
const oakLog = bot.registry.blocksByName.oak_log;
bot.collectBlock.collect(oakLog);
```

**Benefits:**
- Automated block collection
- Pathfinding to nearest block
- Tool selection
- Multi-block collection

### 10.3 Recommended Additional Plugins

1. **mineflayer-armor-manager** (Auto-equip best armor)
2. **mineflayer-tool-plugin** (Auto-select best tool)
3. **mineflayer-web-inventory** (Web GUI for debugging)
4. **mineflayer-dashboard** (Monitoring dashboard)

---

## 11. Breaking Changes & Deprecations

### 11.1 Mineflayer 4.x Changes

**Breaking Changes from 3.x to 4.x:**
- `bot.lookAt()` now returns a Promise (was synchronous)
- `bot.equip()` Promise rejection on failure (was silent)
- Window API restructured (slot indexing changed)
- Entity tracking optimized (different event timing)

**FGD Impact:** ✅ Already on 4.x, no migration needed

### 11.2 minecraft-protocol Changes

**Recent Breaking Changes:**
- Compression threshold auto-detection (was manual)
- Encryption enabled by default (was opt-in)
- SRV record resolution automatic (was manual DNS)

**FGD Impact:** ✅ Handled by Mineflayer abstraction

### 11.3 Deprecated Features

**Deprecated in Mineflayer 4.x:**
- `bot.players` object structure (use `bot.entities` instead)
- `bot.blockAt()` sync version (async preferred for large queries)
- Legacy inventory slot names (use numeric indices)

**FGD Action Items:**
- [ ] Audit usage of `bot.players` in world observer
- [ ] Ensure async block queries in scanning loops
- [ ] Validate inventory slot references

---

## 12. Modern API Patterns

### 12.1 Promise-Based APIs

**Mineflayer 4.x Standard:**
```javascript
// All major operations return Promises
await bot.dig(block);
await bot.equip(item, destination);
await bot.pathfinder.goto(goal);
await bot.openContainer(chest);
```

**FGD Implementation:**
✅ Already using Promise-based patterns throughout adapters

### 12.2 Event-Driven Architecture

**Mineflayer Events:**
```javascript
// Physics updates (20 TPS)
bot.on('physicsTick', () => {
  // Runs every 50ms
});

// State changes
bot.on('health', () => {
  // Health/hunger changed
});

// World updates
bot.on('blockUpdate', (oldBlock, newBlock) => {
  // Block changed
});
```

**FGD Implementation:**
✅ Event subscription system in MineflayerBridge
⚠️ Not utilizing `physicsTick` for precise timing

### 12.3 Plugin System

**Modern Plugin Pattern:**
```javascript
function myPlugin(bot, options) {
  // Add methods to bot
  bot.myMethod = () => { /* ... */ };

  // Subscribe to events
  bot.on('spawn', () => { /* ... */ });

  // Expose API
  return {
    stop: () => { /* cleanup */ }
  };
}

bot.loadPlugin(myPlugin);
```

**FGD Opportunity:**
- [ ] Create custom FGD plugin for Mineflayer
- [ ] Encapsulate FGD-specific behaviors
- [ ] Standardize bot initialization

---

## 13. Performance Optimization Recommendations

### 13.1 Block Scanning Optimization

**Current FGD Implementation:**
- Scans 16-block radius every 2 seconds
- Full iteration of all blocks in cube

**Optimization Opportunities:**
1. **Use Chunk-Based Scanning**
   ```javascript
   // Instead of position iteration, use chunk columns
   const chunk = await bot.world.getColumn(chunkX, chunkZ);
   ```

2. **Incremental Scanning**
   - Scan different quadrants each tick
   - Reduce CPU spikes
   - Maintain real-time responsiveness

3. **Block Change Events**
   ```javascript
   bot.on('blockUpdate', (oldBlock, newBlock) => {
     // Update cache only for changed blocks
     blockCache.set(posKey, newBlock);
   });
   ```

### 13.2 Entity Tracking Optimization

**Use Built-in Entity Tracking:**
```javascript
// Instead of manual iteration
const nearest = bot.nearestEntity(entity =>
  entity.type === 'hostile' &&
  entity.position.distanceTo(bot.entity.position) < 32
);
```

**Benefits:**
- Optimized spatial indexing
- Automatic despawn cleanup
- Lower memory footprint

### 13.3 Pathfinding Optimization

**Configure Movement Costs:**
```javascript
const { Movements } = require('mineflayer-pathfinder');
const mcData = require('minecraft-data')(bot.version);
const movements = new Movements(bot, mcData);

// Customize costs
movements.allow1by1towers = false; // Disable pillar jumping
movements.canDig = true; // Allow digging through blocks
movements.digCost = 10; // Cost of digging vs. walking around

bot.pathfinder.setMovements(movements);
```

### 13.4 Memory Management

**Entity Cache Limits:**
```javascript
// Limit cached entities
if (entityCache.size > 1000) {
  // Remove oldest/farthest entities
  const toRemove = Array.from(entityCache.values())
    .sort((a, b) => b.distance - a.distance)
    .slice(500); // Keep nearest 500

  toRemove.forEach(e => entityCache.delete(e.id));
}
```

---

## 14. Testing & Validation Recommendations

### 14.1 Unit Tests for New Features

**Combat System Tests:**
```javascript
describe('CombatController', () => {
  test('attacks nearest hostile mob', async () => {
    const hostile = spawnTestEntity('zombie', nearPosition);
    await combatController.engageCombat(bot);
    expect(hostile.health).toBeLessThan(hostile.maxHealth);
  });

  test('retreats when health low', async () => {
    bot.health = 5;
    await combatController.engageCombat(bot);
    expect(bot.pathfinder.goal).toBeRetreatGoal();
  });
});
```

**Crafting System Tests:**
```javascript
describe('CraftingManager', () => {
  test('crafts wooden planks from logs', async () => {
    giveItem(bot, 'oak_log', 1);
    await craftingManager.craftItem(bot, 'oak_planks', 4);
    expect(bot.inventory.count('oak_planks')).toBe(4);
  });

  test('resolves crafting chain for wooden pickaxe', async () => {
    giveItem(bot, 'oak_log', 3);
    const chain = await craftingManager.getCraftingChain('wooden_pickaxe');
    expect(chain).toEqual(['oak_planks', 'stick', 'wooden_pickaxe']);
  });
});
```

### 14.2 Integration Tests

**End-to-End Survival Test:**
```javascript
test('bot survives night with autonomy', async () => {
  const bot = await spawnBot();

  // Set to night
  await rcon.execute(`time set night`);

  // Enable autonomy
  await autonomyEngine.start(bot.id);

  // Wait 5 minutes (5 Minecraft nights)
  await sleep(300000);

  // Bot should still be alive
  expect(bot.health).toBeGreaterThan(0);
  expect(bot.food).toBeGreaterThan(0);
}, 600000); // 10 minute timeout
```

### 14.3 Performance Benchmarks

**Pathfinding Performance:**
```javascript
test('pathfinding completes within 5 seconds', async () => {
  const start = Date.now();
  await bot.pathfinder.goto(new goals.GoalBlock(x, y, z));
  const elapsed = Date.now() - start;
  expect(elapsed).toBeLessThan(5000);
});
```

---

## 15. Documentation Needs

### 15.1 API Documentation

**Required Documentation:**
- [ ] Combat API reference (methods, events, examples)
- [ ] Crafting API reference (recipes, chains, limitations)
- [ ] Window Management API (supported windows, slot indices)
- [ ] NBT API (data structures, common use cases)
- [ ] Movement API (elytra, vehicles, swimming)

### 15.2 Integration Guides

**Tutorial Documentation:**
- [ ] "Getting Started with FGD Combat"
- [ ] "Automating Crafting Chains"
- [ ] "Working with NBT Data"
- [ ] "Creating Custom Behaviors"

### 15.3 Architecture Documentation

**System Documentation:**
- [ ] Mineflayer integration architecture diagram
- [ ] Event flow documentation
- [ ] Plugin activation guide
- [ ] Performance tuning guide

---

## 16. Conclusion & Next Steps

### 16.1 Summary of Findings

**Current State:**
- FGD has a **solid foundation** with Mineflayer 4.x integration
- **Basic capabilities** implemented: movement, interaction, inventory
- **Dependencies up-to-date** and version-compatible
- **Infrastructure ready** for advanced features

**Critical Gaps:**
1. **Combat system** - Not implemented (P0)
2. **Crafting automation** - Not implemented (P0)
3. **Window management** - Partially implemented (P0)
4. **Advanced movement** - Not implemented (P1)
5. **NBT handling** - Not implemented (P1)

### 16.2 Immediate Action Items

**Week 1 Priorities:**
1. [ ] Activate installed plugins (pvp, auto-eat, collectblock)
2. [ ] Implement basic combat controller
3. [ ] Create crafting manager with recipe database
4. [ ] Add window manager for chest operations

**Week 2-4 Priorities:**
1. [ ] Complete combat system with retreat logic
2. [ ] Implement multi-step crafting chains
3. [ ] Add furnace automation
4. [ ] Create NBT manager for item inspection

### 16.3 Long-Term Roadmap Alignment

**Q1 2026:**
- Complete Priority 0 features (combat, crafting, windows)
- Activate and configure all installed plugins
- Comprehensive testing and validation

**Q2 2026:**
- Implement Priority 1 features (advanced movement, NBT, enchanting)
- Performance optimization based on benchmarks
- Documentation and API standardization

**Q3 2026:**
- Add Priority 2 features (trading, brewing, death handling)
- Plugin ecosystem expansion
- Advanced autonomy behaviors

### 16.4 Success Metrics

**Technical Metrics:**
- [ ] 100% of installed plugins activated and configured
- [ ] Combat system operational with 90%+ survival rate
- [ ] Crafting automation for all basic recipes (tools, food, building)
- [ ] Window operations successful on all common container types
- [ ] Unit test coverage >80% for new systems

**Functional Metrics:**
- [ ] Bot can survive 10 Minecraft nights autonomously
- [ ] Bot can craft full set of diamond tools from raw materials
- [ ] Bot can defeat common hostile mobs (zombie, skeleton, creeper)
- [ ] Bot can manage inventory across multiple chests

---

## Appendix A: Quick Reference - Mineflayer Methods

### Movement
- `bot.setControlState(control, active)` - Set control state (forward, back, left, right, jump, sprint, sneak)
- `bot.lookAt(point)` - Look at position
- `bot.pathfinder.goto(goal)` - Navigate to goal with pathfinding

### Blocks
- `bot.blockAt(point)` - Get block at position
- `bot.dig(block)` - Mine block
- `bot.placeBlock(referenceBlock, faceVector)` - Place block
- `bot.activateBlock(block)` - Right-click block

### Inventory
- `bot.inventory.items()` - Get all items
- `bot.equip(item, destination)` - Equip item
- `bot.toss(itemType, metadata, count)` - Drop items
- `bot.craft(recipe, count)` - Craft items

### Combat
- `bot.attack(entity)` - Attack entity
- `bot.activateItem()` - Use item in hand (shield block, eat, etc.)

### Entities
- `bot.nearestEntity(filter)` - Find nearest entity
- `bot.mount(entity)` - Mount vehicle/mob
- `bot.dismount()` - Dismount

### Communication
- `bot.chat(message)` - Send chat message
- `bot.whisper(username, message)` - Whisper to player

### World
- `bot.entities` - All tracked entities
- `bot.game` - Game state (mode, dimension, difficulty)
- `bot.time.timeOfDay` - Current time (0-24000)
- `bot.isRaining` - Weather status

---

## Appendix B: Event Reference

### Bot Events
- `spawn` - Bot spawned
- `end` - Connection ended
- `error` - Error occurred
- `kicked` - Kicked from server

### State Events
- `health` - Health/hunger changed
- `death` - Bot died
- `move` - Bot moved
- `physicsTick` - Physics update (50ms)

### World Events
- `blockUpdate` - Block changed
- `chunkColumnLoad` - Chunk loaded
- `entitySpawn` - Entity spawned
- `entityGone` - Entity despawned
- `entityMoved` - Entity moved

### Communication Events
- `chat` - Chat message received
- `whisper` - Whisper received
- `message` - Any message (chat, whisper, system)

---

## Appendix C: Plugin Ecosystem

### Official Plugins (Recommended)
1. **mineflayer-pathfinder** - A* pathfinding (✅ Installed)
2. **mineflayer-pvp** - Combat automation (✅ Installed, not activated)
3. **mineflayer-auto-eat** - Hunger management (✅ Installed, not activated)
4. **mineflayer-collectblock** - Block collection (✅ Installed, not activated)
5. **mineflayer-armor-manager** - Auto-equip armor (❌ Not installed)
6. **mineflayer-tool-plugin** - Auto-select tools (❌ Not installed)

### Community Plugins
7. **mineflayer-navigate** - Alternative pathfinding
8. **mineflayer-web-inventory** - Web-based inventory viewer
9. **mineflayer-dashboard** - Monitoring dashboard
10. **mineflayer-bloodhound** - Advanced entity tracking

---

**End of Analysis Report**

---

*This report was generated on 2025-11-18 for FGD version 2.1.0 based on analysis of the core Mineflayer ecosystem repositories.*
