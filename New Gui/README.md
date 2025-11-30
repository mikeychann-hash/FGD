# Minecraft Server Admin

A comprehensive Windows 11 desktop application for managing Minecraft servers with real-time monitoring, player management, bot control, and plugin administration.

## Features

### 🖥️ Server Management
- **Start/Stop/Restart** - Complete server lifecycle control
- **Java Configuration** - Memory allocation and JVM arguments
- **Server Properties** - Edit server.properties with real-time validation
- **Auto-backup** - Automated world backup scheduling
- **Update Checker** - PaperMC version management

### 👥 Player Management
- **Live Player List** - Real-time player status monitoring
- **Player Actions** - Kick, ban, teleport, give items
- **Player Details** - Health, position, inventory, statistics
- **Permission Management** - Advanced permission controls
- **Ban List** - Manage banned players with reasons

### 🤖 Bot Management
- **Bot Spawning** - Spawn Mineflayer bots with different roles
- **Bot Types** - Miner, lumberjack, guard, builder, farmer
- **Bot Monitoring** - Real-time bot status and performance
- **Behavior Configuration** - Customize bot actions and limits
- **Auto-reconnection** - Intelligent bot reconnection logic

### 🔌 Plugin Management
- **Plugin Detection** - Automatically detect installed plugins
- **Enable/Disable** - Toggle plugin states
- **Configuration** - Edit plugin configuration files
- **Update Checking** - Plugin version management
- **Dependency Management** - Handle plugin dependencies

### 📊 Real-time Monitoring
- **Console Logs** - Real-time colored console output
- **Performance Metrics** - CPU, RAM, TPS monitoring
- **Player Activity** - Live player join/leave tracking
- **System Resources** - Server resource utilization
- **Network Statistics** - Connection and bandwidth monitoring

### 🎨 Windows 11 Integration
- **Native Design** - Windows 11 Fluent Design with Mica material
- **Dark Theme** - Professional gaming aesthetic
- **System Integration** - Tray minimization, notifications
- **Auto-updater** - Automatic application updates
- **Snap Layouts** - Windows 11 window management support

## Technology Stack

### Frontend
- **Electron** - Cross-platform desktop application framework
- **React** - Modern UI framework with TypeScript
- **Tailwind CSS** - Utility-first styling framework
- **Chart.js** - Real-time monitoring graphs
- **Socket.io** - Real-time WebSocket communication

### Backend
- **Node.js** - Server-side JavaScript runtime
- **Express** - REST API framework
- **RCON** - Minecraft server remote control protocol
- **Mineflayer** - Minecraft bot framework
- **PM2** - Process manager for production

## Installation

### Prerequisites
- Windows 11 (recommended) or Windows 10
- Node.js 18+ and npm
- Java 17+ for Minecraft server
- Git for cloning the repository

### Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/minecraft-server-admin/minecraft-server-admin.git
   cd minecraft-server-admin
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Install Heroicons**
   ```bash
   npm install @heroicons/react
   ```

4. **Install Chart.js**
   ```bash
   npm install chart.js
   ```

5. **Development mode**
   ```bash
   npm run dev
   ```

6. **Build for production**
   ```bash
   npm run build
   npm run dist
   ```

## Configuration

### Initial Setup
1. **Java Path** - Configure Java installation path
2. **Server JAR** - Set path to PaperMC server jar
3. **Memory Settings** - Configure min/max memory allocation
4. **RCON Settings** - Set up RCON for remote commands
5. **Server Directory** - Specify Minecraft server location

### Server Properties
- Edit `server.properties` through the UI
- Configure game rules and server settings
- Set up whitelist and operator permissions
- Configure world settings and generation

## Usage

### Starting the Server
1. Navigate to the **Server** tab
2. Configure Java and memory settings
3. Click **Start Server** button
4. Monitor startup progress in the console

### Managing Players
1. Go to the **Players** tab
2. View online players and their status
3. Click on a player for detailed information
4. Use action buttons for kick, ban, teleport, etc.

### Spawning Bots
1. Navigate to the **Bots** tab
2. Select bot type (miner, lumberjack, guard, etc.)
3. Configure bot behavior and limits
4. Click **Spawn Bot** to start the bot

### Monitoring Performance
1. View the **Dashboard** for overview metrics
2. Check real-time TPS, CPU, and memory usage
3. Monitor console logs for errors and events
4. Use performance graphs to identify issues

## Architecture

### Application Structure
```
src/
├── main/           # Electron main process
│   ├── main.js     # Main application logic
│   └── preload.js  # IPC bridge between main and renderer
├── renderer/       # React frontend
│   ├── components/ # Reusable UI components
│   ├── pages/      # Application pages
│   ├── hooks/      # Custom React hooks
│   ├── utils/      # Utility functions
│   └── types/      # TypeScript type definitions
├── backend/        # Node.js backend services
├── bots/          # Bot behavior scripts
├── config/        # Configuration files
└── resources/     # Assets and binaries
```

### Communication Flow
1. **Frontend** → **IPC** → **Main Process**
2. **Main Process** → **RCON** → **Minecraft Server**
3. **Minecraft Server** → **Socket.io** → **Frontend**
4. **Bot Commands** → **Mineflayer** → **Minecraft Server**

## Security Considerations

### Input Validation
- All user inputs are validated before processing
- Command injection prevention through sanitization
- File path validation to prevent directory traversal

### RCON Security
- Encrypted RCON connections
- Strong password requirements
- Connection timeout and retry logic

### Process Isolation
- Server process runs in isolated environment
- Resource limits to prevent system overload
- Graceful shutdown handling

## Troubleshooting

### Common Issues

**Server won't start**
- Check Java installation and path
- Verify server jar file exists
- Check memory allocation settings
- Review console logs for errors

**RCON connection failed**
- Verify RCON is enabled in server.properties
- Check RCON port and password
- Ensure server is fully started
- Check firewall settings

**Bots not spawning**
- Verify Mineflayer installation
- Check server connection settings
- Ensure adequate system resources
- Review bot logs for errors

**Performance issues**
- Monitor CPU and memory usage
- Check TPS and player count
- Review console for error messages
- Adjust memory allocation if needed

### Logs and Debugging
- Console logs available in real-time
- Application logs in `%APPDATA%\MinecraftAdmin\logs`
- Server logs in server directory
- Enable debug mode for detailed logging

## Development

### Project Structure
- **Frontend**: React with TypeScript
- **Backend**: Node.js with Express
- **Build Tool**: Vite for fast development
- **Styling**: Tailwind CSS with custom components
- **State Management**: React hooks and context

### Code Style
- ESLint configuration for code quality
- Prettier for consistent formatting
- TypeScript for type safety
- Conventional commits for version control

### Testing
- Unit tests with Jest
- Integration tests for critical paths
- Manual testing checklist
- Performance benchmarking

## Contributing

### Development Setup
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

### Code Guidelines
- Follow existing code style
- Add tests for new features
- Update documentation
- Use conventional commits

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Documentation**: Check the README and inline comments
- **Issues**: Report bugs on GitHub Issues
- **Discussions**: Join our Discord community
- **Email**: support@minecraftserveradmin.com

## Acknowledgments

- **Electron Team** - For the excellent desktop framework
- **React Team** - For the powerful UI library
- **PaperMC Team** - For the amazing Minecraft server software
- **Mineflayer Contributors** - For the bot framework
- **Windows 11 Design Team** - For the beautiful design language

---

Built with ❤️ for the Minecraft community