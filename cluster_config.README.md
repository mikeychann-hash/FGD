# Cluster Configuration Guide

This guide explains how to configure your FGD cluster for local home network use, including Xbox connectivity.

## Overview

The `cluster_config.jsonc` file defines how nodes in your cluster communicate with each other. This setup is designed for:
- Local home network (WiFi/Ethernet)
- 3 or fewer nodes
- Xbox connectivity from the same network

## Configuration File Location

```
/home/user/FGD/cluster_config.jsonc
```

## Basic Configuration Structure

```jsonc
{
  "nodeName": "Node_A",        // Unique identifier for this node
  "port": 8800,                // WebSocket server port
  "peers": [                   // List of other nodes to connect to
    "ws://192.168.1.100:8801"
  ]
}
```

## Setting Up for Xbox Connectivity

### Step 1: Find Your PC's Local IP Address

**Windows:**
```bash
ipconfig
```
Look for "IPv4 Address" under your active network adapter (usually starts with 192.168.x.x or 10.0.x.x)

**Mac/Linux:**
```bash
ifconfig
# or
ip addr show
```
Look for "inet" address on your active interface (en0, eth0, wlan0, etc.)

### Step 2: Update Configuration

Replace `localhost` with your actual local IP address:

**WRONG (won't work from Xbox):**
```json
"peers": ["ws://localhost:8801"]
```

**CORRECT:**
```json
"peers": ["ws://192.168.1.100:8801"]
```

### Step 3: Configure Firewall

Ensure your PC firewall allows incoming connections on the configured ports.

**Windows:**
```bash
# Allow port 8800 (adjust for your node's port)
netsh advfirewall firewall add rule name="FGD Cluster" dir=in action=allow protocol=TCP localport=8800
```

**Mac:**
System Preferences → Security & Privacy → Firewall → Firewall Options → Add application

**Linux:**
```bash
sudo ufw allow 8800/tcp
```

### Step 4: Verify Network Connectivity

Ensure Xbox and PC are on the same WiFi network:
1. Check Xbox network settings for IP address (Settings → Network → Advanced Settings)
2. Ping your PC from another device: `ping 192.168.1.100`
3. Verify no router isolation mode is enabled (check router settings)

## Default Port Assignments

To avoid port conflicts, use these standard ports:

| Node    | Port |
|---------|------|
| Node A  | 8800 |
| Node B  | 8801 |
| Node C  | 8802 |

## Example Configurations

### Single Node (No Peers)
```jsonc
{
  "nodeName": "MainNode",
  "port": 8800,
  "peers": []  // No other nodes to connect to
}
```

### Two Node Setup
**Node A (PC):**
```jsonc
{
  "nodeName": "PC_Node",
  "port": 8800,
  "peers": ["ws://192.168.1.100:8801"]  // Connect to Node B
}
```

**Node B (another device):**
```jsonc
{
  "nodeName": "Secondary_Node",
  "port": 8801,
  "peers": ["ws://192.168.1.100:8800"]  // Connect back to Node A
}
```

### Three Node Setup
**Node A:**
```jsonc
{
  "nodeName": "Node_A",
  "port": 8800,
  "peers": [
    "ws://192.168.1.100:8801",
    "ws://192.168.1.100:8802"
  ]
}
```

**Node B:**
```jsonc
{
  "nodeName": "Node_B",
  "port": 8801,
  "peers": [
    "ws://192.168.1.100:8800",
    "ws://192.168.1.100:8802"
  ]
}
```

**Node C:**
```jsonc
{
  "nodeName": "Node_C",
  "port": 8802,
  "peers": [
    "ws://192.168.1.100:8800",
    "ws://192.168.1.100:8801"
  ]
}
```

## Troubleshooting

### Xbox Can't Connect

1. **Verify IP address is correct**
   - Make sure you're using your PC's local IP, not `localhost`
   - IP addresses can change; check if your PC got a new DHCP address

2. **Check firewall**
   - Temporarily disable firewall to test
   - If it works, add proper firewall rule

3. **Verify same network**
   - Xbox and PC must be on the same WiFi/LAN
   - Guest networks often have client isolation enabled

4. **Check router settings**
   - Disable AP Isolation / Client Isolation
   - Disable "Guest Mode" if applicable

### Connection Drops Frequently

1. **WiFi signal strength**
   - Move Xbox/PC closer to router
   - Use 5GHz WiFi if available (less interference)

2. **Router bandwidth**
   - Close other high-bandwidth applications
   - Restart router

3. **Check logs**
   - Node logs show connection status (look for reconnection messages)

### Port Already in Use

Error: `EADDRINUSE`

**Solution:** Change the port in your config:
```jsonc
{
  "port": 8803  // Try a different port
}
```

## Advanced Options

### Static IP Address (Recommended)

To prevent IP address changes:

**Windows:** Network adapter → Properties → TCP/IPv4 → Use the following IP address

**Router:** Reserve IP in DHCP settings (assign fixed IP to device MAC address)

### Connection Timeout

The system will retry connections automatically if a peer is unreachable.

## Getting Help

If you encounter issues:
1. Check the console logs for connection errors
2. Verify all settings in this guide
3. Test with a simple ping/connection tool first
4. Check that ports aren't blocked by antivirus software

## Technical Details

- **Protocol:** WebSocket (ws://)
- **Transport:** TCP
- **Discovery:** Static configuration (no automatic discovery)
- **Topology:** Full mesh (each node connects to all peers)
