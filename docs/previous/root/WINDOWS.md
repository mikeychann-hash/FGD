# Windows 10/11 Compatibility Guide

This project is fully compatible with Windows 10 and Windows 11. This guide covers Windows-specific setup and usage instructions.

## Prerequisites

1. **Node.js 14.x or higher**
   - Download from: https://nodejs.org/
   - The installer includes npm automatically
   - Verify installation:
     ```cmd
     node --version
     npm --version
     ```

2. **Command Prompt or PowerShell**
   - Both work fine for running the scripts
   - PowerShell may require execution policy adjustment (see below)

## Quick Start (Windows)

1. **Clone or download the repository**
   ```cmd
   cd path\to\FGD
   ```

2. **Install dependencies**
   ```cmd
   npm install
   ```

3. **Start the server**
   ```cmd
   quick-start.bat
   ```

   Or use npm directly:
   ```cmd
   npm start
   ```

## Startup Scripts

The project includes Windows batch files that mirror the functionality of the Linux/macOS shell scripts:

### quick-start.bat
Simple wrapper that starts the server with default settings:
```cmd
quick-start.bat
```

### start-server.bat
Advanced startup with options:
```cmd
start-server.bat [mode] [options]
```

**Modes:**
- `prod` - Production mode (default)
- `dev` - Development mode with hot-reload
- `test` - Run tests

**Options:**
- `--port PORT` - Override default port (3000)
- `--log-level LEVEL` - Set log level (DEBUG, INFO, WARN, ERROR, FATAL)
- `--no-install` - Skip dependency installation check
- `--help` - Show help message

**Examples:**
```cmd
REM Start in development mode
start-server.bat dev

REM Start on custom port
start-server.bat prod --port 8080

REM Run with debug logging
start-server.bat prod --log-level DEBUG
```

## PowerShell Considerations

If you're using PowerShell and encounter execution policy errors when running batch files, you have a few options:

1. **Run batch files directly** (recommended):
   ```powershell
   .\start-server.bat prod
   ```

2. **Use npm scripts instead**:
   ```powershell
   npm start
   npm run dev
   ```

3. **If you prefer PowerShell scripts**, you can create `.ps1` equivalents, but the batch files should work fine in PowerShell.

## Port Checking

The Windows startup script (`start-server.bat`) automatically checks if the configured port is available using `netstat`. If a port conflict is detected, you'll be prompted to:

- Continue anyway (not recommended)
- Stop and resolve the conflict manually

**Manual Port Checking:**

1. **Find what's using the port:**
   ```cmd
   netstat -ano | findstr :3000
   ```

2. **Kill the process** (use the PID from previous command):
   ```cmd
   taskkill /PID <pid> /F
   ```

3. **Or use a different port:**
   ```cmd
   start-server.bat prod --port 8080
   ```

## File Paths

The application uses Node.js's `path` module for all file operations, ensuring cross-platform compatibility. You don't need to worry about forward slashes vs backslashes - Node.js handles this automatically.

## Known Limitations

1. **ANSI color codes**: Some terminals may not display colors correctly. This is cosmetic only and doesn't affect functionality.
2. **PowerShell Execution Policy**: Some systems may require adjusting the execution policy to run PowerShell scripts. Use the `-ExecutionPolicy Bypass` flag when needed.

## Troubleshooting

### "npm is not recognized as an internal or external command"
- Node.js/npm is not in your PATH
- Solution: Reinstall Node.js and ensure "Add to PATH" is checked during installation

### "Cannot find module" errors
- Dependencies not installed
- Solution: Run `npm install` in the project directory

### Port already in use
- Another application is using port 3000
- Solution: See "Port Checking" section above

### Permission errors with data directory
- The application doesn't have write permissions
- Solution: Run as administrator, or move the project to a user directory (like Documents)

## Development on Windows

All development tools work normally on Windows:

```cmd
REM Install dependencies
npm install

REM Start in development mode (with hot-reload)
npm run dev

REM Run tests
node test\npc_system.test.js
```

## Environment Variables

You can set environment variables before running the server:

**Command Prompt:**
```cmd
set PORT=8080
set LOG_LEVEL=DEBUG
npm start
```

**PowerShell:**
```powershell
$env:PORT=8080
$env:LOG_LEVEL="DEBUG"
npm start
```

## Docker on Windows

FGD can run in Docker containers on Windows. The application uses Linux containers, which require Docker Desktop with WSL2 backend.

### Docker Desktop Setup (Recommended)

1. **Install WSL2:**
   ```powershell
   wsl --install
   ```
   Restart your computer after installation.

2. **Install Docker Desktop:**
   - Download from: https://www.docker.com/products/docker-desktop/
   - Run the installer
   - During installation, ensure "Use WSL 2 based engine" is enabled

3. **Verify Installation:**
   ```cmd
   docker --version
   docker-compose --version
   ```

### Running FGD with Docker Compose

1. **Clone the repository:**
   ```cmd
   git clone https://github.com/your-org/FGD.git
   cd FGD
   ```

2. **Create `.env` file:**
   ```cmd
   copy .env.example .env
   ```

3. **Edit `.env` and set required variables:**
   ```
   JWT_SECRET=your-secret-here
   OPENAI_API_KEY=your-key-here
   ```

4. **Start all services:**
   ```cmd
   docker-compose up -d
   ```

   This starts:
   - FGD Dashboard (port 3000)
   - PostgreSQL (port 5432)
   - Redis (port 6379)

5. **View logs:**
   ```cmd
   docker-compose logs -f
   ```

6. **Stop services:**
   ```cmd
   docker-compose down
   ```

### Alternative: Podman Desktop

Podman is an alternative to Docker that doesn't require WSL2:

1. **Install Podman Desktop:**
   - Download from: https://podman-desktop.io/
   - Run the installer

2. **Use with docker-compose:**
   ```cmd
   podman-compose up -d
   ```

### Docker Volume Performance on Windows

Windows file system performance in Docker can be slow. To improve performance:

1. **Store files in WSL2 filesystem:**
   ```cmd
   wsl
   cd ~
   git clone https://github.com/your-org/FGD.git
   cd FGD
   docker-compose up -d
   ```

2. **Or use named volumes** (already configured in docker-compose.yml):
   ```yaml
   volumes:
     - fgd_logs:/app/logs    # Named volume (fast)
     - fgd_data:/app/data    # Named volume (fast)
   ```

### Docker Desktop Resource Limits

Adjust WSL2 resource limits if needed:

1. **Create `.wslconfig` file:**
   ```cmd
   notepad %USERPROFILE%\.wslconfig
   ```

2. **Add resource limits:**
   ```ini
   [wsl2]
   memory=4GB
   processors=2
   swap=2GB
   ```

3. **Restart WSL2:**
   ```cmd
   wsl --shutdown
   ```

### Troubleshooting Docker

**Docker Desktop won't start:**
- Ensure WSL2 is installed: `wsl --status`
- Enable Virtualization in BIOS
- Check Windows version (Windows 10 2004+ or Windows 11)

**Port conflicts:**
- Check if ports are in use: `netstat -ano | findstr :3000`
- Stop conflicting services or change ports in docker-compose.yml

**Slow performance:**
- Move project to WSL2 filesystem
- Increase Docker Desktop memory allocation
- Use named volumes instead of bind mounts

## Redis Setup on Windows

The FGD Dashboard requires Redis for caching and message queues. Redis no longer provides official Windows builds, but there are several options:

### Option 1: Memurai (Recommended for Native Windows)

Memurai is a Redis-compatible server for Windows:

1. **Download Memurai:**
   - Visit: https://www.memurai.com/
   - Free for development use

2. **Install:**
   - Run the installer
   - Memurai will install as a Windows Service

3. **Verify:**
   ```cmd
   memurai-cli ping
   ```
   Should return: `PONG`

4. **Configure FGD:**
   ```cmd
   set REDIS_URL=redis://localhost:6379
   npm start
   ```

### Option 2: Docker Desktop (Easiest)

If you have Docker Desktop installed:

```cmd
docker run -d -p 6379:6379 --name redis redis:7-alpine
```

Then start FGD:
```cmd
set REDIS_URL=redis://localhost:6379
npm start
```

### Option 3: WSL2 + Redis

Run Redis in Windows Subsystem for Linux:

1. **Install WSL2:**
   ```powershell
   wsl --install
   ```

2. **Install Redis in WSL2:**
   ```bash
   wsl
   sudo apt update
   sudo apt install redis-server
   redis-server --daemonize yes
   ```

3. **Access from Windows:**
   ```cmd
   set REDIS_URL=redis://localhost:6379
   npm start
   ```

### Option 4: Cloud Redis (Production)

For production deployments:
- **Redis Cloud**: https://redis.com/cloud/
- **Azure Cache for Redis**: https://azure.microsoft.com/en-us/services/cache/
- **AWS ElastiCache**: https://aws.amazon.com/elasticache/

**Configure:**
```cmd
set REDIS_URL=rediss://your-redis-cloud-url:port
set REDIS_PASSWORD=your-password
npm start
```

### Troubleshooting Redis

**Connection Errors:**
- Ensure Redis is running: `memurai-cli ping` or `docker ps`
- Check firewall: Redis uses port 6379
- Verify REDIS_URL environment variable

**Performance Issues:**
- Increase memory limit in Memurai settings
- Use Docker with `--memory=2g` flag
- Check Redis memory usage: `redis-cli info memory`

## PostgreSQL Setup on Windows

The FGD Dashboard also requires PostgreSQL for persistent data:

### Option 1: Official PostgreSQL Installer (Recommended)

1. **Download:**
   - Visit: https://www.postgresql.org/download/windows/
   - Use the EDB installer

2. **Install:**
   - Choose installation directory
   - Set superuser password
   - Port: 5432 (default)
   - Locale: Default

3. **Create Database:**
   ```cmd
   psql -U postgres
   CREATE DATABASE fgd_production;
   CREATE USER fgd_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE fgd_production TO fgd_user;
   \q
   ```

4. **Configure FGD:**
   ```cmd
   set DATABASE_URL=postgresql://fgd_user:your_password@localhost:5432/fgd_production
   npm start
   ```

### Option 2: Docker

```cmd
docker run -d ^
  -p 5432:5432 ^
  -e POSTGRES_DB=fgd_production ^
  -e POSTGRES_USER=fgd_user ^
  -e POSTGRES_PASSWORD=your_password ^
  --name postgres ^
  postgres:15-alpine
```

## Minecraft Server Setup on Windows

### Quick Setup

Run the automated setup script:

```cmd
cd minecraft-servers
setup-paper-geyser.bat
```

Or use the PowerShell version for better output:

```powershell
cd minecraft-servers
powershell -ExecutionPolicy Bypass -File setup-paper-geyser.ps1
```

### Manual Setup

1. **Install Java 17:**
   - Download from: https://adoptium.net/
   - Verify: `java -version`

2. **Download Paper:**
   - Visit: https://papermc.io/downloads
   - Place JAR in `minecraft-servers/` directory

3. **Start Server:**
   ```cmd
   cd minecraft-servers
   java -Xms2G -Xmx4G -jar paper-*.jar nogui
   ```

4. **Configure RCON:**
   - Edit `server.properties`
   - Set `enable-rcon=true`
   - Set `rcon.port=25575`
   - Set `rcon.password=your_secure_password`

5. **Update FGD Configuration:**
   - Edit `.env` file:
   ```
   MINECRAFT_RCON_HOST=127.0.0.1
   MINECRAFT_RCON_PORT=25575
   MINECRAFT_RCON_PASSWORD=your_secure_password
   ```

## Additional Notes

- All JavaScript code is platform-agnostic
- The application uses standard Node.js APIs that work identically on Windows and Unix systems
- WebSocket connections work the same on all platforms
- No compilation or build step is required
- Redis and PostgreSQL can run as Windows Services for production use
- The FGD Dashboard auto-detects paths and uses cross-platform path handling

## Getting Help

If you encounter Windows-specific issues:

1. Check the main [README.md](README.md) for general documentation
2. Check [NPC_SYSTEM_README.md](NPC_SYSTEM_README.md) for NPC system documentation
3. Review this guide's troubleshooting sections
4. Open an issue on GitHub with:
   - Windows version (10/11)
   - Node.js version
   - Error messages
   - Steps to reproduce
