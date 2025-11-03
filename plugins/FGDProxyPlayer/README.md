# FGD Proxy Player Plugin

A Paper/Spigot plugin that bridges FGD's hybrid bot framework with Minecraft servers.

## Features

- **Real Bot Movement**: Spawns proxy entities (armor stands) that move based on FGD microcore commands
- **Area Scanning**: Provides real-time environmental awareness (blocks & entities within radius)
- **WebSocket Bridge**: Connects to FGD Node.js backend for real-time bidirectional communication
- **No Simulation**: All bot actions happen in real Minecraft server

## Building

### Prerequisites
- Java 17 or higher
- Maven 3.8+

### Build Steps

```bash
cd plugins/FGDProxyPlayer
mvn clean package
```

The compiled JAR will be in `target/FGDProxyPlayer-1.0.0.jar`

## Installation

1. Build the plugin (see above)
2. Copy `target/FGDProxyPlayer-1.0.0.jar` to your Paper server's `plugins/` folder
3. Configure `plugins/FGDProxyPlayer/config.yml`:
   ```yaml
   fgd:
     server-url: "ws://localhost:3000"  # Your FGD server URL
     auto-connect: true
     auto-reconnect: true
   ```
4. Restart your server or use `/reload confirm`

## Usage

### Commands
- `/fgd status` - Check connection status and active bot count
- `/fgd connect` - Manually connect to FGD server
- `/fgd disconnect` - Disconnect from FGD server
- `/fgd reload` - Reload configuration

### Permissions
- `fgd.admin` - Access to all FGD commands (default: op)

## How It Works

```
FGD Backend (Node.js)               Paper Plugin
┌──────────────────┐                ┌──────────────────┐
│ npc_microcore    │                │ FGDProxyPlayer   │
│   ↓ tick loop    │                │                  │
│ minecraft_bridge │ ←─WebSocket──→ │ BotManager       │
│   ↓ moveBot()    │                │   ↓ teleport()   │
│   ↓ scanArea()   │                │ ScanManager      │
└──────────────────┘                │   ↓ getNearby()  │
                                    └──────────────────┘
                                            ↓
                                    Minecraft World
```

## API Messages

### From FGD → Plugin
- `moveBot` - Move a bot to coordinates
- `scanArea` - Scan environment around bot
- `spawnBot` - Spawn a new bot entity
- `despawnBot` - Remove a bot entity

### From Plugin → FGD
- `plugin_register` - Initial connection handshake
- `moveBot_response` - Confirmation of movement
- `scanArea_response` - Scan results with blocks & entities
- `spawnBot_response` - Spawn confirmation
- `despawnBot_response` - Despawn confirmation

## Troubleshooting

### Plugin won't connect
- Check that FGD server is running on the configured URL
- Verify WebSocket port is not blocked by firewall
- Check plugin logs: `logs/latest.log`

### Bots not moving
- Use `/fgd status` to verify connection
- Check FGD backend logs for errors
- Verify bridge is configured in FGD

## License

GPL-3.0 (same as FGD core)
