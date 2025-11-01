# AICraft Cluster Dashboard

A beautiful, real-time monitoring dashboard for AICraft cluster management with WebSocket support, admin panel, autonomous NPC system, and theme switching.

## Features

- 🎨 Beautiful UI with smooth animations
- 🔄 Real-time updates via WebSocket
- 🌓 Dark/Light theme toggle
- 📊 Interactive charts with Chart.js
- ⚡ Complete admin control panel
- 🖥️ Node detail modals
- 🤖 **Autonomous NPC System** with learning and lifecycle management
- ♿ Accessible (WCAG compliant)

## Quick Start

```bash
npm install
npm start
```

Visit: `http://localhost:3000`

## Server Startup Options

The project includes comprehensive startup scripts with pre-flight checks and error handling for both **Linux/Mac** and **Windows**.

### For Windows Users 🪟

If you're on Windows, use the `.bat` or `.ps1` scripts:

#### Quick Start (Windows)

**Using Command Prompt:**
```cmd
quick-start.bat
```

**Using PowerShell:**
```powershell
.\start-server.ps1
```

Both methods automatically handle dependency installation and start the server on port 3000.

#### Advanced Windows Startup

**Command Prompt:**
```cmd
start-server.bat [mode]

REM Examples:
start-server.bat           REM Production mode
start-server.bat dev       REM Development mode
start-server.bat test      REM Run tests
```

**PowerShell (recommended for advanced options):**
```powershell
.\start-server.ps1 [mode] [-Port <port>] [-LogLevel <level>]

# Examples:
.\start-server.ps1                          # Production mode
.\start-server.ps1 dev                      # Development mode
.\start-server.ps1 prod -Port 8080          # Custom port
.\start-server.ps1 prod -LogLevel DEBUG     # Debug logging
```

#### Troubleshooting Windows Installation

If you see "Node.js is not installed":

1. **Check if Node.js is installed:**
   ```cmd
   check-requirements.bat
   ```

2. **Install Node.js:**
   - Download from https://nodejs.org/
   - Choose the **LTS version** (recommended)
   - Run the installer
   - **Restart your terminal** after installation

3. **Verify installation:**
   ```cmd
   node --version
   npm --version
   ```

4. **Try starting again:**
   ```cmd
   quick-start.bat
   ```

### For Linux/Mac Users 🐧🍎

#### Simple Quick Start

For the fastest way to start the server:

```bash
./quick-start.sh
```

This automatically handles dependency installation and starts the server on port 3000.

#### Advanced Startup Script (Linux/Mac)

For more control over the server startup:

```bash
./start-server.sh [mode] [options]
```

**Available Modes:**
- `prod` - Production mode (default)
- `dev` - Development mode with hot-reload
- `test` - Run tests only

**Options:**
- `--port PORT` - Override default port (3000)
- `--log-level LEVEL` - Set log level (DEBUG, INFO, WARN, ERROR, FATAL)
- `--no-install` - Skip dependency installation check
- `--help` - Show help message

**Examples:**

```bash
# Start in development mode
./start-server.sh dev

# Start on custom port with debug logging
./start-server.sh prod --port 8080 --log-level DEBUG

# Run tests
./start-server.sh test

# Start without checking dependencies (faster)
./start-server.sh prod --no-install
```

### What the Startup Scripts Do (All Platforms)

The startup script performs the following checks before starting the server:

1. ✓ Verifies Node.js and npm are installed (requires Node.js 14+)
2. ✓ Checks for required files (package.json, server.js)
3. ✓ Installs/updates dependencies if needed
4. ✓ Creates data directory if missing
5. ✓ Verifies the port is available
6. ✓ Sets up environment variables
7. ✓ Starts the server with appropriate settings

If any check fails, the script provides helpful error messages and troubleshooting steps.

## API Endpoints

### System Endpoints
- `GET /api/health` - Health check
- `GET /api/cluster` - Cluster nodes
- `GET /api/metrics` - System metrics
- `GET /api/metrics/system` - Comprehensive system metrics
- `GET /api/fusion` - Fusion knowledge
- `GET /api/stats` - Statistics
- `GET /api/logs` - System logs
- `GET /api/nodes/:id` - Node details
- `POST /api/config` - Update config
- `POST /api/policy` - Update policy

### NPC Management Endpoints
- `GET /api/npcs` - List all NPCs (supports filtering & pagination)
- `GET /api/npcs/:id` - Get NPC details
- `POST /api/npcs` - Create new NPC
- `PUT /api/npcs/:id` - Update NPC
- `DELETE /api/npcs/:id` - Finalize/delete NPC
- `GET /api/npcs/archive/all` - Get archived NPCs
- `GET /api/npcs/deadletter/queue` - Get failed spawns
- `POST /api/npcs/deadletter/retry` - Retry failed spawns

## NPC System

The NPC system provides autonomous agent management with personality, learning, and complete lifecycle tracking.

### Quick NPC Examples

#### Create an NPC
```bash
curl -X POST http://localhost:3000/api/npcs \
  -H "Content-Type: application/json" \
  -d '{
    "role": "miner",
    "appearance": {"skin": "default", "outfit": "overalls"},
    "position": {"x": 100, "y": 64, "z": 200},
    "autoSpawn": true
  }'
```

#### Get NPC Status
```bash
curl http://localhost:3000/api/npcs/miner_01
```

#### List Active NPCs
```bash
curl "http://localhost:3000/api/npcs?status=active&limit=10"
```

#### Finalize NPC (with archive)
```bash
curl -X DELETE "http://localhost:3000/api/npcs/miner_01?preserve=false"
```

### Programmatic Usage

```javascript
import { NPCSpawner } from './npc_spawner.js';
import { NPCRegistry } from './npc_registry.js';
import { LearningEngine } from './learning_engine.js';

// Initialize components
const registry = new NPCRegistry();
await registry.load();

const learning = new LearningEngine();
await learning.initialize();

const spawner = new NPCSpawner({ registry, learningEngine: learning });

// Spawn an NPC
const npc = await spawner.spawn({
  role: 'builder',
  position: { x: 0, y: 64, z: 0 }
});

console.log(`NPC ${npc.id} spawned with personality:`, npc.personalitySummary);

// Record task completion
learning.recordTask(npc.id, 'building', true);

// Finalize when done
const finalizer = new NPCFinalizer({ registry, learningEngine: learning });
const report = await finalizer.finalizeNPC(npc.id, { reason: 'completed_work' });

console.log(`NPC completed ${report.stats.computed.totalTasks} tasks`);
console.log(`Success rate: ${report.stats.computed.successRate}%`);
```

### NPC Features

- **Personality System**: 7-trait personality (curiosity, patience, motivation, empathy, aggression, creativity, loyalty)
- **Learning Engine**: Skill progression, XP tracking, task history
- **Error Recovery**: Automatic retries with exponential backoff, dead letter queue
- **Lifecycle Management**: Complete spawn-to-archive lifecycle with statistics
- **Persistence**: All data saved to JSON files with transaction safety

### Documentation

- [NPC API Reference](docs/NPC_API.md) - Complete API documentation
- [NPC Architecture](docs/NPC_ARCHITECTURE.md) - System architecture and design

### Running Tests

```bash
node test/npc_system.test.js
```
