# Minecraft Server Admin - Build Guide

## Overview
This guide provides detailed instructions for building, packaging, and deploying the Minecraft Server Admin application for Windows.

## Prerequisites

### Development Environment
- **Node.js 18+** - JavaScript runtime
- **npm 9+** - Package manager
- **Git** - Version control
- **Windows 11 SDK** - For Windows-specific features
- **Visual Studio 2022** - C++ build tools (optional)

### Production Environment
- **Windows 11** or **Windows 10**
- **Java 17+** - For Minecraft server
- **PaperMC Server JAR** - Latest version recommended
- **Administrator privileges** - For installation

## Development Build

### 1. Initial Setup
```bash
# Clone the repository
git clone https://github.com/minecraft-server-admin/minecraft-server-admin.git
cd minecraft-server-admin

# Run setup script
node setup.js

# Install dependencies
npm install
```

### 2. Development Mode
```bash
# Start development server
npm run dev

# This will:
# - Start Vite dev server for React frontend
# - Start Electron in development mode
# - Enable hot reloading
# - Open DevTools for debugging
```

### 3. Testing
```bash
# Run unit tests
npm test

# Run linting
npm run lint

# Run type checking
npx tsc --noEmit
```

## Production Build

### 1. Build Process
```bash
# Build the application
npm run build

# This will:
# - Build React frontend with Vite
# - Bundle Electron main process
# - Optimize assets and minify code
# - Generate production-ready files
```

### 2. Create Installer
```bash
# Create Windows installer
npm run dist

# This will:
# - Build the application
# - Create NSIS installer
# - Generate .exe installer file
# - Create auto-updater metadata
```

### 3. Build Output
```
dist/
├── Minecraft Server Admin Setup 1.0.0.exe  # Main installer
├── latest.yml                              # Auto-updater metadata
└── win-unpacked/                           # Unpacked application
    ├── Minecraft Server Admin.exe          # Main executable
    ├── resources/                          # Assets and binaries
    └── ...                                 # Other application files
```

## Configuration

### Application Configuration
The application stores configuration in `%APPDATA%\MinecraftAdmin\config.json`:

```json
{
  "javaPath": "C:\\Program Files\\Java\\jdk-17\\bin\\java.exe",
  "serverJar": "paper-1.20.1-196.jar",
  "maxMemory": "4G",
  "minMemory": "2G",
  "serverDir": "C:\\MinecraftServer",
  "rcon": {
    "port": 25575,
    "password": "secure-password"
  },
  "appSettings": {
    "theme": "dark",
    "autoStart": false,
    "minimizeToTray": true,
    "checkUpdates": true
  }
}
```

### Server Configuration
Configure your Minecraft server in `server.properties`:

```properties
# RCON Configuration
enable-rcon=true
rcon.port=25575
rcon.password=secure-password

# Server Settings
server-port=25565
server-ip=
max-players=20
level-name=world
allow-flight=false
```

## Deployment

### 1. Local Deployment
```bash
# Install the application
# Run the installer: Minecraft Server Admin Setup 1.0.0.exe
# Follow the installation wizard
# Launch from Start Menu or Desktop shortcut
```

### 2. Network Deployment
For enterprise deployment:

```bash
# Silent installation
Minecraft Server Admin Setup 1.0.0.exe /S

# Custom installation directory
Minecraft Server Admin Setup 1.0.0.exe /D=C:\CustomPath

# Create desktop shortcut
Minecraft Server Admin Setup 1.0.0.exe /desktopshortcut
```

### 3. Auto-updater
The application includes built-in auto-updater:
- Checks for updates on startup
- Downloads updates in background
- Installs updates on application restart
- Supports delta updates for faster downloads

## Performance Optimization

### Memory Settings
```javascript
// Optimal memory allocation based on player count
// Adjust in Server Management tab

// Small server (1-10 players)
minMemory: "1G",
maxMemory: "2G"

// Medium server (10-30 players)
minMemory: "2G",
maxMemory: "4G"

// Large server (30+ players)
minMemory: "4G",
maxMemory: "8G"
```

### JVM Arguments
```javascript
// Advanced JVM optimization
const jvmArgs = [
  "-Xmx4G",                    // Max memory
  "-Xms2G",                    // Min memory
  "-XX:+UseG1GC",              // G1 Garbage Collector
  "-XX:+UnlockExperimentalVMOptions",
  "-XX:+UseCGroupMemoryLimitForHeap",
  "-XX:MaxGCPauseMillis=100",   // GC pause target
  "-XX:+DisableExplicitGC"     // Disable System.gc()
];
```

## Troubleshooting

### Build Issues

**Node modules not found**
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
del /s /q node_modules
npm install
```

**Build fails with memory error**
```bash
# Increase Node.js memory limit
set NODE_OPTIONS=--max_old_space_size=4096
npm run build
```

**Electron build fails**
```bash
# Install Windows build tools
npm install --global windows-build-tools

# Rebuild native modules
npm rebuild
```

### Runtime Issues

**Application won't start**
1. Check Windows Event Logs
2. Verify .NET Framework 4.7.2+ is installed
3. Run as Administrator
4. Check antivirus software

**Server won't start**
1. Verify Java installation
2. Check server jar file path
3. Review memory allocation
4. Check console logs for errors

**RCON connection failed**
1. Enable RCON in server.properties
2. Check firewall settings
3. Verify RCON port is not in use
4. Ensure server is fully started

## Security Best Practices

### Application Security
- Use strong RCON passwords
- Enable Windows Firewall
- Run with minimal privileges
- Keep application updated

### Server Security
- Use whitelist for player access
- Regular backups of world data
- Monitor for suspicious activity
- Keep server software updated

### Network Security
- Use VPN for remote access
- Configure router port forwarding
- Enable DDoS protection
- Monitor network traffic

## Monitoring and Maintenance

### Health Checks
```javascript
// Built-in health monitoring
const healthCheck = {
  serverRunning: true,
  rconConnected: true,
  tps: 20.0,
  memoryUsage: 0.75,
  playerCount: 15,
  lastBackup: "2023-11-15T10:30:00Z"
};
```

### Backup Strategy
```bash
# Automated backup script
# Creates timestamped backups
# Compresses world data
# Stores in backup directory
# Rotates old backups
```

### Performance Monitoring
- CPU usage < 80%
- Memory usage < 90%
- TPS > 18.0
- Player count within limits
- Network latency < 100ms

## Support and Updates

### Getting Help
- **Documentation**: Check README and inline help
- **GitHub Issues**: Report bugs and feature requests
- **Discord Community**: Join our support server
- **Email Support**: technical@minecraftserveradmin.com

### Updating the Application
1. Check for updates in Settings
2. Download latest installer
3. Run installer (preserves configuration)
4. Restart application

### Version Compatibility
- **App Version**: 1.0.0
- **Minecraft**: 1.19.4 - 1.20.2
- **PaperMC**: Latest stable builds
- **Java**: 17+ required
- **Windows**: 10/11 supported

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Electron team for the desktop framework
- React team for the UI library
- PaperMC team for the server software
- Mineflayer contributors for bot framework
- Windows 11 design team for visual language

---

For more information, visit our [GitHub repository](https://github.com/minecraft-server-admin/minecraft-server-admin) or join our [Discord community](https://discord.gg/minecraft-server-admin).