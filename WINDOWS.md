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

Unlike the Linux/macOS version, the Windows startup script doesn't check if the port is available (Windows doesn't have `lsof` by default). If you get a port conflict error:

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

1. **No built-in port checking**: The startup script doesn't check if the port is available (see Port Checking section above)
2. **ANSI color codes**: Some terminals may not display colors correctly. This is cosmetic only and doesn't affect functionality.

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

## Additional Notes

- All JavaScript code is platform-agnostic
- The application uses standard Node.js APIs that work identically on Windows and Unix systems
- WebSocket connections work the same on all platforms
- No compilation or build step is required

## Getting Help

If you encounter Windows-specific issues:

1. Check the main [README.md](README.md) for general documentation
2. Check [NPC_SYSTEM_README.md](NPC_SYSTEM_README.md) for NPC system documentation
3. Open an issue on GitHub with your Windows version and Node.js version
