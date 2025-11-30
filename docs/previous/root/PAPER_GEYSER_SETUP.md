# Paper + Geyser Integration Guide for FGD

This guide explains how to set up and run Paper server with Geyser plugin alongside your FGD (AICraft Cluster Dashboard) system.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Running the Servers](#running-the-servers)
6. [Connecting Players](#connecting-players)
7. [Troubleshooting](#troubleshooting)
8. [Advanced Topics](#advanced-topics)

---

## Overview

### What is this setup?

This integration allows you to run:

1. **Paper Server** - A high-performance Minecraft Java Edition server
2. **Geyser Plugin** - Enables Bedrock Edition players to join your Java server
3. **FGD Dashboard** - Your AICraft Cluster Dashboard for NPC management
4. **RCON Bridge** - Connects the dashboard to your Minecraft server

### How it works

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Computer/Server                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────┐         ┌──────────────────┐          │
│  │   Paper Server  │◄───────►│  FGD Dashboard   │          │
│  │   (Port 25565)  │  RCON   │   (Port 3000)    │          │
│  │                 │(Port     │                  │          │
│  │  ┌───────────┐  │ 25575)  │  NPC Management  │          │
│  │  │  Geyser   │  │         │  Real-time Stats │          │
│  │  │  Plugin   │  │         │  Admin Panel     │          │
│  │  └───────────┘  │         └──────────────────┘          │
│  └─────────────────┘                                         │
│         ▲                                                     │
│         │                                                     │
└─────────┼─────────────────────────────────────────────────────┘
          │
          ├────────► Java Edition Players (Port 25565 TCP)
          │
          └────────► Bedrock Edition Players (Port 19132 UDP)
```

---

## Installation

### Prerequisites

- **Java 17 or higher** (for Paper 1.21.1+)
- **Node.js 14+** (for FGD Dashboard)
- **npm** (comes with Node.js)
- **4GB RAM minimum** (8GB recommended)

### Step 1: Install Paper and Geyser

Run the setup script:

**Linux/macOS:**
```bash
cd minecraft-servers
./setup-paper-geyser.sh
```

**Windows:**
```cmd
cd minecraft-servers
setup-paper-geyser.bat
```

This script will:
- Download the latest Paper server JAR
- Download the Geyser plugin
- Create default configuration files
- Set up RCON for FGD connection
- Create startup scripts

### Step 2: Install FGD Dependencies

If you haven't already:

```bash
cd ..
npm install
```

---

## Configuration

### 1. Configure Paper Server

Edit `minecraft-servers/paper-server/server.properties`:

```properties
# IMPORTANT: Change the RCON password!
rcon.password=your_secure_password_here

# Recommended settings for FGD
enable-rcon=true
rcon.port=25575
broadcast-rcon-to-ops=true

# Server settings
server-port=25565
max-players=20
online-mode=true
allow-flight=true
```

**Security Note:** NEVER use the default RCON password in production!

### 2. Configure Geyser

After first run, edit `minecraft-servers/paper-server/plugins/Geyser-Spigot/config.yml`:

```yaml
bedrock:
  address: 0.0.0.0
  port: 19132
  motd1: "FGD AICraft Server"
  motd2: "Java + Bedrock Crossplay"

remote:
  address: auto
  port: 25565
  auth-type: online

# For offline/LAN mode:
# auth-type: offline
```

See `minecraft-servers/config/geyser-config-template.yml` for detailed options.

### 3. Configure FGD Minecraft Bridge

Edit `minecraft-bridge-config.js`:

```javascript
export const minecraftBridgeConfig = {
  host: "127.0.0.1",
  port: 25575,
  password: "your_secure_password_here",  // Match server.properties!

  // Adjust these based on your needs
  maxCommandsPerSecond: 5,
  enableHeartbeat: true,
  enableSnapshots: true,
};
```

**Important:** The password here must match `rcon.password` in `server.properties`!

---

## Running the Servers

### Option 1: Run Everything Together (Recommended)

**Linux/macOS:**
```bash
./start-all.sh
```

**Windows:**
```cmd
start-all.bat
```

This starts both the Paper server and FGD dashboard in the background.

### Option 2: Run Separately

**Start Paper Server Only:**

Linux/macOS:
```bash
./start-all.sh paper
```

Windows:
```cmd
start-all.bat paper
```

**Start FGD Dashboard Only:**

Linux/macOS:
```bash
./start-all.sh dashboard
```

Windows:
```cmd
start-all.bat dashboard
```

### Option 3: Manual Start

**Paper Server:**
```bash
cd minecraft-servers/paper-server
./start.sh  # or start.bat on Windows
```

**FGD Dashboard:**
```bash
node server.js
```

### Stopping Services

**Linux/macOS:**
```bash
./start-all.sh stop
```

**Windows:**
Use Task Manager or close the console windows.

---

## Connecting Players

### Java Edition Players

**Server Address:** `your-server-ip:25565`

Example:
- Local: `localhost`
- LAN: `192.168.1.100` (your local IP)
- Public: `example.com` or `123.45.67.89`

### Bedrock Edition Players

**Server Address:** `your-server-ip`
**Port:** `19132`

Example:
- Local: `localhost`, port `19132`
- LAN: `192.168.1.100`, port `19132`
- Public: `example.com`, port `19132`

**Note:** Bedrock Edition requires manual port entry!

### FGD Dashboard

**URL:** `http://localhost:3000`
**Admin Panel:** `http://localhost:3000/admin`

---

## Troubleshooting

### RCON Connection Failed

**Problem:** Dashboard can't connect to Paper server

**Solutions:**
1. Check that Paper server is running: `netstat -an | grep 25575`
2. Verify RCON password matches in both:
   - `minecraft-servers/paper-server/server.properties`
   - `minecraft-bridge-config.js`
3. Check `server.properties` has `enable-rcon=true`
4. Restart Paper server after changing settings

### Geyser Not Working

**Problem:** Bedrock players can't connect

**Solutions:**
1. Check Geyser loaded successfully in server console:
   ```
   [Geyser-Spigot] Done! Started Geyser on 0.0.0.0:19132
   ```
2. Verify port 19132 UDP is open in firewall:
   ```bash
   sudo ufw allow 19132/udp  # Linux
   ```
3. Check Geyser config: `plugins/Geyser-Spigot/config.yml`
4. Bedrock players must use manual server entry (not automatic discovery)

### Port Already in Use

**Problem:** `Address already in use` error

**Solutions:**
1. Check what's using the port:
   ```bash
   # Linux/macOS
   lsof -i :25565  # Paper
   lsof -i :19132  # Geyser
   lsof -i :25575  # RCON
   lsof -i :3000   # Dashboard

   # Windows
   netstat -ano | findstr :25565
   ```
2. Stop conflicting processes or change ports

### Dashboard Shows Offline

**Problem:** Dashboard says Minecraft server is offline

**Solutions:**
1. Verify Paper server is running
2. Check RCON connection in browser console (F12)
3. Restart both services:
   ```bash
   ./start-all.sh stop
   ./start-all.sh
   ```

### Permission Denied Errors

**Problem:** Can't execute scripts

**Solution (Linux/macOS):**
```bash
chmod +x start-all.sh
chmod +x minecraft-servers/setup-paper-geyser.sh
chmod +x minecraft-servers/paper-server/start.sh
```

### Java Version Mismatch

**Problem:** Paper won't start, Java version error

**Solution:**
1. Check Java version: `java -version`
2. Paper 1.21.1+ requires Java 17 or higher
3. Install/update Java:
   ```bash
   # Ubuntu/Debian
   sudo apt install openjdk-17-jdk

   # macOS (with Homebrew)
   brew install openjdk@17

   # Windows
   # Download from https://adoptium.net/
   ```

---

## Advanced Topics

### Firewall Configuration

**Linux (UFW):**
```bash
sudo ufw allow 25565/tcp  # Java Edition
sudo ufw allow 19132/udp  # Bedrock Edition (Geyser)
sudo ufw allow 25575/tcp  # RCON (localhost only recommended!)
sudo ufw allow 3000/tcp   # FGD Dashboard
```

**Windows Firewall:**
1. Open Windows Defender Firewall
2. Click "Advanced settings"
3. Click "Inbound Rules" → "New Rule"
4. Add rules for ports: 25565 TCP, 19132 UDP, 3000 TCP
5. **Do NOT** expose 25575 publicly!

### Running as a Service (Linux)

Create `/etc/systemd/system/fgd.service`:

```ini
[Unit]
Description=FGD AICraft Server
After=network.target

[Service]
Type=simple
User=minecraft
WorkingDirectory=/home/minecraft/FGD
ExecStart=/home/minecraft/FGD/start-all.sh all
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable fgd
sudo systemctl start fgd
```

### Port Forwarding for Public Access

If hosting from home, configure your router:

1. Log into router admin panel (usually 192.168.1.1)
2. Find "Port Forwarding" or "Virtual Server" section
3. Add port forwards:
   - External 25565 TCP → Internal IP : 25565 (Java Edition)
   - External 19132 UDP → Internal IP : 19132 (Bedrock Edition)
   - External 3000 TCP → Internal IP : 3000 (Dashboard, optional)
4. **Never forward port 25575** (RCON) for security reasons!

### Using Custom Minecraft Versions

Edit `minecraft-servers/setup-paper-geyser.sh`:

```bash
PAPER_VERSION="1.20.4"  # Change to your version
PAPER_BUILD="latest"     # Or specific build number
```

Then re-run the setup script.

### Performance Tuning

Edit `minecraft-servers/paper-server/start.sh`:

```bash
# Allocate more RAM (adjust based on your system)
MIN_RAM="4G"
MAX_RAM="8G"
```

For the dashboard, adjust `minecraft-bridge-config.js`:

```javascript
maxCommandsPerSecond: 10,     // Increase if server can handle it
snapshotInterval: 10000,      // Reduce frequency to save resources
combatantTtl: 600000,         // Increase to keep more history
```

### Floodgate (Optional)

To allow Bedrock players without Java accounts:

1. Download Floodgate: https://geysermc.org/download#floodgate
2. Place `Floodgate-Spigot.jar` in `plugins/` folder
3. Restart Paper server
4. Edit Geyser config:
   ```yaml
   remote:
     auth-type: floodgate
   ```
5. Bedrock players will join with `.` prefix (e.g., `.StevePlayer`)

### Backup Automation

Create a backup script `backup-server.sh`:

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backups"
SERVER_DIR="minecraft-servers/paper-server"

mkdir -p "$BACKUP_DIR"
tar -czf "$BACKUP_DIR/server_$DATE.tar.gz" \
    "$SERVER_DIR/world" \
    "$SERVER_DIR/world_nether" \
    "$SERVER_DIR/world_the_end" \
    "$SERVER_DIR/plugins" \
    "$SERVER_DIR/server.properties" \
    "data/"

echo "Backup created: $BACKUP_DIR/server_$DATE.tar.gz"
```

Add to crontab for automatic backups:
```bash
crontab -e
# Add line: 0 */6 * * * /home/minecraft/FGD/backup-server.sh
```

---

## Ports Reference

| Service | Port | Protocol | Purpose | Expose Publicly? |
|---------|------|----------|---------|------------------|
| Paper (Java) | 25565 | TCP | Java Edition players | ✅ Yes |
| Geyser (Bedrock) | 19132 | UDP | Bedrock Edition players | ✅ Yes |
| RCON | 25575 | TCP | FGD communication | ❌ No (security risk!) |
| FGD Dashboard | 3000 | TCP | Web interface | ⚠️ Optional (with auth) |
| NPC Update Server | 3210 | TCP | Advanced integrations | ❌ No (internal use) |

---

## Support and Resources

- **Paper Documentation:** https://docs.papermc.io/
- **Geyser Wiki:** https://wiki.geysermc.org/
- **FGD Project:** See main README.md
- **Minecraft RCON:** https://wiki.vg/RCON

---

## Quick Reference

### Start everything:
```bash
./start-all.sh
```

### Stop everything:
```bash
./start-all.sh stop
```

### View Paper logs:
```bash
tail -f logs/paper-server.log
```

### View FGD logs:
```bash
tail -f logs/fgd-dashboard.log
```

### Update Paper:
```bash
cd minecraft-servers && ./setup-paper-geyser.sh
```

### Server Console (Paper):
```bash
cd minecraft-servers/paper-server
screen -r  # If using screen
# or just look at the console window
```

---

## Next Steps

1. ✅ Install Paper and Geyser (setup script)
2. ✅ Configure RCON password (server.properties + minecraft-bridge-config.js)
3. ✅ Start servers (start-all.sh)
4. ✅ Test connection (visit http://localhost:3000)
5. ✅ Connect with Minecraft (Java: localhost:25565, Bedrock: localhost:19132)
6. 📖 Read NPC_SYSTEM_README.md to learn about spawning NPCs
7. 🎮 Enjoy your integrated Paper + Geyser + FGD system!

---

**Happy crafting! 🎮⚡**
