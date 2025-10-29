# Xbox (Bedrock Edition) Setup Guide

This guide will help you connect your Xbox to the FGD AI system using Paper server + Geyser.

## Overview

FGD is a Node.js AI control system that connects to your Minecraft server via RCON. To enable Xbox connectivity, you need to:
1. Set up a Paper Minecraft server
2. Install Geyser + Floodgate plugins
3. Configure network settings
4. Update FGD configuration

---

## Step 1: Download Required Files

### Minecraft Server
- **Paper Server**: Download from https://papermc.io/downloads
  - Choose your Minecraft version (e.g., 1.20.1)
  - Download `paper-1.20.1-xxx.jar`

### Plugins for Bedrock Support
- **Geyser-Spigot**: Download from https://geysermc.org/download
  - Get the Spigot/Paper version
  - File: `Geyser-Spigot.jar`

- **Floodgate**: Download from https://geysermc.org/download
  - Allows Xbox players without Java accounts
  - File: `floodgate-spigot.jar`

---

## Step 2: Server Directory Structure

Create this folder structure (outside of FGD directory):

```
minecraft-server/
├── paper-1.20.1.jar
├── server.properties
├── eula.txt
├── plugins/
│   ├── Geyser-Spigot.jar
│   └── floodgate-spigot.jar
└── start.sh (or start.bat)
```

---

## Step 3: Configuration Files

### A. server.properties
Create or edit `server.properties` with these critical settings:

```properties
# Network Settings
server-ip=0.0.0.0
server-port=25565
max-players=20

# RCON Settings (Required for FGD)
enable-rcon=true
rcon.port=25575
rcon.password=your_secure_password_here

# Gameplay Settings
gamemode=survival
difficulty=normal
spawn-protection=0
allow-flight=true
```

### B. eula.txt
```
eula=true
```

### C. Start Script

**Linux/Mac (`start.sh`):**
```bash
#!/bin/bash
java -Xms2G -Xmx4G -jar paper-1.20.1.jar nogui
```
Make executable: `chmod +x start.sh`

**Windows (`start.bat`):**
```batch
@echo off
java -Xms2G -Xmx4G -jar paper-1.20.1.jar nogui
pause
```

---

## Step 4: Geyser Configuration

After first server start, edit `plugins/Geyser-Spigot/config.yml`:

```yaml
bedrock:
  # 0.0.0.0 allows connections from any device on your network
  address: 0.0.0.0
  # Default Bedrock port (DO NOT change unless necessary)
  port: 19132
  # Clone remote address + port below

remote:
  # Connect to the Java server on localhost
  address: 127.0.0.1
  port: 25565
  # Change if you have authentication issues
  auth-type: online

# Allow Bedrock clients to see Java server MOTD
passthrough-motd: true
passthrough-player-counts: true
```

---

## Step 5: Network Configuration

### Find Your PC's Local IP Address

**Windows:**
```cmd
ipconfig
```
Look for "IPv4 Address" under your active network adapter (e.g., 192.168.1.100)

**Mac/Linux:**
```bash
ifconfig
# OR
ip addr show
```

### Required Ports

Make sure these ports are open on your PC firewall:

| Port  | Protocol | Purpose           |
|-------|----------|-------------------|
| 25565 | TCP      | Java Edition      |
| 25575 | TCP      | RCON (FGD)        |
| 19132 | UDP      | Bedrock Edition   |
| 3000  | TCP      | FGD Web Dashboard |
| 8800  | TCP      | FGD Node Server   |

**Windows Firewall:**
```powershell
New-NetFirewallRule -DisplayName "Minecraft Java" -Direction Inbound -Protocol TCP -LocalPort 25565 -Action Allow
New-NetFirewallRule -DisplayName "Minecraft RCON" -Direction Inbound -Protocol TCP -LocalPort 25575 -Action Allow
New-NetFirewallRule -DisplayName "Minecraft Bedrock" -Direction Inbound -Protocol UDP -LocalPort 19132 -Action Allow
```

**Linux (ufw):**
```bash
sudo ufw allow 25565/tcp
sudo ufw allow 25575/tcp
sudo ufw allow 19132/udp
```

---

## Step 6: Update FGD Configuration

### A. Update cluster_config.jsonc

If running FGD only on PC (no distributed nodes):
```jsonc
{
  "nodeName": "PC_Node",
  "port": 8800,
  "peers": []  // Empty if single node
}
```

If you want Xbox to also run FGD client (advanced):
```jsonc
{
  "nodeName": "PC_Node",
  "port": 8800,
  "peers": [
    "ws://192.168.1.XXX:8801"  // Replace with Xbox IP if running FGD there
  ]
}
```

### B. Update RCON Password

The FGD system reads RCON settings from environment variables or code. Check `fusion_core.js` for RCON configuration around line 158.

You'll need to update the RCON password to match what you set in `server.properties`.

---

## Step 7: Start Everything

### Start Order:
1. **Start Minecraft Server** (from minecraft-server directory)
   ```bash
   ./start.sh
   # OR on Windows: start.bat
   ```
   Wait for "Done!" message

2. **Verify Geyser is Running**
   Check console output for:
   ```
   [Geyser-Spigot] Started Geyser on 0.0.0.0:19132
   ```

3. **Start FGD System**
   ```bash
   cd /home/user/FGD
   node fusion.js
   ```

---

## Step 8: Connect from Xbox

1. Open Minecraft on Xbox
2. Go to **Servers** tab
3. Scroll down and click **Add Server**
4. Enter:
   - **Server Name**: My Local Server
   - **Server Address**: Your PC's IP (e.g., 192.168.1.100)
   - **Port**: 19132
5. Save and connect!

---

## Troubleshooting

### Xbox Can't Find Server
- Verify Xbox and PC are on the same WiFi network
- Double-check PC's local IP address
- Ensure port 19132 UDP is open in firewall
- Restart Minecraft server if Geyser failed to bind to port

### "Unable to connect to world"
- Check server.properties has `server-ip=0.0.0.0`
- Verify Geyser config has `address: 0.0.0.0`
- Check server console for errors

### FGD Can't Connect to Server
- Verify RCON is enabled in server.properties
- Check RCON password matches in both files
- Ensure server is fully started before running FGD
- Port 25575 must be open

### Authentication Issues
- If using Floodgate, Xbox players will have "*" prefix
- Geyser `auth-type: online` requires Xbox Live account
- Change to `auth-type: floodgate` to bypass Java auth

---

## Network Diagram

```
┌─────────────────────────────────────────┐
│         Local Network (WiFi/LAN)        │
│                                          │
│  ┌──────────────┐      ┌─────────────┐  │
│  │   PC/Server  │      │    Xbox     │  │
│  │              │      │             │  │
│  │ 192.168.1.100│◄─────┤ Bedrock     │  │
│  │              │      │ Client      │  │
│  │  ┌────────┐  │      └─────────────┘  │
│  │  │ Paper  │  │                        │
│  │  │ :25565 │  │                        │
│  │  └───┬────┘  │                        │
│  │      │       │                        │
│  │  ┌───▼────┐  │                        │
│  │  │ Geyser │  │                        │
│  │  │ :19132 │◄─┼────────UDP─────────────┤
│  │  └───┬────┘  │                        │
│  │      │       │                        │
│  │  ┌───▼────┐  │                        │
│  │  │  RCON  │  │                        │
│  │  │ :25575 │  │                        │
│  │  └───▲────┘  │                        │
│  │      │       │                        │
│  │  ┌───┴────┐  │                        │
│  │  │  FGD   │  │                        │
│  │  │ Node.js│  │                        │
│  │  └────────┘  │                        │
│  └──────────────┘                        │
└─────────────────────────────────────────┘
```

---

## Quick Checklist

- [ ] Downloaded Paper server JAR
- [ ] Downloaded Geyser-Spigot plugin
- [ ] Downloaded Floodgate plugin
- [ ] Created server.properties with RCON enabled
- [ ] Set eula=true
- [ ] Configured Geyser config.yml
- [ ] Found PC's local IP address
- [ ] Opened required ports in firewall
- [ ] Updated FGD cluster_config.jsonc (if needed)
- [ ] Started Minecraft server
- [ ] Verified Geyser loaded successfully
- [ ] Started FGD system
- [ ] Added server to Xbox
- [ ] Connected from Xbox successfully

---

## Additional Resources

- **Geyser Wiki**: https://wiki.geysermc.org/
- **Paper Documentation**: https://docs.papermc.io/
- **Port Forwarding**: Not needed for local network play
- **Performance Tuning**: Adjust -Xms and -Xmx values based on your RAM

---

**Note:** This setup is for LOCAL NETWORK play only. If you want to connect from outside your home network, you'll need to configure port forwarding on your router and use your public IP address.
