# 🚀 Hybrid Bot Framework Setup Guide

This guide explains how to set up **real Minecraft integration** with the FGD hybrid bot framework (no simulation).

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   FGD Node.js Backend                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ npc_microcore│→ │minecraft_     │→ │ Socket.IO    │      │
│  │ (tick loop)  │  │ bridge       │  │ (WebSocket)  │      │
│  └──────────────┘  └──────────────┘  └──────┬───────┘      │
└────────────────────────────────────────────────┼────────────┘
                                                 │
                                        WebSocket│Connection
                                                 │
┌────────────────────────────────────────────────┼────────────┐
│                Minecraft Paper Server          ▼             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │           FGDProxyPlayer Plugin                       │  │
│  │  ┌──────────────┐  ┌──────────────┐                  │  │
│  │  │ BotManager   │  │ ScanManager  │                  │  │
│  │  │ (movement)   │  │ (awareness)  │                  │  │
│  │  └──────┬───────┘  └──────┬───────┘                  │  │
│  └─────────┼──────────────────┼──────────────────────────┘  │
│            ▼                  ▼                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │        Minecraft World (Real Bot Entities)          │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

- **Node.js** 18+ with npm
- **Java** 17+
- **Maven** 3.8+
- **Paper/Spigot** Minecraft server 1.20+

## Step 1: Build the FGDProxyPlayer Plugin

```bash
# From FGD repository root
cd plugins/FGDProxyPlayer

# Build with Maven
mvn clean package

# Compiled JAR will be at:
# target/FGDProxyPlayer-1.0.0.jar
```

## Step 2: Install Plugin on Minecraft Server

```bash
# Copy plugin to your Paper server
cp target/FGDProxyPlayer-1.0.0.jar /path/to/minecraft/server/plugins/

# Start/restart your Minecraft server
cd /path/to/minecraft/server
java -Xmx4G -jar paper.jar
```

## Step 3: Configure the Plugin

Edit `plugins/FGDProxyPlayer/config.yml`:

```yaml
fgd:
  # URL of your FGD server (default: ws://localhost:3000)
  server-url: "ws://localhost:3000"

  # Auto-connect when plugin loads
  auto-connect: true

  # Auto-reconnect if connection drops
  auto-reconnect: true
```

## Step 4: Configure FGD Backend

Create/edit `.env` file in FGD root:

```bash
# Minecraft RCON connection (for fallback commands)
MINECRAFT_RCON_HOST=127.0.0.1
MINECRAFT_RCON_PORT=25575
MINECRAFT_RCON_PASSWORD=your_rcon_password

# Server port
PORT=3000
```

Configure RCON in your Minecraft `server.properties`:

```properties
enable-rcon=true
rcon.port=25575
rcon.password=your_rcon_password
```

## Step 5: Start FGD Server

```bash
# From FGD repository root
npm install
npm start

# You should see:
# ✅ Minecraft Bridge connected
# ✅ FGDProxyPlayer plugin connected
# 🔗 Plugin interface wired to MinecraftBridge
```

## Step 6: Verify Connection

In Minecraft console or in-game (as OP):

```
/fgd status
```

You should see:
```
Server URL: ws://localhost:3000
Connected: ✓ Yes
Active Bots: 0
```

## How It Works

### Bot Movement (Real, Not Simulated)

When microcore calls `moveBot()`:

1. **npc_microcore.js** → Calculates next position via step-based physics
2. **minecraft_bridge.js** → `moveBot(bot, dx, dy, dz)`
3. **pluginInterface** → WebSocket message to plugin
4. **FGDProxyPlayer** → Teleports ArmorStand entity in-world
5. **Result** → Bot moves visibly in Minecraft

### Area Scanning (Real Block/Entity Data)

When microcore performs scan:

1. **npc_microcore.js** → Scheduled scan every 1.5s
2. **minecraft_bridge.js** → `scanArea(bot, radius)`
3. **pluginInterface** → WebSocket request to plugin
4. **ScanManager** → Queries real Minecraft world data
5. **Response** → Returns actual blocks & entities
6. **Result** → Bot has real environmental awareness

### What Bots See

Example scan response:

```json
{
  "blocks": [
    {"type": "STONE", "x": 100, "y": 64, "z": 200, "distance": 2.3},
    {"type": "DIAMOND_ORE", "x": 102, "y": 65, "z": 201, "distance": 3.1}
  ],
  "entities": [
    {"type": "ZOMBIE", "x": 105, "y": 64, "z": 203, "distance": 5.2, "health": 20},
    {"type": "PLAYER", "name": "Steve", "x": 98, "y": 64, "z": 199, "distance": 2.8}
  ],
  "timestamp": 1699028400000
}
```

## Testing Real Integration

### Spawn a Bot via API

```bash
curl -X POST http://localhost:3000/api/bots \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "name": "TestBot",
    "role": "explorer",
    "type": "builder",
    "position": {"x": 100, "y": 64, "z": 200}
  }'
```

### Watch in Minecraft

1. Join your server
2. Teleport to bot location: `/tp @s 100 64 200`
3. You'll see an invisible armor stand with nametag "[BOT] TestBot"
4. Watch it move as microcore tick updates position

### Verify Scanning

```bash
# Check bot runtime data
curl http://localhost:3000/api/bots/TestBot \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Response includes:
```json
{
  "runtime": {
    "position": {"x": 100.3, "y": 64, "z": 200.5},
    "velocity": {"x": 0.6, "y": 0, "z": 0},
    "tickCount": 127,
    "lastScan": {
      "blocks": [...],
      "entities": [...],
      "timestamp": "2025-11-03T12:34:56.789Z"
    }
  }
}
```

## Troubleshooting

### Plugin not connecting?

**Check:**
1. FGD server is running on port 3000
2. No firewall blocking WebSocket connections
3. Plugin logs: `logs/latest.log`

**Fix:**
```
/fgd disconnect
/fgd connect
```

### Bots not moving?

**Check:**
1. `/fgd status` shows "Connected: ✓ Yes"
2. FGD logs show plugin registration
3. Bot is spawned via API first

**Debug:**
```bash
# Enable bridge telemetry
# Watch console for moveBot events
```

### Scan returning empty data?

**Possible causes:**
1. Bot position is outside loaded chunks
2. Radius too small (default: 5 blocks)
3. World is empty at bot location

**Test:**
```
/fgd status
# Place blocks near bot
# Wait for next scan (1.5s interval)
```

## Differences from Simulation Mode

| Feature | Simulation Mode | Real Integration |
|---------|----------------|------------------|
| Movement | Fake position updates | Real entity teleportation |
| Scanning | Returns empty `{ note: "unavailable" }` | Real block/entity data |
| Performance | No Minecraft overhead | Minimal (optimized scans) |
| Visibility | Bots exist only in FGD | Visible in Minecraft world |
| Use Case | Development/testing | Production deployment |

## Performance Tuning

### Reduce Scan Frequency

In `npc_spawner.js` or `npc_engine.js`:

```javascript
startLoop(npcState, {
  bridge,
  tickRateMs: 200,        // Movement updates (5/sec)
  scanIntervalMs: 3000,   // Scans every 3 seconds (lower load)
  scanRadius: 3           // Smaller scan radius
});
```

### Limit Active Bots

Default: 8 bots max (see `MAX_BOTS` in `routes/bot.js` and `npc_spawner.js`)

## Next Steps

- ✅ Real bot movement working
- ✅ Real area scanning working
- 🔜 Add pathfinding (A* algorithm)
- 🔜 Add block breaking/placing via plugin
- 🔜 Add inventory management
- 🔜 Replace ArmorStands with fake player entities (Citizens API)

## Support

For issues or questions:
- Check FGD logs: console output
- Check plugin logs: `minecraft-server/logs/latest.log`
- Review README_HYBRID_BOTS.md for architecture details

---

**Status:** ✅ Real Minecraft integration fully operational
**Version:** FGD v2.2 "Embodied Federation"
